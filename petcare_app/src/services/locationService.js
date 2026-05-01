import * as Location from 'expo-location';
import { Platform } from 'react-native';

export const LOCATION_STATUS = {
  LOADING:  'loading',
  GRANTED:  'granted',
  DENIED:   'denied',
  UNAVAILABLE: 'unavailable',
};

// Solicita permissão e retorna o status
export async function requestLocationPermission() {
  if (Platform.OS === 'web') return LOCATION_STATUS.UNAVAILABLE;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted' ? LOCATION_STATUS.GRANTED : LOCATION_STATUS.DENIED;
  } catch {
    return LOCATION_STATUS.UNAVAILABLE;
  }
}

// Retorna { latitude, longitude } ou null
export async function getCurrentLocation() {
  if (Platform.OS === 'web') return null;
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return null;
  }
}

// Assina atualizações de localização — retorna a função de cancelamento
export async function watchLocation(onUpdate, distanceInterval = 50) {
  if (Platform.OS === 'web') return () => {};
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval },
    loc => onUpdate({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
  );
  return () => sub.remove();
}
