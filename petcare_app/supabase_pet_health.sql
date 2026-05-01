-- Campos de saúde do pet: notas e medicamentos
-- Execute no SQL Editor do Supabase

ALTER TABLE pets ADD COLUMN IF NOT EXISTS health_notes text;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS medications text;
