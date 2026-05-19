-- Adiciona coluna de logo da clínica (executa mesmo se já existir)
ALTER TABLE public.vet_profiles
  ADD COLUMN IF NOT EXISTS clinic_logo_url TEXT;
