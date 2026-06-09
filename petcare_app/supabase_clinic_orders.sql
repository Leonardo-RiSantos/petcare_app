-- ═══════════════════════════════════════════════════════════════
-- PetCare+ Clínica — Ordens de Serviço (Vet → Recepção)
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Catálogo de serviços da clínica ───────────────────────
CREATE TABLE IF NOT EXISTS clinic_services (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name         text NOT NULL,
  category     text, -- 'consulta','exame','cirurgia','banho_tosa','vacina','outro'
  price        numeric(10,2) NOT NULL DEFAULT 0,
  duration_min integer,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clinic_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_members_services" ON clinic_services;
CREATE POLICY "clinic_members_services" ON clinic_services
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_clinic_services_clinic ON clinic_services (clinic_id);

-- ── 2. Ordem de serviço (vet cria, recepção fecha) ────────────
CREATE TABLE IF NOT EXISTS clinic_service_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  vet_id         uuid NOT NULL REFERENCES auth.users(id),
  pet_name       text NOT NULL,
  owner_name     text,
  pet_id         uuid REFERENCES pets(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'open', -- 'open' | 'closed' | 'cancelled'
  notes          text,
  total          numeric(10,2) NOT NULL DEFAULT 0,
  discount       numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text,
  closed_by      uuid REFERENCES auth.users(id),
  closed_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clinic_service_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_members_service_orders" ON clinic_service_orders;
CREATE POLICY "clinic_members_service_orders" ON clinic_service_orders
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_clinic_service_orders_clinic  ON clinic_service_orders (clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_service_orders_status  ON clinic_service_orders (clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_clinic_service_orders_vet     ON clinic_service_orders (vet_id);

-- ── 3. Itens da ordem ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_service_order_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES clinic_service_orders(id) ON DELETE CASCADE,
  item_type  text NOT NULL DEFAULT 'manual', -- 'product' | 'service' | 'manual'
  product_id uuid REFERENCES clinic_products(id),
  service_id uuid REFERENCES clinic_services(id),
  name       text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  quantity   numeric(10,3) NOT NULL DEFAULT 1,
  subtotal   numeric(10,2) NOT NULL
);

ALTER TABLE clinic_service_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_members_order_items" ON clinic_service_order_items;
CREATE POLICY "clinic_members_order_items" ON clinic_service_order_items
  FOR ALL USING (
    order_id IN (
      SELECT cso.id FROM clinic_service_orders cso
      JOIN clinic_members cm ON cm.clinic_id = cso.clinic_id
      WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
  );

-- ── 4. Função: fechar ordem de serviço (recepção) ────────────
CREATE OR REPLACE FUNCTION close_service_order(
  p_order_id       uuid,
  p_payment_method text,
  p_discount       numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_order  clinic_service_orders%ROWTYPE;
  v_total  numeric(10,2);
  v_sale_id uuid;
BEGIN
  SELECT * INTO v_order
  FROM clinic_service_orders
  WHERE id = p_order_id AND status = 'open';

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Ordem não encontrada ou já fechada.');
  END IF;

  -- Valida que o usuário é membro ativo com permissão para fechar
  IF NOT EXISTS (
    SELECT 1 FROM clinic_members
    WHERE clinic_id = v_order.clinic_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'receptionist', 'seller')
      AND status = 'active'
  ) THEN
    RETURN json_build_object('error', 'Sem permissão para fechar ordens de serviço.');
  END IF;

  -- Total a partir dos itens
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total
  FROM clinic_service_order_items WHERE order_id = p_order_id;

  v_total := GREATEST(0, v_total - COALESCE(p_discount, 0));

  -- Cria registro de venda
  INSERT INTO clinic_sales (
    clinic_id, seller_id, customer_name, patient_name,
    total, discount, payment_method, status
  )
  VALUES (
    v_order.clinic_id, auth.uid(), v_order.owner_name, v_order.pet_name,
    v_total, COALESCE(p_discount, 0), p_payment_method, 'completed'
  )
  RETURNING id INTO v_sale_id;

  -- Copia itens → sale_items (o trigger trg_deduct_sale_stock cuida do estoque)
  INSERT INTO clinic_sale_items (sale_id, product_id, name, unit_price, quantity, subtotal)
  SELECT v_sale_id, product_id, name, unit_price, quantity, subtotal
  FROM clinic_service_order_items
  WHERE order_id = p_order_id;

  -- Fecha a ordem
  UPDATE clinic_service_orders
  SET status         = 'closed',
      discount       = COALESCE(p_discount, 0),
      total          = v_total,
      payment_method = p_payment_method,
      closed_by      = auth.uid(),
      closed_at      = now()
  WHERE id = p_order_id;

  RETURN json_build_object('success', true, 'sale_id', v_sale_id, 'total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION close_service_order(uuid, text, numeric) TO authenticated;

-- ── 5. Função: cancelar ordem (vet ou admin) ─────────────────
CREATE OR REPLACE FUNCTION cancel_service_order(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_order clinic_service_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM clinic_service_orders WHERE id = p_order_id AND status = 'open';
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Ordem não encontrada ou já encerrada.');
  END IF;

  IF v_order.vet_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM clinic_members
    WHERE clinic_id = v_order.clinic_id AND user_id = auth.uid()
      AND role IN ('owner', 'admin') AND status = 'active'
  ) THEN
    RETURN json_build_object('error', 'Sem permissão para cancelar esta ordem.');
  END IF;

  UPDATE clinic_service_orders SET status = 'cancelled' WHERE id = p_order_id;
  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_service_order(uuid) TO authenticated;

-- ── 6. Prontuários: vets da clínica veem histórico de pets ───
-- Qualquer vet da clínica pode ver prontuários de pets que
-- já geraram ordem de serviço nesta clínica (histórico PetCare)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'medical_records' AND policyname = 'clinic_vets_read'
  ) THEN
    DROP POLICY "clinic_vets_read" ON medical_records;
  END IF;
END $$;

CREATE POLICY "clinic_vets_read" ON medical_records
  FOR SELECT USING (
    -- Próprios registros
    vet_id = auth.uid()
    -- Registros de outros vets da mesma clínica
    OR vet_id IN (
      SELECT vp.id FROM vet_profiles vp
      JOIN clinic_members cm ON cm.user_id = vp.id
      WHERE cm.status = 'active'
        AND cm.clinic_id IN (
          SELECT cm2.clinic_id FROM clinic_members cm2
          WHERE cm2.user_id = auth.uid() AND cm2.status = 'active'
        )
    )
    -- Pets que já passaram pela clínica (via ordem de serviço)
    OR pet_id IN (
      SELECT DISTINCT cso.pet_id
      FROM clinic_service_orders cso
      JOIN clinic_members cm ON cm.clinic_id = cso.clinic_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cso.pet_id IS NOT NULL
    )
  );

-- ── 7. Sementes: serviços padrão por clínica (opcional) ──────
-- Execute manualmente se quiser pré-popular os serviços de uma clínica:
-- INSERT INTO clinic_services (clinic_id, name, category, price)
-- VALUES
--   ('<clinic_id>', 'Consulta clínica', 'consulta', 120.00),
--   ('<clinic_id>', 'Banho pequeno porte', 'banho_tosa', 60.00),
--   ('<clinic_id>', 'Banho grande porte', 'banho_tosa', 100.00),
--   ('<clinic_id>', 'Tosa higiênica', 'banho_tosa', 45.00),
--   ('<clinic_id>', 'Vacinação V10', 'vacina', 85.00),
--   ('<clinic_id>', 'Exame de sangue', 'exame', 150.00),
--   ('<clinic_id>', 'Raio-X', 'exame', 200.00);
