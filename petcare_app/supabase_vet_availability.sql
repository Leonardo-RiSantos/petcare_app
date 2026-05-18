-- ============================================================
-- Disponibilidade do veterinário + RLS
-- Execute no Supabase SQL Editor
-- ============================================================

-- Slots de disponibilidade semanal (recorrente por dia da semana)
CREATE TABLE IF NOT EXISTS public.vet_availability (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vet_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom, 1=Seg ... 6=Sáb
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  slot_minutes INTEGER DEFAULT 30,  -- duração de cada slot
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vet_id, day_of_week, start_time)
);

ALTER TABLE public.vet_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vet gerencia própria disponibilidade" ON public.vet_availability;
CREATE POLICY "Vet gerencia própria disponibilidade"
  ON public.vet_availability FOR ALL
  USING (vet_id = auth.uid())
  WITH CHECK (vet_id = auth.uid());

-- Tutores podem ler a disponibilidade dos vets vinculados aos seus pets
DROP POLICY IF EXISTS "Tutor lê disponibilidade de vets vinculados" ON public.vet_availability;
CREATE POLICY "Tutor lê disponibilidade de vets vinculados"
  ON public.vet_availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pet_vet_links pvl
      JOIN public.pets p ON p.id = pvl.pet_id
      WHERE pvl.vet_id = vet_availability.vet_id
        AND pvl.status = 'active'
        AND p.user_id = auth.uid()
    )
  );

-- Função: retorna slots disponíveis de um vet para os próximos N dias
-- Subtrai os slots já agendados (qualquer status != cancelled)
CREATE OR REPLACE FUNCTION get_vet_available_slots(
  p_vet_id UUID,
  p_days   INTEGER DEFAULT 14
)
RETURNS TABLE(
  slot_date  DATE,
  slot_time  TIME,
  day_label  TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cur_date DATE := CURRENT_DATE;
  end_date DATE := CURRENT_DATE + p_days;
  r        RECORD;
  slot_ts  TIME;
BEGIN
  WHILE cur_date <= end_date LOOP
    FOR r IN
      SELECT * FROM vet_availability
      WHERE vet_id = p_vet_id
        AND day_of_week = EXTRACT(DOW FROM cur_date)::SMALLINT
        AND active = true
    LOOP
      slot_ts := r.start_time;
      WHILE slot_ts < r.end_time LOOP
        -- Verifica se o slot já está ocupado (agendado/pendente)
        IF NOT EXISTS (
          SELECT 1 FROM vet_schedule vs
          WHERE vs.vet_id = p_vet_id
            AND vs.scheduled_date = cur_date
            AND vs.scheduled_time = slot_ts
            AND vs.status NOT IN ('cancelled', 'no_show')
        ) THEN
          slot_date := cur_date;
          slot_time := slot_ts;
          day_label := TO_CHAR(cur_date, 'DD/MM') || ' (' ||
            CASE EXTRACT(DOW FROM cur_date)::SMALLINT
              WHEN 0 THEN 'Dom' WHEN 1 THEN 'Seg' WHEN 2 THEN 'Ter'
              WHEN 3 THEN 'Qua' WHEN 4 THEN 'Qui' WHEN 5 THEN 'Sex' WHEN 6 THEN 'Sáb'
            END || ')';
          RETURN NEXT;
        END IF;
        slot_ts := slot_ts + (r.slot_minutes || ' minutes')::INTERVAL;
      END LOOP;
    END LOOP;
    cur_date := cur_date + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION get_vet_available_slots(UUID, INTEGER) TO authenticated;
