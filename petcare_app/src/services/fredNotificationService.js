import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateDistance } from '../utils/distanceUtils';
import { CATEGORY_CONFIG } from './placesService';

const PROXIMITY_M       = 400;   // raio de notificação (metros)
const GLOBAL_COOLDOWN_H = 4;     // horas entre notificações globais
const PLACE_COOLDOWN_H  = 24;    // horas por local específico

const MESSAGES = {
  vet: [
    'Ei, tem uma clínica veterinária pertinho daqui. Quer dar uma olhada? 🐾',
    'Uma clinica vet bem do lado! Boa hora pra agendar aquela consulta do seu pet 🏥',
  ],
  pet_shop: [
    'Passando perto de um pet shop! Pode ser útil se precisar de ração ou petiscos.',
    'Pet shop nas redondezas 🛒 Aproveita pra estocar os petiscos favoritos!',
  ],
  pet_friendly: [
    'Esse lugar parece pet friendly. Talvez seu pet curta passear por aqui 🐶',
    'Local pet friendly perto! Que tal uma saída especial com seu pet hoje? 🐾',
  ],
};

// Configuração inicial das notificações (chamar 1x na abertura do app)
export async function setupNotifications() {
  if (Platform.OS === 'web') return false;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// Verifica proximidade e dispara notificação in-app via Fred (bolinha de fala)
// Retorna { shouldShow: bool, message: string, place: object } ou null
export async function checkProximityNotification(userLat, userLng, places, isMapActive = false) {
  if (isMapActive) return null; // não incomoda enquanto o usuário usa o mapa

  // Cooldown global
  const lastGlobal = await safeGet('fred_prox_global');
  if (lastGlobal) {
    const h = (Date.now() - Number(lastGlobal)) / 3600000;
    if (h < GLOBAL_COOLDOWN_H) return null;
  }

  // Verifica se notificações estão desativadas
  const disabled = await safeGet('fred_prox_disabled');
  if (disabled === '1') return null;

  for (const place of places) {
    const dist = calculateDistance(userLat, userLng, place.latitude, place.longitude);
    if (dist > PROXIMITY_M) continue;

    // Cooldown por local
    const placeKey = `fred_prox_${place.id}`;
    const lastPlace = await safeGet(placeKey);
    if (lastPlace) {
      const h = (Date.now() - Number(lastPlace)) / 3600000;
      if (h < PLACE_COOLDOWN_H) continue;
    }

    // Escolhe mensagem aleatória da categoria
    const msgs = MESSAGES[place.category] || ['Um local pet perto! 🐾'];
    const msg  = msgs[Math.floor(Math.random() * msgs.length)];

    // Persiste cooldowns
    await safeSet('fred_prox_global', String(Date.now()));
    await safeSet(placeKey, String(Date.now()));

    // No mobile, dispara push também
    if (Platform.OS !== 'web') {
      try {
        const Notifications = await import('expo-notifications');
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Fred 🐱', body: msg },
          trigger: null,
        });
      } catch {}
    }

    return { shouldShow: true, message: msg, place };
  }
  return null;
}

// Ativa/desativa notificações de proximidade
export async function setProximityNotificationsEnabled(enabled) {
  await safeSet('fred_prox_disabled', enabled ? '0' : '1');
}

export async function isProximityNotificationsEnabled() {
  const v = await safeGet('fred_prox_disabled');
  return v !== '1';
}

// Helpers AsyncStorage com fallback web
async function safeGet(key) {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return AsyncStorage.getItem(key);
}

async function safeSet(key, val) {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, val); } catch {}
    return;
  }
  return AsyncStorage.setItem(key, val);
}
