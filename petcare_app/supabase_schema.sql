-- Perfis de usuário
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- Pets
create table pets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  species text not null,
  breed text,
  sex text,
  birth_date date,
  neutered boolean default false,
  weight_kg numeric(5,2),
  photo_url text,
  created_at timestamp with time zone default now()
);

-- Vacinas
create table vaccines (
  id uuid default gen_random_uuid() primary key,
  pet_id uuid references pets on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  applied_date date not null,
  next_dose_date date,
  veterinarian text,
  notes text,
  created_at timestamp with time zone default now()
);

-- Gastos
create table expenses (
  id uuid default gen_random_uuid() primary key,
  pet_id uuid references pets on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  category text not null,
  description text,
  amount numeric(10,2) not null,
  date date not null,
  created_at timestamp with time zone default now()
);

-- Histórico de peso
create table weight_records (
  id uuid default gen_random_uuid() primary key,
  pet_id uuid references pets on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  weight_kg numeric(5,2) not null,
  date date not null,
  notes text,
  created_at timestamp with time zone default now()
);

-- Histórico médico
create table medical_records (
  id uuid default gen_random_uuid() primary key,
  pet_id uuid references pets on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  type text not null,
  title text not null,
  description text,
  date date not null,
  veterinarian text,
  created_at timestamp with time zone default now()
);

-- RLS (Row Level Security) - cada usuário só vê seus próprios dados
alter table profiles enable row level security;
alter table pets enable row level security;
alter table vaccines enable row level security;
alter table expenses enable row level security;
alter table weight_records enable row level security;
alter table medical_records enable row level security;

create policy "users see own profile" on profiles for all using (auth.uid() = id);
create policy "users manage own pets" on pets for all using (auth.uid() = user_id);
create policy "users manage own vaccines" on vaccines for all using (auth.uid() = user_id);
create policy "users manage own expenses" on expenses for all using (auth.uid() = user_id);
create policy "users manage own weight records" on weight_records for all using (auth.uid() = user_id);
create policy "users manage own medical records" on medical_records for all using (auth.uid() = user_id);

-- Cria perfil automaticamente ao registrar
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
