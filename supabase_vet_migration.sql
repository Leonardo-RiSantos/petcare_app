-- ============================================================
-- MIGRAÇÃO: Sistema Vet — Fase 2
-- Execute no Supabase SQL Editor APÓS supabase_vet_system.sql
-- ============================================================

-- 0. Campos adicionais no paciente avulso
ALTER TABLE public.vet_unlinked_patients ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 1. Tipo na billing (receita/despesa)
ALTER TABLE public.vet_billing ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'income';

-- 2. Solicitações de agendamento pelo tutor
ALTER TABLE public.vet_schedule ADD COLUMN IF NOT EXISTS requested_by_user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.vet_schedule ADD COLUMN IF NOT EXISTS request_message TEXT;
ALTER TABLE public.vet_schedule ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- 3. Logo da clínica no vet_profiles
ALTER TABLE public.vet_profiles ADD COLUMN IF NOT EXISTS clinic_logo_url TEXT;
ALTER TABLE public.vet_profiles ADD COLUMN IF NOT EXISTS clinic_phone TEXT;
ALTER TABLE public.vet_profiles ADD COLUMN IF NOT EXISTS clinic_website TEXT;

-- 4. Tutor pode ver agendamentos do seu pet E suas próprias solicitações
DROP POLICY IF EXISTS "tutor_sees_pet_schedule" ON public.vet_schedule;
CREATE POLICY "tutor_sees_pet_schedule" ON public.vet_schedule
  FOR SELECT USING (
    pet_id IN (SELECT id FROM public.pets WHERE user_id = auth.uid())
    OR requested_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "tutor_can_request_appointment" ON public.vet_schedule;
CREATE POLICY "tutor_can_request_appointment" ON public.vet_schedule
  FOR INSERT WITH CHECK (
    requested_by_user_id = auth.uid() AND
    status = 'pending_approval'
  );

-- 5. Tutor pode cancelar própria solicitação
CREATE POLICY "tutor_can_cancel_own_request" ON public.vet_schedule
  FOR UPDATE USING (
    requested_by_user_id = auth.uid() AND
    status = 'pending_approval'
  );
