import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

let Notifications;
try { Notifications = require('expo-notifications'); } catch (_) {}

// Registra o token do dispositivo no Supabase
export async function registerPushToken(userId) {
  if (!Notifications || Platform.OS === 'web') return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync();
    if (!tokenData) return;

    await supabase.from('push_tokens').upsert(
      { user_id: userId, token: tokenData, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'token' }
    );
  } catch (e) {
    console.warn('[pushService] register error:', e);
  }
}

// Busca o token do destinatário e envia uma notificação
export async function sendPushToUser(targetUserId, { title, body, data = {} }) {
  try {
    const { data: rows } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', targetUserId)
      .limit(1);
    const token = rows?.[0]?.token;
    if (!token) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
    });
  } catch (e) {
    console.warn('[pushService] send error:', e);
  }
}
