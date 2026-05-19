-- ============================================================
-- FIX: Evolução (weight_records) + Consultas para o tutor
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. weight_records: tutor vê TODOS os registros do pet (tutor + vet)
DROP POLICY IF EXISTS "Users manage own weight records" ON public.weight_records;
DROP POLICY IF EXISTS "tutor_sees_all_pet_weight_records" ON public.weight_records;

CREATE POLICY "tutor_sees_all_pet_weight_records"
  ON public.weight_records FOR SELECT
  USING (
    user_id = auth.uid()
    OR pet_id IN (SELECT id FROM public.pets WHERE user_id = auth.uid())
  );

-- 2. weight_records: tutor insere próprios registros
DROP POLICY IF EXISTS "tutor_can_insert_weight" ON public.weight_records;
CREATE POLICY "tutor_can_insert_weight"
  ON public.weight_records FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 3. weight_records: vet insere para pets vinculados
DROP POLICY IF EXISTS "vet_can_insert_weight_records" ON public.weight_records;
CREATE POLICY "vet_can_insert_weight_records"
  ON public.weight_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pet_vet_links
      WHERE pet_vet_links.pet_id = weight_records.pet_id
        AND pet_vet_links.vet_id = auth.uid()
        AND pet_vet_links.status = 'active'
    )
  );

-- 4. vet_consultations: tutor vê consultas marcadas como visíveis
DROP POLICY IF EXISTS "tutor_can_read_visible_consultations" ON public.vet_consultations;
CREATE POLICY "tutor_can_read_visible_consultations"
  ON public.vet_consultations FOR SELECT
  USING (
    vet_id = auth.uid()
    OR (
      visible_to_owner = true
      AND pet_id IN (SELECT id FROM public.pets WHERE user_id = auth.uid())
    )
  );
