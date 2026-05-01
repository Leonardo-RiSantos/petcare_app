// Versão NATIVE do Mapa Pet (iOS + Android)
// Metro Bundler usa PetMapScreen.web.js no web automaticamente

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  FlatList, Platform, Linking,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestLocationPermission,
  getCurrentLocation,
  LOCATION_STATUS,
} from '../../services/locationService';
import {
  searchNearbyPlaces,
  getPlaceDetails,
  getDemoPlaces,
  CATEGORY_CONFIG,
} from '../../services/placesService';
import { checkProximityNotification } from '../../services/fredNotificationService';
import { sortByDistance, formatDistance } from '../../utils/distanceUtils';
import MapCategoryFilter from '../../components/MapCategoryFilter';
import PetPlaceBottomSheet from '../../components/PetPlaceBottomSheet';

const HAS_GOOGLE_KEY   = !!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const SAOPAULO_DEFAULT = { latitude: -23.5505, longitude: -46.6333 };

// ── Marcador no mapa ──────────────────────────────────────────────────────────
function PetMarker({ place, onPress, isSelected }) {
  const cat = CATEGORY_CONFIG[place.category] || {};
  return (
    <Marker
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      onPress={() => onPress(place)}
      tracksViewChanges={false}
    >
      <View style={[styles.markerWrap, isSelected && styles.markerSelected]}>
        <View style={[styles.marker, { backgroundColor: cat.color || '#0EA5E9' }]}>
          <Text style={styles.markerEmoji}>{cat.emoji || '🐾'}</Text>
        </View>
        {isSelected && (
          <View style={[styles.markerTail, { borderTopColor: cat.color || '#0EA5E9' }]} />
        )}
      </View>
    </Marker>
  );
}

// ── Card na lista lateral ─────────────────────────────────────────────────────
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

