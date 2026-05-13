-- ============================================================
-- Adiciona campos de evolução à tabela weight_records
-- Execute no Supabase SQL Editor
-- ============================================================

ALTER TABLE public.weight_records
  ADD COLUMN IF NOT EXISTS height_cm   NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS length_cm   NUMERIC(6,2);

-- RLS: vet pode inserir registros de peso nos pets vinculados
DROP POLICY IF EXISTS "Vet insere peso de pets vinculados" ON weight_records;
CREATE POLICY "Vet insere peso de pets vinculados"
  ON weight_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pet_vet_links
      WHERE pet_vet_links.pet_id = weight_records.pet_id
        AND pet_vet_links.vet_id = auth.uid()
        AND pet_vet_links.status = 'active'
    )
  );
