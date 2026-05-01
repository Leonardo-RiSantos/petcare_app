// Versão WEB do Mapa Pet — sem react-native-maps (não suportado no web)
// Metro Bundler carrega automaticamente este arquivo em vez de PetMapScreen.js no web

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  FlatList, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  searchNearbyPlaces, CATEGORY_CONFIG,
} from '../../services/placesService';
import { sortByDistance, formatDistance } from '../../utils/distanceUtils';
import PetPlaceBottomSheet from '../../components/PetPlaceBottomSheet';

const SP_DEFAULT = { latitude: -23.5505, longitude: -46.6333 };

const FILTERS = [
  { key: 'all',          label: 'Todos',       emoji: '🗺️', color: '#0EA5E9' },
  { key: 'vet',          label: 'Veterinários', emoji: '🏥', color: '#F43F5E' },
  { key: 'pet_shop',     label: 'Pet Shops',    emoji: '🛒', color: '#F59E0B' },
  { key: 'pet_friendly', label: 'Pet Friendly', emoji: '🐾', color: '#10B981' },
];

function PlaceCard({ place, onPress, saved }) {
  const cat = CATEGORY_CONFIG[place.category] || {};
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(place)} activeOpacity={0.8}>
      <View style={[styles.cardIcon, { backgroundColor: cat.bg || '#EFF6FF' }]}>
        <Text style={styles.cardEmoji}>{cat.emoji || '🐾'}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>{place.name}</Text>
          {saved && <Text style={{ fontSize: 14 }}>🔖</Text>}
        </View>
        <Text style={styles.cardAddress} numberOfLines={1}>{place.address}</Text>
        <View style={styles.cardMeta}>
          {place.rating   && <Text style={styles.cardRating}>★ {place.rating.toFixed(1)}</Text>}
          {place.distance != null && <Text style={styles.cardDist}>{formatDistance(place.distance)}</Text>}
          {place.isOpenNow != null && (
            <Text style={[styles.cardOpen, { color: place.isOpenNow ? '#16A34A' : '#EF4444' }]}>
              {place.isOpenNow ? 'Aberto' : 'Fechado'}
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.cardArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function PetMapScreen() {
  const [userLocation,   setUserLocation]   = useState(null);
  const [places,         setPlaces]         = useState([]);
  const [filtered,       setFiltered]       = useState([]);
  const [selectedCat,    setSelectedCat]    = useState('all');
  const [selectedPlace,  setSelectedPlace]  = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [loadingPlaces,  setLoadingPlaces]  = useState(false);
  const [savedIds,       setSavedIds]       = useState([]);
  const [searchRadius,   setSearchRadius]   = useState(3000);

  // ── Salvos ────────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('petmap_saved')
      .then(v => { if (v) setSavedIds(JSON.parse(v)); })
      .catch(() => {});
    initLocation();
  }, []);

  function initLocation() {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setUserLocation(loc);
          setLoading(false);
          loadPlaces(loc.latitude, loc.longitude, 'all', 3000);
        },
        () => {
          setUserLocation(SP_DEFAULT);
          setLoading(false);
          loadPlaces(SP_DEFAULT.latitude, SP_DEFAULT.longitude, 'all', 3000);
        },
        { timeout: 8000 }
      );
    } else {
      setUserLocation(SP_DEFAULT);
      setLoading(false);
      loadPlaces(SP_DEFAULT.latitude, SP_DEFAULT.longitude, 'all', 3000);
    }
  }

  // Busca progressiva: tenta raios crescentes antes de desistir
  async function loadPlaces(lat, lng, category, radius) {
    setLoadingPlaces(true);
    const RADII = [radius, 5000, 8000, 12000, 20000];

    for (const r of RADII) {
      setSearchRadius(r);
      const { places: result } = await searchNearbyPlaces(lat, lng, category, r);
      const sorted = sortByDistance(result, lat, lng);
      if (sorted.length > 0) {
        setPlaces(sorted);
        applyFilter(sorted, category);
        setLoadingPlaces(false);
        return;
      }
    }
    // Nada encontrado em nenhum raio — mostra estado vazio real
    setPlaces([]);
    applyFilter([], category);
    setLoadingPlaces(false);
  }

  function applyFilter(all, cat) {
    setFiltered(cat === 'all' ? all : all.filter(p => p.category === cat));
  }

  const handleCategorySelect = useCallback((cat) => {
    setSelectedCat(cat);
    applyFilter(places, cat);
    setSelectedPlace(null);
  }, [places]);

  const handlePlacePress = useCallback((place) => {
    setSelectedPlace(place);
  }, []);

  const handleSave = useCallback(async (place) => {
    setSavedIds(prev => {
      const next = prev.includes(place.id)
        ? prev.filter(id => id !== place.id)
        : [...prev, place.id];
      AsyncStorage.setItem('petmap_saved', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const handleExpandRadius = () => {
    if (!userLocation) return;
    const nr = searchRadius + 2000;
    setSearchRadius(nr);
    loadPlaces(userLocation.latitude, userLocation.longitude, selectedCat, nr);
  };

  const catCounts = places.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Buscando sua localização...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── Banner (substitui o mapa no web) ── */}
      <LinearGradient
        colors={['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={[styles.bubble, { width: 140, height: 140, top: -40, right: -30 }]} />
        <View style={[styles.bubble, { width: 70,  height: 70,  bottom: -20, left: 30 }]} />
        <Text style={styles.bannerEmoji}>🗺️</Text>
        <Text style={styles.bannerTitle}>Mapa Pet</Text>
        <Text style={styles.bannerSub}>
          Locais pet próximos via OpenStreetMap — dados reais, sem custo
        </Text>
        <View style={styles.bannerBadge}>
          <Text style={styles.bannerBadgeText}>✅ OpenStreetMap · gratuito</Text>
        </View>
      </LinearGradient>

      {/* ── Filtros ── */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(f => {
            const active = selectedCat === f.key;
            const count  = f.key === 'all'
              ? Object.values(catCounts).reduce((a, b) => a + b, 0)
              : (catCounts[f.key] ?? 0);
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, active && { backgroundColor: f.color, borderColor: f.color }]}
                onPress={() => handleCategorySelect(f.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.filterEmoji}>{f.emoji}</Text>
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{f.label}</Text>
                {count > 0 && (
                  <View style={[styles.filterCount, active && styles.filterCountActive]}>
                    <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Lista de locais ── */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>
          {loadingPlaces
            ? `Buscando em raio de ${Math.round(searchRadius / 1000)} km...`
            : `${filtered.length} local${filtered.length !== 1 ? 'is' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}
        </Text>
        {loadingPlaces && <ActivityIndicator size="small" color="#0EA5E9" />}
      </View>

      {filtered.length === 0 && !loadingPlaces ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>Nenhum local encontrado</Text>
          <Text style={styles.emptySub}>Tente expandir o raio de busca</Text>
          <TouchableOpacity style={styles.expandBtn} onPress={handleExpandRadius}>
            <Text style={styles.expandBtnText}>
              Buscar em {Math.round((searchRadius + 2000) / 1000)} km
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PlaceCard
              place={item}
              onPress={handlePlacePress}
              saved={savedIds.includes(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            filtered.length > 0 ? (
              <TouchableOpacity style={styles.expandBtn} onPress={handleExpandRadius}>
                <Text style={styles.expandBtnText}>
                  + Buscar mais longe ({Math.round((searchRadius + 2000) / 1000)} km)
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* ── Bottom sheet ── */}
      {selectedPlace && (
        <PetPlaceBottomSheet
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onSave={handleSave}
          savedIds={savedIds}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },

  banner: { paddingHorizontal: 24, paddingVertical: 22, overflow: 'hidden', alignItems: 'center' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  bannerEmoji: { fontSize: 32, marginBottom: 4 },
  bannerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 18 },
  bannerBadge: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  bannerBadgeText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  filterWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F8FAFC', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#E0F2FE',
  },
  filterEmoji: { fontSize: 15 },
  filterLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  filterLabelActive: { color: '#fff' },
  filterCount: { backgroundColor: '#EFF6FF', borderRadius: 20, minWidth: 20, height: 20, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterCountText: { fontSize: 10, fontWeight: '800', color: '#0EA5E9' },
  filterCountTextActive: { color: '#fff' },

  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  listTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 8 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: '#EFF6FF',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  cardIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardEmoji: { fontSize: 24 },
  cardBody: { flex: 1 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1 },
  cardAddress: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cardMeta: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cardRating: { fontSize: 12, color: '#F59E0B', fontWeight: '700' },
  cardDist: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  cardOpen: { fontSize: 12, fontWeight: '600' },
  cardArrow: { fontSize: 20, color: '#BAE6FD' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#94A3B8', marginBottom: 20 },
  expandBtn: { backgroundColor: '#EFF6FF', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1.5, borderColor: '#BAE6FD' },
  expandBtnText: { fontSize: 13, fontWeight: '700', color: '#0EA5E9' },
});
