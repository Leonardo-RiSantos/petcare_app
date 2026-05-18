-- ============================================================
-- FIX: Veterinário pode ler nome dos tutores vinculados
-- Necessário para mostrar nome do tutor nos cards de paciente e chat
-- Execute no Supabase SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "vet_can_read_linked_tutor_profiles" ON public.profiles;

CREATE POLICY "vet_can_read_linked_tutor_profiles"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT tutor_id FROM public.pet_vet_links
      WHERE vet_id = auth.uid()
    )
  );
