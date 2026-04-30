-- Campos extras do pet: personalidade, cor da pelagem e espécie personalizada
-- Execute no SQL Editor do Supabase

ALTER TABLE pets ADD COLUMN IF NOT EXISTS personality text[] DEFAULT '{}';
ALTER TABLE pets ADD COLUMN IF NOT EXISTS coat_color text;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS custom_species text;
