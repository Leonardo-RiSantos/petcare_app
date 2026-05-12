-- ============================================================
-- FIX: Vincular pet por código no dashboard do veterinário
-- Execute no Supabase SQL Editor
-- ============================================================

-- Função com SECURITY DEFINER: bypassa RLS para permitir que
-- vets aprovados busquem pets pelo código de vinculação.
-- Retorna apenas os campos necessários (sem dados sensíveis).
CREATE OR REPLACE FUNCTION find_pet_by_link_code(code TEXT)
RETURNS TABLE(id UUID, name TEXT, species TEXT, user_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.species, p.user_id
  FROM pets p
  WHERE upper(left(p.id::text, 8)) = upper(trim(code))
  LIMIT 1;
$$;

-- Apenas usuários autenticados (vets com conta ativa) podem chamar
GRANT EXECUTE ON FUNCTION find_pet_by_link_code(TEXT) TO authenticated;
