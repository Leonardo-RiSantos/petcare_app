-- ============================================================
-- FIX: Permitir que veterinários criem vínculos com pets
-- Execute no Supabase SQL Editor
-- ============================================================

-- Permite que o vet insira um link (vet_id = seu próprio user id)
DROP POLICY IF EXISTS "vet_can_link_pets" ON public.pet_vet_links;
CREATE POLICY "vet_can_link_pets" ON public.pet_vet_links
  FOR INSERT WITH CHECK (vet_id = auth.uid());

-- Permite que o vet veja seus próprios vínculos
DROP POLICY IF EXISTS "vet_sees_own_links" ON public.pet_vet_links;
CREATE POLICY "vet_sees_own_links" ON public.pet_vet_links
  FOR SELECT USING (vet_id = auth.uid());

-- Permite que o vet atualize seus próprios vínculos (reativação)
DROP POLICY IF EXISTS "vet_can_update_links" ON public.pet_vet_links;
CREATE POLICY "vet_can_update_links" ON public.pet_vet_links
  FOR UPDATE USING (vet_id = auth.uid());
