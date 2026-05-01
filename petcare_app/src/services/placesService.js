// Google Places API — Nearby Search
// Configure a chave em .env: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const BASE    = 'https://maps.googleapis.com/maps/api/place';

export const CATEGORY_CONFIG = {
  vet: {
    label:   'Veterinários',
    emoji:   '🏥',
    color:   '#F43F5E',
    bg:      '#FFF1F2',
    params:  { type: 'veterinary_care' },
  },
  pet_shop: {
    label:   'Pet Shops',
    emoji:   '🛒',
    color:   '#F59E0B',
    bg:      '#FFFBEB',
    params:  { type: 'pet_store' },
  },
  pet_friendly: {
    label:   'Pet Friendly',
    emoji:   '🐾',
    color:   '#0EA5E9',
    bg:      '#EFF6FF',
    params:  { keyword: 'pet friendly', type: 'establishment' },
  },
};

function mapPlace(raw, category) {
  return {
    id:               raw.place_id,
    name:             raw.name,
    category,
    address:          raw.vicinity || '',
    latitude:         raw.geometry?.location?.lat ?? 0,
    longitude:        raw.geometry?.location?.lng ?? 0,
    rating:           raw.rating ?? null,
    userRatingsTotal: raw.user_ratings_total ?? 0,
    isOpenNow:        raw.opening_hours?.open_now ?? null,
    googleMapsUrl:    `https://www.google.com/maps/place/?q=place_id:${raw.place_id}`,
    phone:            null,   // preenchido por getPlaceDetails
    distance:         null,   // preenchido por sortByDistance
  };
}

export async function searchNearbyPlaces(lat, lng, category = 'all', radius = 3000) {
  if (!API_KEY) return { places: [], error: 'API_KEY_MISSING' };

  const cats = category === 'all' ? Object.keys(CATEGORY_CONFIG) : [category];
  const all  = [];

  for (const cat of cats) {
    const { params } = CATEGORY_CONFIG[cat];
    const qs = new URLSearchParams({
      location: `${lat},${lng}`,
      radius:   String(radius),
      key:      API_KEY,
      language: 'pt-BR',
      ...params,
    });

    try {
      const res  = await fetch(`${BASE}/nearbysearch/json?${qs}`);
      const data = await res.json();

      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        all.push(...(data.results || []).map(r => mapPlace(r, cat)));
      }
    } catch {
      // se uma categoria falhar, continua com as outras
    }
  }

  return { places: all, error: null };
}

export async function getPlaceDetails(placeId) {
  if (!API_KEY) return null;
  const qs = new URLSearchParams({
    place_id: placeId,
    fields:   'formatted_phone_number,international_phone_number,opening_hours,website',
    key:      API_KEY,
    language: 'pt-BR',
  });
  try {
    const res  = await fetch(`${BASE}/details/json?${qs}`);
    const data = await res.json();
    if (data.status !== 'OK') return null;
    return {
      phone:        data.result?.formatted_phone_number ?? null,
      openingHours: data.result?.opening_hours?.weekday_text ?? null,
      isOpenNow:    data.result?.opening_hours?.open_now ?? null,
      website:      data.result?.website ?? null,
    };
  } catch {
    return null;
  }
}

// Sem API key: retorna locais fictícios para demo na web
export function getDemoPlaces(lat, lng) {
  const offset = () => (Math.random() - 0.5) * 0.02;
  return [
    { id: 'demo1', name: 'Clínica Vet Amigo Fiel',  category: 'vet',          address: 'Rua das Flores, 123',     latitude: lat + offset(), longitude: lng + offset(), rating: 4.7, userRatingsTotal: 128, isOpenNow: true,  googleMapsUrl: '#', phone: null, distance: null },
    { id: 'demo2', name: 'PetShop Feliz',            category: 'pet_shop',     address: 'Av. Principal, 456',      latitude: lat + offset(), longitude: lng + offset(), rating: 4.4, userRatingsTotal: 87,  isOpenNow: true,  googleMapsUrl: '#', phone: null, distance: null },
    { id: 'demo3', name: 'Parque Pet Friendly',      category: 'pet_friendly', address: 'Rua do Parque, s/n',      latitude: lat + offset(), longitude: lng + offset(), rating: 4.9, userRatingsTotal: 312, isOpenNow: true,  googleMapsUrl: '#', phone: null, distance: null },
    { id: 'demo4', name: 'Hospital Veterinário 24h', category: 'vet',          address: 'Rua da Saúde, 789',       latitude: lat + offset(), longitude: lng + offset(), rating: 4.8, userRatingsTotal: 204, isOpenNow: true,  googleMapsUrl: '#', phone: null, distance: null },
    { id: 'demo5', name: 'Mundo dos Pets',           category: 'pet_shop',     address: 'Av. Comercial, 321',      latitude: lat + offset(), longitude: lng + offset(), rating: 4.2, userRatingsTotal: 56,  isOpenNow: false, googleMapsUrl: '#', phone: null, distance: null },
    { id: 'demo6', name: 'Café com Pets',            category: 'pet_friendly', address: 'Rua Aconchegante, 11',    latitude: lat + offset(), longitude: lng + offset(), rating: 4.6, userRatingsTotal: 91,  isOpenNow: true,  googleMapsUrl: '#', phone: null, distance: null },
  ];
}
