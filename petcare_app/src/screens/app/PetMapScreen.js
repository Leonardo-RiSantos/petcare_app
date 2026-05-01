import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  FlatList, Platform, Alert, Linking, ScrollView,
} from 'react-native';
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

// MapView só disponível no native
let MapView, Marker, UrlTile;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker  = Maps.Marker;
  UrlTile = Maps.UrlTile; // tiles OSM gratuitos no Android
}

const HAS_GOOGLE_KEY = !!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const IS_WEB = Platform.OS === 'web';

const SAOPAULO_DEFAULT = { latitude: -23.5505, longitude: -46.6333 };

// ─── Marcador de local no mapa ───────────────────────────────────────────────
function PetMarker({ place, onPress, isSelected }) {
  if (!Marker) return null;
  const cat = CATEGORY_CONFIG[place.category] || {};
  return (
    <Marker
      key={place.id}
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      onPress={() => onPress(place)}
    >
      <View style={[styles.markerWrap, isSelected && styles.markerWrapSelected]}>
        <View style={[styles.marker, { backgroundColor: cat.color || '#0EA5E9' }]}>
          <Text style={styles.markerEmoji}>{cat.emoji || '🐾'}</Text>
        </View>
        {isSelected && <View style={[styles.markerTail, { borderTopColor: cat.color || '#0EA5E9' }]} />}
      </View>
    </Marker>
  );
}

