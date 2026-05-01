// ── Serviço de locais pet ─────────────────────────────────────────────────────
// Fonte primária: Overpass API (OpenStreetMap) — 100% gratuita, sem API key
// Fonte secundária: Google Places API — opcional, configure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
// Fallback: dados demo para desenvolvimento

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api/place';

export const CATEGORY_CONFIG = {
  vet: {
    label:  'Veterinários',
    emoji:  '🏥',
    color:  '#F43F5E',
    bg:     '#FFF1F2',
  },
  pet_shop: {
    label:  'Pet Shops',
    emoji:  '🛒',
    color:  '#F59E0B',
    bg:     '#FFFBEB',
  },
  pet_friendly: {
    label:  'Pet Friendly',
    emoji:  '🐾',
    color:  '#0EA5E9',
    bg:     '#EFF6FF',
  },
};

// ── Tags OSM por categoria ────────────────────────────────────────────────────
const OSM_TAGS = {
  vet:          [['amenity', 'veterinary']],
  pet_shop:     [['shop', 'pet']],
  pet_friendly: [['dog', 'yes'], ['dog', 'leashed']],
};

// ── Overpass API ──────────────────────────────────────────────────────────────
function buildOverpassQuery(lat, lng, radius, tagPairs) {
  const filters = tagPairs
    .map(([k, v]) => `["${k}"="${v}"]`)
    .join('');
  return `[out:json][timeout:25];(
    node${filters}(around:${radius},${lat},${lng});
    way${filters}(around:${radius},${lat},${lng});
  );out center;`;
}

async function overpassFetch(query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // tenta próximo mirror
    }
  }
  return null;
}

function osmToPlace(el, category) {
  const t = el.tags || {};
  const lat = el.type === 'node' ? el.lat : el.center?.lat;
  const lng = el.type === 'node' ? el.lon : el.center?.lon;
  if (!lat || !lng) return null;

  const street = t['addr:street'] || '';
  const num    = t['addr:housenumber'] || '';
  const city   = t['addr:city'] || '';
  const address = [street + (num ? `, ${num}` : ''), city].filter(Boolean).join(' — ') || t.name || '';

  const phone = t.phone || t['contact:phone'] || t['contact:mobile'] || null;
  const website = t.website || t['contact:website'] || null;

  return {
    id:               `osm_${el.type}_${el.id}`,
    name:             t.name || CATEGORY_CONFIG[category]?.label || 'Local pet',
    category,
    address,
    latitude:         lat,
    longitude:        lng,
    rating:           null,       // OSM não tem avaliações
    userRatingsTotal: 0,
    isOpenNow:        null,       // depende de parsing de opening_hours
    openingHours:     t['opening_hours'] ? [t['opening_hours']] : null,
    googleMapsUrl:    `https://www.openstreetmap.org/${el.type}/${el.id}`,
    phone,
    website,
    distance:         null,
  };
}

async function searchOverpass(lat, lng, category, radius) {
  const cats = category === 'all' ? Object.keys(OSM_TAGS) : [category];
  const results = [];

  for (const cat of cats) {
    const tagPairs = OSM_TAGS[cat];

    // Para pet_friendly precisamos de uma query OR: dog=yes OU dog=leashed
    if (cat === 'pet_friendly') {
      // Manda uma query combinada
      const combined = `[out:json][timeout:25];(
        node["dog"="yes"](around:${radius},${lat},${lng});
        way["dog"="yes"](around:${radius},${lat},${lng});
        node["dog"="leashed"](around:${radius},${lat},${lng});
        way["dog"="leashed"](around:${radius},${lat},${lng});
      );out center;`;
      const data = await overpassFetch(combined);
      if (data?.elements) {
        results.push(
          ...data.elements
            .map(el => osmToPlace(el, cat))
            .filter(Boolean)
        );
      }
    } else {
      for (const pair of tagPairs) {
        const query = buildOverpassQuery(lat, lng, radius, [pair]);
        const data  = await overpassFetch(query);
        if (data?.elements) {
          results.push(
            ...data.elements
              .map(el => osmToPlace(el, cat))
              .filter(Boolean)
          );
        }
      }
    }
  }

  // Remove duplicatas por id
  const seen = new Set();
  return results.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
}

// ── Google Places (opcional) ──────────────────────────────────────────────────
const GOOGLE_TYPE = { vet: 'veterinary_care', pet_shop: 'pet_store', pet_friendly: null };

