-- ============================================================
-- Documentos clínicos salvos na nuvem + Admin de vets
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Tabela de documentos gerados pelo veterinário
CREATE TABLE IF NOT EXISTS public.vet_documents (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vet_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id       UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  type         TEXT NOT NULL, -- 'receita' | 'atestado' | 'declaracao'
  title        TEXT,
  patient_name TEXT,
  content_json JSONB,         -- campos do documento (medicamentos, texto, etc.)
  vet_snapshot JSONB,         -- nome/CRM/clínica na hora da emissão
  html_content TEXT,          -- HTML completo para reprodução fiel
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vet_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vet_manages_documents"     ON public.vet_documents;
DROP POLICY IF EXISTS "tutor_reads_pet_documents" ON public.vet_documents;

CREATE POLICY "vet_manages_documents"
  ON public.vet_documents FOR ALL
  USING (vet_id = auth.uid())
  WITH CHECK (vet_id = auth.uid());

CREATE POLICY "tutor_reads_pet_documents"
  ON public.vet_documents FOR SELECT
  USING (
    pet_id IN (SELECT id FROM public.pets WHERE user_id = auth.uid())
  );

-- 2. Campo is_admin em profiles (para tela de aprovação)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 3. Define admin pelo email (ajuste o email se necessário)
UPDATE public.profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'leonardo.rb94@gmail.com'
);

-- 4. Função para aprovar veterinário (admin only)
CREATE OR REPLACE FUNCTION approve_vet(p_vet_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Só admin pode chamar
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem aprovar veterinários.';
  END IF;

  UPDATE public.vet_profiles
  SET status = 'approved', validated_at = now()
  WHERE id = p_vet_id;
END;
$$;

-- 5. Função para rejeitar veterinário (admin only)
CREATE OR REPLACE FUNCTION reject_vet(p_vet_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE public.vet_profiles
  SET status = 'rejected', validated_at = now()
  WHERE id = p_vet_id;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_vet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_vet(UUID) TO authenticated;

-- Admin pode ler todos os vet_profiles (para tela de aprovação)
DROP POLICY IF EXISTS "admin_reads_all_vet_profiles" ON public.vet_profiles;
CREATE POLICY "admin_reads_all_vet_profiles"
  ON public.vet_profiles FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (
      SELECT 1 FROM public.pet_vet_links pvl
      JOIN public.pets p ON p.id = pvl.pet_id
      WHERE pvl.vet_id = vet_profiles.id AND pvl.status = 'active' AND p.user_id = auth.uid()
    )
  );
