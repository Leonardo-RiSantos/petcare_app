-- Cria tabelas que ainda nao existem
create table if not exists pets (
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

create table if not exists vaccines (
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

create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  pet_id uuid references pets on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  category text not null,
  description text,
  amount numeric(10,2) not null,
  date date not null,
  created_at timestamp with time zone default now()
);

create table if not exists weight_records (
  id uuid default gen_random_uuid() primary key,
  pet_id uuid references pets on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  weight_kg numeric(5,2) not null,
  date date not null,
  notes text,
  created_at timestamp with time zone default now()
);

create table if not exists medical_records (
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

-- Ativa segurança nas tabelas (ignora se ja ativo)
alter table if exists profiles enable row level security;
alter table if exists pets enable row level security;
alter table if exists vaccines enable row level security;
alter table if exists expenses enable row level security;
alter table if exists weight_records enable row level security;
alter table if exists medical_records enable row level security;

-- Recria policies (ignora erros se ja existirem)
do $$ begin
  create policy "users see own profile" on profiles for all using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users manage own pets" on pets for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users manage own vaccines" on vaccines for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users manage own expenses" on expenses for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users manage own weight records" on weight_records for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users manage own medical records" on medical_records for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Recria o trigger que cria perfil automaticamente ao registrar
drop trigger if exists on_auth_user_created on auth.users;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
