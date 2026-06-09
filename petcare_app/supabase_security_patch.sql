-- ═══════════════════════════════════════════════════════════════
-- PetCare+ — Security Patch
-- Execute no SQL Editor do Supabase (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════


-- ── PATCH 1: Bloquear auto-escalada para is_admin ─────────────
-- O policy anterior permitia qualquer user atualizar is_admin = true
-- no próprio perfil. Agora is_admin só pode ser mudado por um admin
-- via função SECURITY DEFINER.

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- is_admin não pode ser alterado por usuários comuns:
    -- o novo valor de is_admin deve ser igual ao valor atual
    AND is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
  );

-- Função privilegiada para admin setar/remover admin (única forma de mudar is_admin)
CREATE OR REPLACE FUNCTION set_admin(p_user_id uuid, p_value boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  UPDATE public.profiles SET is_admin = p_value WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_admin(uuid, boolean) TO authenticated;


-- ── PATCH 2: approve_vet sincroniza profiles.plan ─────────────
-- Antes o approve_vet só alterava vet_profiles.status.
-- O can_add_pet() e outras RLS checam profiles.plan,
-- então vets aprovados ficavam bloqueados de adicionar pets.

CREATE OR REPLACE FUNCTION approve_vet(p_vet_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem aprovar veterinários.';
  END IF;

  UPDATE public.vet_profiles
  SET status = 'approved', validated_at = now()
  WHERE id = p_vet_id;

  -- Garante que a RLS server-side reconhece o plano vet
  UPDATE public.profiles
  SET plan = 'vet', plan_expires_at = NULL
  WHERE id = p_vet_id;
END;
$$;

CREATE OR REPLACE FUNCTION reject_vet(p_vet_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE public.vet_profiles
  SET status = 'rejected', validated_at = now()
  WHERE id = p_vet_id;

  -- Revoga o plano vet se for o caso
  UPDATE public.profiles
  SET plan = 'basic', plan_expires_at = NULL
  WHERE id = p_vet_id AND plan = 'vet';
END;
$$;

GRANT EXECUTE ON FUNCTION approve_vet(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION reject_vet(UUID)   TO authenticated;


-- ── PATCH 3: can_add_pet() reconhece vets e expiration ────────
CREATE OR REPLACE FUNCTION can_add_pet()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Plano premium ou vet ativo (sem expiração ou dentro do prazo)
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND plan IN ('premium', 'vet')
        AND (
          plan_expires_at IS NULL
          OR plan_expires_at::date >= current_date
        )
    )
    -- Vet aprovado sempre pode (independente do plan no profiles)
    OR EXISTS (
      SELECT 1 FROM public.vet_profiles
      WHERE id = auth.uid() AND status = 'approved'
    )
    -- Básico pode ter apenas 1 pet
    OR (SELECT COUNT(*) FROM public.pets WHERE user_id = auth.uid()) < 1;
$$;


-- ── PATCH 4: pet_viewers — incluir plano 'vet' e expiration ───
DROP POLICY IF EXISTS "Owner gerencia viewers" ON public.pet_viewers;

CREATE POLICY "Owner gerencia viewers"
  ON public.pet_viewers FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      -- Plano pago dentro do prazo
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND plan IN ('premium', 'vet')
          AND (plan_expires_at IS NULL OR plan_expires_at::date >= current_date)
      )
      -- Ou vet aprovado
      OR EXISTS (
        SELECT 1 FROM public.vet_profiles WHERE id = auth.uid() AND status = 'approved'
      )
    )
    AND (
      SELECT COUNT(*) FROM public.pet_viewers
      WHERE owner_id = auth.uid() AND status != 'removed'
    ) < 2
  );


-- ── PATCH 5: pet_vet_links — incluir plano 'vet' do tutor ─────
DROP POLICY IF EXISTS "Vet insere vínculo" ON public.pet_vet_links;

CREATE POLICY "Vet insere vínculo"
  ON public.pet_vet_links FOR INSERT
  WITH CHECK (
    vet_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = tutor_id
        AND plan IN ('premium', 'vet')
        AND (plan_expires_at IS NULL OR plan_expires_at::date >= current_date)
    )
  );


-- ── PATCH 6: invite_clinic_member — whitelist de roles ────────
CREATE OR REPLACE FUNCTION invite_clinic_member(
  p_clinic_id uuid,
  p_email     text,
  p_role      text DEFAULT 'vet'
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id   uuid;
  v_member_id uuid;
BEGIN
  -- Valida role permitido (owner não pode ser atribuído por convite)
  IF p_role NOT IN ('vet', 'admin', 'receptionist', 'seller') THEN
    RETURN json_build_object('error', 'Papel inválido. Use: vet, admin, receptionist ou seller.');
  END IF;

  -- Só owner ou admin pode convidar
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = p_clinic_id AND user_id = auth.uid()
      AND role IN ('owner', 'admin') AND status = 'active'
  ) THEN
    RETURN json_build_object('error', 'Sem permissão para convidar membros.');
  END IF;

  -- Apenas owner pode convidar admin
  IF p_role = 'admin' AND NOT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = p_clinic_id AND user_id = auth.uid()
      AND role = 'owner' AND status = 'active'
  ) THEN
    RETURN json_build_object('error', 'Somente o proprietário pode convidar administradores.');
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users WHERE email = lower(p_email);

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Usuário não encontrado. Peça que ele se cadastre no PetCare+ primeiro.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = p_clinic_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('error', 'Este usuário já é membro ou tem convite pendente.');
  END IF;

  INSERT INTO public.clinic_members (clinic_id, user_id, role, status, invited_by)
  VALUES (p_clinic_id, v_user_id, p_role, 'pending', auth.uid())
  RETURNING id INTO v_member_id;

  RETURN json_build_object('success', true, 'member_id', v_member_id);
END;
$$;


-- ── PATCH 7: Backfill — vets aprovados que já existem ─────────
-- Garante que vets que foram aprovados antes do patch
-- tenham profiles.plan = 'vet' no banco.
UPDATE public.profiles p
SET plan = 'vet', plan_expires_at = NULL
FROM public.vet_profiles vp
WHERE vp.id = p.id AND vp.status = 'approved' AND p.plan != 'vet';