// ─── Card de local na lista ───────────────────────────────────────────────────
function PlaceCard({ place, onPress, saved }) {
  const cat = CATEGORY_CONFIG[place.category] || {};
  return (
    <TouchableOpacity style={styles.placeCard} onPress={() => onPress(place)} activeOpacity={0.8}>
      <View style={[styles.placeIconWrap, { backgroundColor: cat.bg || '#EFF6FF' }]}>
        <Text style={styles.placeIcon}>{cat.emoji || '🐾'}</Text>
      </View>
      <View style={styles.placeBody}>
        <View style={styles.placeNameRow}>
          <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
          {saved && <Text style={styles.savedTag}>🔖</Text>}
        </View>
        <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>
        <View style={styles.placeMeta}>
          {place.rating && <Text style={styles.placeRating}>★ {place.rating.toFixed(1)}</Text>}
          {place.distance != null && (
            <Text style={styles.placeDist}>{formatDistance(place.distance)}</Text>
          )}
          {place.isOpenNow != null && (
            <Text style={[styles.placeOpen, { color: place.isOpenNow ? '#16A34A' : '#EF4444' }]}>
              {place.isOpenNow ? 'Aberto' : 'Fechado'}
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.placeArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function PetMapScreen() {
  const [locStatus,     setLocStatus]     = useState(LOCATION_STATUS.LOADING);
  const [userLocation,  setUserLocation]  = useState(null);
  const [places,        setPlaces]        = useState([]);
  const [filteredPlaces,setFilteredPlaces]= useState([]);
  const [selectedCat,   setSelectedCat]   = useState('all');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [searchRadius,  setSearchRadius]  = useState(3000);
  const [savedIds,      setSavedIds]      = useState([]);
  const [showList,      setShowList]      = useState(false);
  const [fredMsg,       setFredMsg]       = useState(null);
  const [isDemo,        setIsDemo]        = useState(false);

  const mapRef = useRef(null);

  // ── Carregar locais salvos ──
  useEffect(() => {
    AsyncStorage.getItem('petmap_saved')
      .then(v => { if (v) setSavedIds(JSON.parse(v)); })
      .catch(() => {});
  }, []);

  // ── Inicialização ──
  useEffect(() => {
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
      }
    } else if (IS_WEB || status === LOCATION_STATUS.UNAVAILABLE) {
      // Web: usa localização padrão com dados demo
      setUserLocation(SAOPAULO_DEFAULT);
      loadPlacesDemo(SAOPAULO_DEFAULT.latitude, SAOPAULO_DEFAULT.longitude);
    }
  }

  async function loadPlaces(lat, lng, category, radius) {
    setLoadingPlaces(true);
    const { places: result } = await searchNearbyPlaces(lat, lng, category, radius);
    let sorted = sortByDistance(result, lat, lng);

    // Se não encontrou, tenta raio maior
    if (sorted.length === 0 && radius < 10000) {
      const r2 = radius * 2;
      setSearchRadius(r2);
      const { places: r2places } = await searchNearbyPlaces(lat, lng, category, r2);
      sorted = sortByDistance(r2places, lat, lng);
    }

    setPlaces(sorted);
    applyFilter(sorted, category);
    setLoadingPlaces(false);

    // Fallback para dados demo se não encontrou nada
    if (sorted.length === 0) {
      loadPlacesDemo(lat, lng);
      return;
    }

    // Verificar proximidade para Fred
    const notif = await checkProximityNotification(lat, lng, sorted, false);
    if (notif) setFredMsg(notif.message);
  }

  function loadPlacesDemo(lat, lng) {
    const demo = sortByDistance(getDemoPlaces(lat, lng), lat, lng);
    setIsDemo(true);
    setPlaces(demo);
    applyFilter(demo, 'all');
    setLoadingPlaces(false);
  }

  function applyFilter(allPlaces, category) {
    const filtered = category === 'all'
      ? allPlaces
      : allPlaces.filter(p => p.category === category);
    setFilteredPlaces(filtered);
  }

  const handleCategorySelect = useCallback((cat) => {
    setSelectedCat(cat);
    applyFilter(places, cat);
    setSelectedPlace(null);
  }, [places]);

  const handlePlacePress = useCallback(async (place) => {
    setSelectedPlace(place);
    setShowList(false);
    // Busca detalhes extras via Google Places (apenas se tiver chave e não for OSM/demo)
    if (!place.phone && !isDemo && HAS_GOOGLE_KEY && !place.id?.startsWith('osm_')) {
      const details = await getPlaceDetails(place.id);
      if (details) {
        const updated = { ...place, ...details };
        setSelectedPlace(updated);
        setPlaces(prev => prev.map(p => p.id === place.id ? { ...p, ...details } : p));
      }
    }
    // Centraliza no mapa
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude:      place.latitude,
        longitude:     place.longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      }, 400);
    }
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

  const handleExpandRadius = () => {
    if (!userLocation) return;
    const nr = searchRadius + 2000;
    setSearchRadius(nr);
    loadPlaces(userLocation.latitude, userLocation.longitude, selectedCat, nr);
  };

  const handleMyLocation = () => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      ...userLocation,
      latitudeDelta:  0.02,
      longitudeDelta: 0.02,
    }, 400);
  };

  const catCounts = places.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});

  // ── Estado: permissão negada ──
  if (locStatus === LOCATION_STATUS.DENIED && !IS_WEB) {
    return (
      <View style={styles.permDenied}>
        <LinearGradient colors={['#0284C7','#0EA5E9','#38BDF8']} style={styles.permGrad}>
          <Text style={styles.permEmoji}>📍</Text>
          <Text style={styles.permTitle}>Localização necessária</Text>
          <Text style={styles.permDesc}>
            O Mapa Pet precisa da sua localização para encontrar veterinários, pet shops e locais pet friendly perto de você.{'\n\n'}
            Sua localização é usada apenas para buscar locais próximos e nunca é armazenada.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.permBtnText}>Abrir configurações</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.permBtn, styles.permBtnOutline]} onPress={() => {
            setLocStatus(LOCATION_STATUS.UNAVAILABLE);
            setUserLocation(SAOPAULO_DEFAULT);
            loadPlacesDemo(SAOPAULO_DEFAULT.latitude, SAOPAULO_DEFAULT.longitude);
          }}>
            <Text style={[styles.permBtnText, { color: 'rgba(255,255,255,0.85)' }]}>Continuar sem localização</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  // ── Estado: carregando localização ──
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

      {/* ── Mapa (native) ou banner (web) ── */}
      {!IS_WEB && MapView ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={HAS_GOOGLE_KEY ? 'google' : undefined}
          initialRegion={region}
          showsUserLocation
          showsMyLocationButton={false}
          mapType={HAS_GOOGLE_KEY ? 'standard' : 'none'}
        >
          {/* Tiles OSM gratuitos quando não há Google key (Android) */}
          {!HAS_GOOGLE_KEY && Platform.OS === 'android' && UrlTile && (
            <UrlTile
              urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              flipY={false}
            />
          )}
          {filteredPlaces.map(p => (
            <PetMarker
              key={p.id}
              place={p}
              onPress={handlePlacePress}
              isSelected={selectedPlace?.id === p.id}
            />
          ))}
        </MapView>
      ) : (
        <LinearGradient colors={['#0284C7','#0EA5E9','#7DD3FC']} style={styles.webMapBanner}>
          <Text style={styles.webMapTitle}>🗺️ Mapa Pet</Text>
          <Text style={styles.webMapSub}>
            {isDemo
            ? 'Mapa interativo disponível no app mobile.'
            : 'Abra no app mobile para ver o mapa interativo.'}
          </Text>
          <View style={styles.webMapNote}>
            <Text style={styles.webMapNoteText}>
              {isDemo
                ? '📍 Instale o app no celular para ver locais reais perto de você'
                : '✅ Dados reais via OpenStreetMap — sem custo'}
            </Text>
          </View>
        </LinearGradient>
      )}

      {/* ── Filtros de categoria (sobreposto no mapa) ── */}
      <MapCategoryFilter
        selected={selectedCat}
        onSelect={handleCategorySelect}
        counts={catCounts}
      />

      {/* ── Botões flutuantes (apenas native) ── */}
      {!IS_WEB && (
        <View style={styles.floatingBtns} pointerEvents="box-none">
          <TouchableOpacity style={styles.floatBtn} onPress={handleMyLocation}>
            <Text style={styles.floatBtnText}>📍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.floatBtn, styles.floatBtnList]}
            onPress={() => setShowList(v => !v)}
          >
            <Text style={styles.floatBtnText}>{showList ? '🗺️' : '📋'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Loading de locais ── */}
      {loadingPlaces && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color="#0EA5E9" />
            <Text style={styles.loadingPillText}>Buscando locais...</Text>
          </View>
        </View>
      )}

      {/* ── Lista de resultados (sempre visível na web, toggle no native) ── */}
      {(IS_WEB || showList) && (
        <View style={styles.listPanel}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              {filteredPlaces.length} local{filteredPlaces.length !== 1 ? 'is' : ''} encontrado{filteredPlaces.length !== 1 ? 's' : ''}
              {isDemo ? ' (demonstração)' : ''}
            </Text>
            {!IS_WEB && (
              <TouchableOpacity onPress={() => setShowList(false)}>
                <Text style={styles.listClose}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {filteredPlaces.length === 0 && !loadingPlaces ? (
            <View style={styles.emptyList}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>Nenhum local encontrado</Text>
              <Text style={styles.emptySub}>Tente expandir o raio de busca</Text>
              <TouchableOpacity style={styles.expandBtn} onPress={handleExpandRadius}>
                <Text style={styles.expandBtnText}>Buscar em raio maior ({Math.round((searchRadius + 2000) / 1000)} km)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredPlaces}
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
                filteredPlaces.length > 0 ? (
                  <TouchableOpacity style={styles.expandBtn} onPress={handleExpandRadius}>
                    <Text style={styles.expandBtnText}>
                      + Buscar mais longe ({Math.round((searchRadius + 2000) / 1000)} km)
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}
        </View>
      )}

      {/* ── Bottom sheet de detalhes do local ── */}
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
        <View style={styles.fredNotif} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.fredNotifCard}
            onPress={() => setFredMsg(null)}
            activeOpacity={0.9}
          >
            <Text style={styles.fredNotifEmoji}>🐱</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.fredNotifText}>{fredMsg}</Text>
              <Text style={styles.fredNotifDismiss}>Toque para fechar</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },

  // Permissão negada
  permDenied: { flex: 1 },
  permGrad: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permEmoji: { fontSize: 64, marginBottom: 16 },
  permTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 12, textAlign: 'center' },
  permDesc: { fontSize: 14, color: 'rgba(255,255,255,0.88)', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  permBtn: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 28, marginBottom: 10, width: '100%', alignItems: 'center' },
  permBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  permBtnText: { color: '#0EA5E9', fontWeight: '700', fontSize: 15 },

  // Mapa
  map: { flex: 1 },

  // Web banner
  webMapBanner: { height: 160, justifyContent: 'center', alignItems: 'center', padding: 20 },
  webMapTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  webMapSub: { fontSize: 13, color: 'rgba(255,255,255,0.88)', textAlign: 'center' },
  webMapNote: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  webMapNoteText: { fontSize: 11, color: '#fff', textAlign: 'center' },

  // Botões flutuantes
  floatingBtns: { position: 'absolute', right: 14, bottom: 100, gap: 10, zIndex: 20 },
  floatBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  floatBtnList: { backgroundColor: '#0EA5E9' },
  floatBtnText: { fontSize: 22 },

  // Loading overlay
  loadingOverlay: { position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  loadingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  loadingPillText: { fontSize: 13, color: '#374151', fontWeight: '600' },

  // Marcadores
  markerWrap: { alignItems: 'center' },
  markerWrapSelected: { transform: [{ scale: 1.2 }] },
  marker: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  markerEmoji: { fontSize: 20 },
  markerTail: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },

  // Lista de resultados
  listPanel: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '55%', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 8 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  listTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  listClose: { fontSize: 18, color: '#94A3B8', padding: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 20, gap: 8 },

  // Cards de local
  placeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FAFAFA', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#EFF6FF' },
  placeIconWrap: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  placeIcon: { fontSize: 24 },
  placeBody: { flex: 1 },
  placeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  placeName: { fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1 },
  savedTag: { fontSize: 14 },
  placeAddress: { fontSize: 12, color: '#64748B', marginTop: 2 },
  placeMeta: { flexDirection: 'row', gap: 10, marginTop: 4 },
  placeRating: { fontSize: 12, color: '#F59E0B', fontWeight: '700' },
  placeDist: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  placeOpen: { fontSize: 12, fontWeight: '600' },
  placeArrow: { fontSize: 20, color: '#BAE6FD' },

  // Empty state
  emptyList: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#94A3B8', marginBottom: 20 },
  expandBtn: { backgroundColor: '#EFF6FF', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1.5, borderColor: '#BAE6FD', alignSelf: 'center', marginVertical: 8 },
  expandBtnText: { fontSize: 13, fontWeight: '700', color: '#0EA5E9' },

  // Fred notificação
  fredNotif: { position: 'absolute', bottom: 90, left: 16, right: 80, zIndex: 40 },
  fredNotifCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6, borderWidth: 1.5, borderColor: '#FEF3C7' },
  fredNotifEmoji: { fontSize: 28 },
  fredNotifText: { fontSize: 13, color: '#1E293B', fontWeight: '500', lineHeight: 18 },
  fredNotifDismiss: { fontSize: 10, color: '#BAE6FD', marginTop: 4 },
});
