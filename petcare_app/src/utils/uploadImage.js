import { supabase } from '../lib/supabase';

/**
 * Upload universal — funciona em React Native (iOS/Android) e Web.
 * Usa fetch+blob em vez de FormData (FormData com {uri,name,type} só funciona no native).
 *
 * @param {string} uri  - URI local da imagem (file://, content://, blob:, data:)
 * @param {string} bucket - Nome do bucket no Supabase Storage
 * @param {string} path   - Caminho dentro do bucket (ex: "user123/avatar.jpg")
 * @returns {string} publicUrl com cache-buster
 */
export async function uploadImage(uri, bucket, path) {
  const response = await fetch(uri);
  const blob = await response.blob();

  // Detecta o content-type real do arquivo (jpeg, png, webp, etc.)
  const contentType = blob.type && blob.type !== 'application/octet-stream'
    ? blob.type
    : 'image/jpeg';

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType, upsert: true });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  // Cache-buster para forçar recarga da imagem após atualização
  return `${publicUrl}?t=${Date.now()}`;
}

/**
 * Abre o seletor de imagem da galeria.
 * Compatível com Expo SDK 52+ (MediaType.Images substitui o deprecado MediaTypeOptions.Images).
 */
export async function pickImage() {
  const ImagePicker = await import('expo-image-picker');

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.75,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}