async function searchGoogle(lat, lng, category, radius) {
  const cats = category === 'all' ? Object.keys(GOOGLE_TYPE) : [category];
  const results = [];

  for (const cat of cats) {
    const type = GOOGLE_TYPE[cat];
    const qs = new URLSearchParams({
      location: `${lat},${lng}`,
      radius:   String(radius),
      key:      GOOGLE_KEY,
      language: 'pt-BR',
      ...(type ? { type } : { keyword: 'pet friendly', type: 'establishment' }),
    });
    try {
      const res  = await fetch(`${GOOGLE_BASE}/nearbysearch/json?${qs}`);
      const data = await res.json();
      if (data.results) {
        results.push(...data.results.map(r => ({
          id:               r.place_id,
          name:             r.name,
          category:         cat,
          address:          r.vicinity || '',
          latitude:         r.geometry.location.lat,
          longitude:        r.geometry.location.lng,
          rating:           r.rating ?? null,
          userRatingsTotal: r.user_ratings_total ?? 0,
          isOpenNow:        r.opening_hours?.open_now ?? null,
          openingHours:     null,
          googleMapsUrl:    `https://www.google.com/maps/place/?q=place_id:${r.place_id}`,
          phone:            null,
          website:          null,
          distance:         null,
          source:           'google',
        })));
      }
    } catch {}
  }
  return results;
}

// ── Detalhes do local (Google, se disponível) ─────────────────────────────────
export async function getPlaceDetails(placeId) {
  if (!GOOGLE_KEY || placeId.startsWith('osm_')) return null;
  const qs = new URLSearchParams({
    place_id: placeId,
    fields:   'formatted_phone_number,opening_hours,website',
    key:      GOOGLE_KEY,
    language: 'pt-BR',
  });
  try {
    const res  = await fetch(`${GOOGLE_BASE}/details/json?${qs}`);
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

// ── Busca principal — tenta OSM primeiro, depois Google ───────────────────────
export async function searchNearbyPlaces(lat, lng, category = 'all', radius = 3000) {
  // 1. Tenta OpenStreetMap (gratuito)
  try {
    const osmPlaces = await searchOverpass(lat, lng, category, radius);
    if (osmPlaces.length > 0) {
      return { places: osmPlaces, error: null, source: 'osm' };
    }
  } catch {}

  // 2. Tenta Google Places (se tiver chave)
  if (GOOGLE_KEY) {
    try {
      const googlePlaces = await searchGoogle(lat, lng, category, radius);
      if (googlePlaces.length > 0) {
        return { places: googlePlaces, error: null, source: 'google' };
      }
    } catch {}
  }

  // 3. Sem resultados
  return { places: [], error: null, source: 'none' };
}

// ── Dados demo (web e desenvolvimento) ───────────────────────────────────────
export function getDemoPlaces(lat, lng) {
  const off = () => (Math.random() - 0.5) * 0.025;
  return [
    { id: 'demo1', name: 'Clínica Vet Amigo Fiel',   category: 'vet',          address: 'Rua das Flores, 123',    latitude: lat + off(), longitude: lng + off(), rating: 4.7, userRatingsTotal: 128, isOpenNow: true,  googleMapsUrl: '#', phone: '(11) 1234-5678', openingHours: ['Seg-Sex: 08:00–18:00', 'Sáb: 08:00–13:00'], distance: null },
    { id: 'demo2', name: 'Hospital Vet 24h',          category: 'vet',          address: 'Av. da Saúde, 789',      latitude: lat + off(), longitude: lng + off(), rating: 4.8, userRatingsTotal: 204, isOpenNow: true,  googleMapsUrl: '#', phone: '(11) 9876-5432', openingHours: ['24 horas'], distance: null },
    { id: 'demo3', name: 'PetShop Feliz',             category: 'pet_shop',     address: 'Av. Principal, 456',     latitude: lat + off(), longitude: lng + off(), rating: 4.4, userRatingsTotal: 87,  isOpenNow: true,  googleMapsUrl: '#', phone: '(11) 3333-2222', openingHours: ['Seg-Sáb: 09:00–19:00'], distance: null },
    { id: 'demo4', name: 'Mundo dos Pets',            category: 'pet_shop',     address: 'Rua Comercial, 321',     latitude: lat + off(), longitude: lng + off(), rating: 4.2, userRatingsTotal: 56,  isOpenNow: false, googleMapsUrl: '#', phone: null, openingHours: ['Seg-Sex: 10:00–18:00'], distance: null },
    { id: 'demo5', name: 'Parque Pet Friendly',       category: 'pet_friendly', address: 'Rua do Parque, s/n',     latitude: lat + off(), longitude: lng + off(), rating: 4.9, userRatingsTotal: 312, isOpenNow: true,  googleMapsUrl: '#', phone: null, openingHours: null, distance: null },
    { id: 'demo6', name: 'Café com Pets',             category: 'pet_friendly', address: 'Rua Aconchegante, 11',   latitude: lat + off(), longitude: lng + off(), rating: 4.6, userRatingsTotal: 91,  isOpenNow: true,  googleMapsUrl: '#', phone: '(11) 5555-4444', openingHours: ['Ter-Dom: 10:00–20:00'], distance: null },
  ];
}
