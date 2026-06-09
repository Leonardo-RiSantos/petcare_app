-- ═══════════════════════════════════════════════════════════════
-- PetCare+ Clínica — Campos fiscais / NF-e
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS razao_social         text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual   text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal  text,
  ADD COLUMN IF NOT EXISTS regime_tributario    smallint DEFAULT 1,
  -- 1 = Simples Nacional
  -- 2 = Simples Nacional – excesso de sublimite
  -- 3 = Regime Normal (Lucro Presumido / Real)
  ADD COLUMN IF NOT EXISTS email_nfe            text;
