-- ============================================================
-- FIX: Veterinário pode ler pets vinculados a ele
-- Necessário para o join pets em pet_vet_links funcionar
-- Execute no Supabase SQL Editor
-- ============================================================

-- Vet pode ver os dados dos pets que estão vinculados a ele
DROP POLICY IF EXISTS "vet_can_read_linked_pets" ON public.pets;
CREATE POLICY "vet_can_read_linked_pets" ON public.pets
  FOR SELECT USING (
    id IN (
      SELECT pet_id FROM public.pet_vet_links
      WHERE vet_id = auth.uid() AND status = 'active'
    )
  );
