import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * Upload universal — funciona em React Native (iOS/Android) e Web.
 */
export async function uploadImage(uri, bucket, path) {
  const response = await fetch(uri);
  const blob = await response.blob();

  const contentType = blob.type && blob.type !== 'application/octet-stream'
    ? blob.type
    : 'image/jpeg';

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType, upsert: true });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${publicUrl}?t=${Date.now()}`;
}

/**
 * Abre seletor de imagem.
 * No Web usa <input type="file"> nativo para garantir que o browser
 * abra o seletor (o expo-image-picker perde o contexto de gesto em chains async).
 */
export function pickImage(options = {}) {
  if (Platform.OS === 'web') {
    return pickImageWeb({ accept: 'image/*', ...options });
  }
  return pickImageNative(options);
}

function pickImageWeb({ accept = 'image/*' } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = (e) => {
      const file = e.target.files?.[0];
      document.body.removeChild(input);
      if (!file) { resolve(null); return; }
      // Cria object URL para o arquivo — funciona como URI no uploadImage()
      resolve(URL.createObjectURL(file));
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };

    // Alguns browsers precisam que o input esteja no DOM antes de .click()
    setTimeout(() => input.click(), 0);
  });
}

async function pickImageNative(options = {}) {
  const ImagePicker = await import('expo-image-picker');

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: options.allowsEditing !== false,
    aspect: options.aspect || [1, 1],
    quality: options.quality || 0.75,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}
