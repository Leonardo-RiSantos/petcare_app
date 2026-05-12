-- ============================================================
-- MIGRAÇÃO: Tier 1 Features
-- Execute no Supabase SQL Editor APÓS supabase_vet_migration.sql
-- ============================================================

-- 1. Chat vet <-> tutor
CREATE TABLE IF NOT EXISTS public.vet_chat_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vet_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id      UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('vet', 'tutor')),
  content     TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.vet_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_chat_vet_pet ON public.vet_chat_messages(vet_id, pet_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON public.vet_chat_messages(created_at);

-- Vet vê mensagens das suas conversas; tutor vê mensagens dos seus pets
CREATE POLICY "chat_vet_access" ON public.vet_chat_messages
  FOR ALL USING (
    vet_id = auth.uid()
    OR pet_id IN (SELECT id FROM public.pets WHERE user_id = auth.uid())
  );

-- 2. Push tokens
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_owns_push_token" ON public.push_tokens
  FOR ALL USING (user_id = auth.uid());

-- 3. Configurações adicionais no perfil do vet
ALTER TABLE public.vet_profiles ADD COLUMN IF NOT EXISTS chat_enabled      BOOLEAN DEFAULT false;
ALTER TABLE public.vet_profiles ADD COLUMN IF NOT EXISTS signature_url     TEXT;
ALTER TABLE public.vet_profiles ADD COLUMN IF NOT EXISTS booking_enabled   BOOLEAN DEFAULT false;
ALTER TABLE public.vet_profiles ADD COLUMN IF NOT EXISTS booking_slug      TEXT UNIQUE;
ALTER TABLE public.vet_profiles ADD COLUMN IF NOT EXISTS available_days    TEXT[];
ALTER TABLE public.vet_profiles ADD COLUMN IF NOT EXISTS slot_duration_min INTEGER DEFAULT 30;

-- 4. Share token para prontuário público do pet
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_pets_share_token ON public.pets(share_token);

-- Qualquer pessoa pode ler pets pelo share_token (sem auth)
DROP POLICY IF EXISTS "public_read_by_share_token" ON public.pets;
CREATE POLICY "public_read_by_share_token" ON public.pets
  FOR SELECT USING (share_token IS NOT NULL);

-- 5. Solicitações de agendamento público (booking page)
CREATE TABLE IF NOT EXISTS public.vet_booking_requests (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vet_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_name    TEXT NOT NULL,
  tutor_phone   TEXT,
  tutor_email   TEXT,
  pet_name      TEXT NOT NULL,
  pet_species   TEXT,
  desired_date  DATE,
  desired_time  TEXT,
  type          TEXT DEFAULT 'consulta',
  message       TEXT,
  status        TEXT DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.vet_booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vet_sees_booking_requests" ON public.vet_booking_requests
  FOR ALL USING (vet_id = auth.uid());
-- Qualquer pessoa pode inserir (solicitação pública)
CREATE POLICY "public_can_request" ON public.vet_booking_requests
  FOR INSERT WITH CHECK (true);