// ── Tela principal ────────────────────────────────────────────────────────────
export default function PetMapScreen() {
  const [locStatus,      setLocStatus]      = useState(LOCATION_STATUS.LOADING);
  const [userLocation,   setUserLocation]   = useState(null);
  const [places,         setPlaces]         = useState([]);
  const [filtered,       setFiltered]       = useState([]);
  const [selectedCat,    setSelectedCat]    = useState('all');
  const [selectedPlace,  setSelectedPlace]  = useState(null);
  const [loadingPlaces,  setLoadingPlaces]  = useState(false);
  const [searchRadius,   setSearchRadius]   = useState(3000);
  const [savedIds,       setSavedIds]       = useState([]);
  const [showList,       setShowList]       = useState(false);
  const [fredMsg,        setFredMsg]        = useState(null);
  const [isDemo,         setIsDemo]         = useState(false);

  const mapRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('petmap_saved')
      .then(v => { if (v) setSavedIds(JSON.parse(v)); })
      .catch(() => {});
    init();
  }, []);

  async function init() {
    const status = await requestLocationPermission();
    setLocStatus(status);
    if (status === LOCATION_STATUS.GRANTED) {
      const loc = await getCurrentLocation();
      if (loc) {
        setUserLocation(loc);
        loadPlaces(loc.latitude, loc.longitude, 'all', 3000);
        return;
      }
    }
    // Fallback: São Paulo
    setUserLocation(SAOPAULO_DEFAULT);
    loadDemo(SAOPAULO_DEFAULT.latitude, SAOPAULO_DEFAULT.longitude);
  }

  async function loadPlaces(lat, lng, category, radius) {
    setLoadingPlaces(true);
    const { places: result } = await searchNearbyPlaces(lat, lng, category, radius);
    const sorted = sortByDistance(result, lat, lng);

    if (sorted.length === 0 && radius < 10000) {
      const nr = radius * 2;
      setSearchRadius(nr);
      const { places: r2 } = await searchNearbyPlaces(lat, lng, category, nr);
      const s2 = sortByDistance(r2, lat, lng);
      if (s2.length === 0) { loadDemo(lat, lng); return; }
      setPlaces(s2); applyFilter(s2, category);
      setLoadingPlaces(false);
    } else if (sorted.length === 0) {
      loadDemo(lat, lng);
    } else {
      setPlaces(sorted); applyFilter(sorted, category);
      setLoadingPlaces(false);
      const notif = await checkProximityNotification(lat, lng, sorted, false);
      if (notif) setFredMsg(notif.message);
    }
  }

  function loadDemo(lat, lng) {
    const demo = sortByDistance(getDemoPlaces(lat, lng), lat, lng);
    setIsDemo(true); setPlaces(demo); applyFilter(demo, 'all');
    setLoadingPlaces(false);
  }

  function applyFilter(all, cat) {
    setFiltered(cat === 'all' ? all : all.filter(p => p.category === cat));
  }

  const handleCategorySelect = useCallback((cat) => {
    setSelectedCat(cat); applyFilter(places, cat); setSelectedPlace(null);
  }, [places]);

  const handlePlacePress = useCallback(async (place) => {
    setSelectedPlace(place); setShowList(false);
    if (!place.phone && !isDemo && !place.id?.startsWith('osm_') && HAS_GOOGLE_KEY) {
      const details = await getPlaceDetails(place.id);
      if (details) {
        const updated = { ...place, ...details };
        setSelectedPlace(updated);
        setPlaces(prev => prev.map(p => p.id === place.id ? updated : p));
      }
    }
    mapRef.current?.animateToRegion({
      latitude: place.latitude, longitude: place.longitude,
      latitudeDelta: 0.01, longitudeDelta: 0.01,
    }, 400);
  }, [isDemo]);

  const handleSave = useCallback(async (place) => {
    setSavedIds(prev => {
      const next = prev.includes(place.id)
        ? prev.filter(id => id !== place.id)
        : [...prev, place.id];
      AsyncStorage.setItem('petmap_saved', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const handleMyLocation = () => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400
    );
  };

  const handleExpandRadius = () => {
    if (!userLocation) return;
    const nr = searchRadius + 2000;
    setSearchRadius(nr);
    loadPlaces(userLocation.latitude, userLocation.longitude, selectedCat, nr);
  };

  const catCounts = places.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1; return acc;
  }, {});

  // ── Permissão negada ───────────────────────────────────────────────────────
  if (locStatus === LOCATION_STATUS.DENIED) {
    return (
      <LinearGradient colors={['#0284C7', '#0EA5E9', '#38BDF8']} style={styles.permScreen}>
        <Text style={styles.permEmoji}>📍</Text>
        <Text style={styles.permTitle}>Localização necessária</Text>
        <Text style={styles.permDesc}>
          O Mapa Pet usa sua localização para encontrar veterinários, pet shops e locais pet friendly
          próximos de você.{'\n\n'}Sua localização nunca é armazenada ou compartilhada.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()}>
          <Text style={styles.permBtnText}>Abrir configurações</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permBtn, styles.permBtnOutline]}
          onPress={() => {
            setLocStatus(LOCATION_STATUS.UNAVAILABLE);
            setUserLocation(SAOPAULO_DEFAULT);
            loadDemo(SAOPAULO_DEFAULT.latitude, SAOPAULO_DEFAULT.longitude);
          }}
        >
          <Text style={[styles.permBtnText, { color: 'rgba(255,255,255,0.85)' }]}>Continuar sem localização</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // ── Carregando ─────────────────────────────────────────────────────────────
  if (locStatus === LOCATION_STATUS.LOADING) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Buscando sua localização...</Text>
      </View>
    );
  }

  const region = userLocation
    ? { ...userLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : { ...SAOPAULO_DEFAULT, latitudeDelta: 0.04, longitudeDelta: 0.04 };

  return (
    <View style={styles.container}>

      {/* ── Mapa ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={HAS_GOOGLE_KEY ? 'google' : undefined}
        mapType={HAS_GOOGLE_KEY || Platform.OS === 'ios' ? 'standard' : 'none'}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Tiles OSM gratuitos no Android sem chave Google */}
        {!HAS_GOOGLE_KEY && Platform.OS === 'android' && (
          <UrlTile
            urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            flipY={false}
          />
        )}

        {filtered.map(p => (
          <PetMarker
            key={p.id}
            place={p}
            onPress={handlePlacePress}
            isSelected={selectedPlace?.id === p.id}
          />
        ))}
      </MapView>

      {/* ── Filtros de categoria ── */}
      <MapCategoryFilter
        selected={selectedCat}
        onSelect={handleCategorySelect}
        counts={catCounts}
      />

      {/* ── Botões flutuantes ── */}
      <View style={styles.floatingBtns} pointerEvents="box-none">
        <TouchableOpacity style={styles.floatBtn} onPress={handleMyLocation}>
          <Text style={styles.floatBtnEmoji}>📍</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.floatBtn, showList && styles.floatBtnActive]}
          onPress={() => setShowList(v => !v)}
        >
          <Text style={styles.floatBtnEmoji}>{showList ? '🗺️' : '📋'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Loading ── */}
      {loadingPlaces && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color="#0EA5E9" />
            <Text style={styles.loadingPillText}>Buscando locais...</Text>
          </View>
        </View>
      )}

      {/* ── Lista de locais (toggle) ── */}
      {showList && (
        <View style={styles.listPanel}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              {filtered.length} local{filtered.length !== 1 ? 'is' : ''}{isDemo ? ' (demo)' : ''}
            </Text>
            <TouchableOpacity onPress={() => setShowList(false)}>
              <Text style={styles.listClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <PlaceCard place={item} onPress={handlePlacePress} saved={savedIds.includes(item.id)} />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.listEmpty}>
                <Text style={styles.listEmptyText}>Nenhum local nessa categoria</Text>
                <TouchableOpacity style={styles.expandBtn} onPress={handleExpandRadius}>
                  <Text style={styles.expandBtnText}>Buscar em raio maior</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      )}

      {/* ── Bottom sheet do local selecionado ── */}
      {selectedPlace && (
        <PetPlaceBottomSheet
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onSave={handleSave}
          savedIds={savedIds}
        />
      )}

      {/* ── Notificação do Fred ── */}
      {fredMsg && (
        <View style={styles.fredWrap} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.fredCard}
            onPress={() => setFredMsg(null)}
            activeOpacity={0.9}
          >
            <Text style={styles.fredEmoji}>🐱</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.fredText}>{fredMsg}</Text>
              <Text style={styles.fredDismiss}>Toque para fechar</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },

  permScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permEmoji:  { fontSize: 64, marginBottom: 16 },
  permTitle:  { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 12, textAlign: 'center' },
  permDesc:   { fontSize: 14, color: 'rgba(255,255,255,0.88)', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  permBtn:    { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 28, marginBottom: 10, width: '100%', alignItems: 'center' },
  permBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  permBtnText: { color: '#0EA5E9', fontWeight: '700', fontSize: 15 },

  map: { flex: 1 },

  floatingBtns: { position: 'absolute', right: 14, bottom: 100, gap: 10, zIndex: 20 },
  floatBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  floatBtnActive: { backgroundColor: '#0EA5E9' },
  floatBtnEmoji: { fontSize: 22 },

  loadingOverlay: { position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  loadingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  loadingPillText: { fontSize: 13, color: '#374151', fontWeight: '600' },

  markerWrap: { alignItems: 'center' },
  markerSelected: { transform: [{ scale: 1.2 }] },
  marker: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  markerEmoji: { fontSize: 20 },
  markerTail: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },

  listPanel: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '52%', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 8 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  listTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  listClose: { fontSize: 18, color: '#94A3B8', padding: 4 },
  listContent: { paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 20, gap: 8 },
  listEmpty: { alignItems: 'center', padding: 24 },
  listEmptyText: { color: '#94A3B8', fontSize: 14, marginBottom: 12 },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FAFAFA', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#EFF6FF' },
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

  expandBtn: { backgroundColor: '#EFF6FF', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1.5, borderColor: '#BAE6FD', alignSelf: 'center', marginVertical: 8 },
  expandBtnText: { fontSize: 13, fontWeight: '700', color: '#0EA5E9' },

  fredWrap: { position: 'absolute', bottom: 90, left: 16, right: 80, zIndex: 40 },
  fredCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6, borderWidth: 1.5, borderColor: '#FEF3C7' },
  fredEmoji: { fontSize: 28 },
  fredText: { fontSize: 13, color: '#1E293B', fontWeight: '500', lineHeight: 18 },
  fredDismiss: { fontSize: 10, color: '#BAE6FD', marginTop: 4 },
});
