-- ═══════════════════════════════════════════════════════════════
-- SETUP DO STORAGE DE FOTOS DE PETS
-- ═══════════════════════════════════════════════════════════════
-- 1. Antes de executar este SQL, crie o bucket manualmente:
--    Supabase Dashboard → Storage → New bucket
--    Nome: pet-photos
--    Marque: "Public bucket" (para URLs públicas)
--
-- 2. Depois execute este SQL para as políticas de segurança:
-- ═══════════════════════════════════════════════════════════════

-- Adiciona coluna de foto no banco
ALTER TABLE pets ADD COLUMN IF NOT EXISTS photo_url text;

-- Políticas do bucket pet-photos
-- (Supabase já cria automaticamente para buckets públicos,
--  mas se precisar recriar manualmente:)

-- Leitura pública (qualquer um pode ver as fotos)
CREATE POLICY "Pet photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'pet-photos');

-- Upload: apenas o dono do pet pode fazer upload
CREATE POLICY "Users can upload their pet photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pet-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Atualizar: apenas o dono pode substituir a foto
CREATE POLICY "Users can update their pet photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pet-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Deletar: apenas o dono pode remover
CREATE POLICY "Users can delete their pet photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pet-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
