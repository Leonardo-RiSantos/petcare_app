-- Adiciona campos de QR e contato nos pets
alter table pets
  add column if not exists qr_code_id text unique default gen_random_uuid()::text,
  add column if not exists contact_phone text,
  add column if not exists qr_public boolean default true;

-- Adiciona telefone no profiles
alter table profiles
  add column if not exists phone text;

-- Index para busca rápida pelo QR
create index if not exists idx_pets_qr_code_id on pets(qr_code_id);
