-- ============================================================
-- SISTEMA VETERINÁRIO COMPLETO
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Pacientes avulsos (não vinculados ao app)
CREATE TABLE IF NOT EXISTS public.vet_unlinked_patients (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vet_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  species         TEXT,
  breed           TEXT,
  birth_date      DATE,
  sex             TEXT,
  neutered        BOOLEAN DEFAULT false,
  weight_kg       DECIMAL(5,2),
  coat_color      TEXT,
  health_notes    TEXT,
  medications     TEXT,
  owner_name      TEXT,
  owner_phone     TEXT,
  owner_email     TEXT,
  linked_pet_id   UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Consultas estruturadas (prontuário digital)
CREATE TABLE IF NOT EXISTS public.vet_consultations (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vet_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id                UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  unlinked_patient_id   UUID REFERENCES public.vet_unlinked_patients(id) ON DELETE SET NULL,
  date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  type                  TEXT DEFAULT 'consulta',
  chief_complaint       TEXT,
  physical_exam         TEXT,
  diagnosis             TEXT,
  treatment_plan        TEXT,
  notes                 TEXT,
  weight_at_visit       DECIMAL(5,2),
  temperature           DECIMAL(4,1),
  visible_to_owner      BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- 3. Prescrições por consulta
CREATE TABLE IF NOT EXISTS public.vet_prescriptions (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id       UUID NOT NULL REFERENCES public.vet_consultations(id) ON DELETE CASCADE,
  vet_id                UUID NOT NULL REFERENCES auth.users(id),
  medication            TEXT NOT NULL,
  dosage                TEXT,
  frequency             TEXT,
  duration              TEXT,
  instructions          TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- 4. Agenda interna do veterinário
CREATE TABLE IF NOT EXISTS public.vet_schedule (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vet_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id                UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  unlinked_patient_id   UUID REFERENCES public.vet_unlinked_patients(id) ON DELETE SET NULL,
  owner_name            TEXT,
  patient_name          TEXT,
  scheduled_date        DATE NOT NULL,
  scheduled_time        TIME,
  duration_minutes      INTEGER DEFAULT 30,
  type                  TEXT DEFAULT 'consulta',
  status                TEXT DEFAULT 'scheduled',
  notes                 TEXT,
  internal_notes        TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- 5. Financeiro da clínica
CREATE TABLE IF NOT EXISTS public.vet_billing (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vet_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id                UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  unlinked_patient_id   UUID REFERENCES public.vet_unlinked_patients(id) ON DELETE SET NULL,
  consultation_id       UUID REFERENCES public.vet_consultations(id) ON DELETE SET NULL,
  patient_name          TEXT,
  description           TEXT NOT NULL,
  amount                DECIMAL(10,2) NOT NULL,
  status                TEXT DEFAULT 'pending',
  payment_method        TEXT,
  due_date              DATE,
  paid_at               DATE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.vet_unlinked_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_consultations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_prescriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_schedule          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_billing           ENABLE ROW LEVEL SECURITY;

-- Pacientes avulsos: vet vê e gerencia os seus
CREATE POLICY "vet_owns_unlinked_patients" ON public.vet_unlinked_patients
  USING (vet_id = auth.uid());

-- Consultas: vet vê as suas; tutor vê as do pet dele (visible_to_owner = true)
CREATE POLICY "vet_owns_consultations" ON public.vet_consultations
  FOR ALL USING (vet_id = auth.uid());

CREATE POLICY "tutor_sees_consultations" ON public.vet_consultations
  FOR SELECT USING (
    visible_to_owner = true AND pet_id IN (
      SELECT id FROM public.pets WHERE user_id = auth.uid()
    )
  );

-- Prescrições: via consulta
CREATE POLICY "vet_owns_prescriptions" ON public.vet_prescriptions
  FOR ALL USING (vet_id = auth.uid());

CREATE POLICY "tutor_sees_prescriptions" ON public.vet_prescriptions
  FOR SELECT USING (
    consultation_id IN (
      SELECT id FROM public.vet_consultations
      WHERE visible_to_owner = true
        AND pet_id IN (SELECT id FROM public.pets WHERE user_id = auth.uid())
    )
  );

-- Agenda: somente o vet
CREATE POLICY "vet_owns_schedule" ON public.vet_schedule
  USING (vet_id = auth.uid());

-- Financeiro: somente o vet
CREATE POLICY "vet_owns_billing" ON public.vet_billing
  USING (vet_id = auth.uid());

-- ── Índices para performance ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vet_unlinked_vet ON public.vet_unlinked_patients(vet_id);
CREATE INDEX IF NOT EXISTS idx_vet_consultations_vet ON public.vet_consultations(vet_id);
CREATE INDEX IF NOT EXISTS idx_vet_consultations_pet ON public.vet_consultations(pet_id);
CREATE INDEX IF NOT EXISTS idx_vet_schedule_vet ON public.vet_schedule(vet_id);
CREATE INDEX IF NOT EXISTS idx_vet_schedule_date ON public.vet_schedule(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_vet_billing_vet ON public.vet_billing(vet_id);
CREATE INDEX IF NOT EXISTS idx_vet_billing_status ON public.vet_billing(status);
