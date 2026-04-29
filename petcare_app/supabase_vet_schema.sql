-- Perfil veterinário (extensão do profiles)
create table if not exists vet_profiles (
  id uuid references auth.users on delete cascade primary key,
  crm text not null,
  specialty text,
  clinic_name text,
  clinic_address text,
  phone text,
  created_at timestamp with time zone default now()
);

-- Vínculo entre pet e veterinário
create table if not exists pet_vet_links (
  id uuid default gen_random_uuid() primary key,
  pet_id uuid references pets on delete cascade not null,
  vet_id uuid references auth.users on delete cascade not null,
  tutor_id uuid references auth.users on delete cascade not null,
  status text default 'active', -- 'active' | 'removed'
  linked_at timestamp with time zone default now(),
  unique(pet_id, vet_id)
);

-- Códigos de convite para vincular vet ao pet
create table if not exists vet_invite_codes (
  id uuid default gen_random_uuid() primary key,
  pet_id uuid references pets on delete cascade not null,
  tutor_id uuid references auth.users on delete cascade not null,
  code text unique not null,
  used boolean default false,
  expires_at timestamp with time zone default (now() + interval '7 days'),
  created_at timestamp with time zone default now()
);

-- Atualiza medical_records para suportar entradas de veterinários
alter table medical_records
  add column if not exists vet_id uuid references auth.users on delete set null,
  add column if not exists created_by_role text default 'tutor',
  add column if not exists diagnosis text,
  add column if not exists prescription text,
  add column if not exists next_appointment date;

-- Adiciona campo de role nos profiles (tutor ou vet)
alter table profiles
  add column if not exists role text default 'tutor';

-- RLS
alter table vet_profiles enable row level security;
alter table pet_vet_links enable row level security;
alter table vet_invite_codes enable row level security;

-- Policies vet_profiles
do $$ begin
  create policy "vets manage own profile" on vet_profiles for all using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tutors view vet profiles" on vet_profiles for select using (true);
exception when duplicate_object then null; end $$;

-- Policies pet_vet_links
do $$ begin
  create policy "tutors manage pet links" on pet_vet_links for all using (auth.uid() = tutor_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "vets view their links" on pet_vet_links for select using (auth.uid() = vet_id);
exception when duplicate_object then null; end $$;

-- Policies invite codes
do $$ begin
  create policy "tutors manage invite codes" on vet_invite_codes for all using (auth.uid() = tutor_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "vets use invite codes" on vet_invite_codes for select using (true);
exception when duplicate_object then null; end $$;
