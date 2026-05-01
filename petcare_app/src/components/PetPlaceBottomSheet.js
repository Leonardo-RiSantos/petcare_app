import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  Linking, ScrollView, Platform,
} from 'react-native';
import { CATEGORY_CONFIG } from '../services/placesService';
import { formatDistance } from '../utils/distanceUtils';

function Stars({ rating }) {
  if (!rating) return null;
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <View style={styles.stars}>
      {Array(full).fill('★').map((s, i)  => <Text key={`f${i}`} style={[styles.star, styles.starFull]}>{s}</Text>)}
      {half &&  <Text style={[styles.star, styles.starHalf]}>★</Text>}
      {Array(empty).fill('☆').map((s, i) => <Text key={`e${i}`} style={[styles.star, styles.starEmpty]}>{s}</Text>)}
      <Text style={styles.ratingNum}>{rating.toFixed(1)}</Text>
    </View>
  );
}

export default function PetPlaceBottomSheet({ place, onClose, onSave, savedIds = [] }) {
  const slideAnim = useRef(new Animated.Value(350)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (place) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [place]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 350, duration: 220, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start(onClose);
  };

  const handleRoute = () => {
    if (!place) return;
    const url = Platform.OS === 'ios'
      ? `maps://?daddr=${place.latitude},${place.longitude}`
      : `google.navigation:q=${place.latitude},${place.longitude}`;
    const web = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
    Linking.openURL(url).catch(() => Linking.openURL(web));
  };

  const handlePhone = () => {
    if (place?.phone) Linking.openURL(`tel:${place.phone}`);
  };

  const handleGoogleMaps = () => {
    if (place?.googleMapsUrl && place.googleMapsUrl !== '#') {
      Linking.openURL(place.googleMapsUrl);
    }
  };

  if (!place) return null;

  const cat    = CATEGORY_CONFIG[place.category] || {};
  const saved  = savedIds.includes(place.id);

  return (
    <>
      {/* Overlay semi-transparente */}
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Cabeçalho */}
        <View style={styles.header}>
          <View style={[styles.catBadge, { backgroundColor: cat.bg || '#EFF6FF' }]}>
            <Text style={styles.catEmoji}>{cat.emoji || '🐾'}</Text>
            <Text style={[styles.catLabel, { color: cat.color || '#0EA5E9' }]}>{cat.label || place.category}</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <Text style={styles.placeName}>{place.name}</Text>

          <Stars rating={place.rating} />
          {place.userRatingsTotal > 0 && (
            <Text style={styles.ratingsCount}>{place.userRatingsTotal} avaliações no Google</Text>
          )}

          {/* Endereço */}
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>{place.address || 'Endereço não disponível'}</Text>
          </View>

          {/* Distância */}
          {place.distance != null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📏</Text>
              <Text style={styles.infoText}>{formatDistance(place.distance)} de você</Text>
            </View>
          )}

          {/* Status de funcionamento */}
          {place.isOpenNow != null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>{place.isOpenNow ? '🟢' : '🔴'}</Text>
              <Text style={[styles.infoText, { color: place.isOpenNow ? '#16A34A' : '#DC2626', fontWeight: '600' }]}>
                {place.isOpenNow ? 'Aberto agora' : 'Fechado agora'}
              </Text>
            </View>
          )}

          {/* Telefone */}
          {place.phone && (
            <TouchableOpacity style={styles.infoRow} onPress={handlePhone}>
              <Text style={styles.infoIcon}>📞</Text>
              <Text style={[styles.infoText, styles.infoLink]}>{place.phone}</Text>
            </TouchableOpacity>
          )}

          {/* Horário de funcionamento */}
          {place.openingHours?.length > 0 && (
            <View style={styles.hoursSection}>
              <Text style={styles.hoursTitle}>🕐 Horários</Text>
              {place.openingHours.map((h, i) => (
                <Text key={i} style={styles.hoursLine}>{h}</Text>
              ))}
            </View>
          )}

          {/* Privacidade */}
          <Text style={styles.privacyNote}>
            🔒 Sua localização é usada apenas para encontrar locais próximos. Não é armazenada.
          </Text>
        </ScrollView>

        {/* Ações */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSave, saved && styles.actionBtnSaved]}
            onPress={() => onSave(place)}
          >
            <Text style={styles.actionBtnText}>{saved ? '✓ Salvo' : '🔖 Salvar'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRoute]} onPress={handleRoute}>
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>🗺️ Ver rota</Text>
          </TouchableOpacity>

          {place.googleMapsUrl && place.googleMapsUrl !== '#' && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGoogle]} onPress={handleGoogleMaps}>
              <Text style={styles.actionBtnText}>↗ Google Maps</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 50,
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 51,
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '75%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
  handle: {
    width: 44, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 10 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  catEmoji: { fontSize: 16 },
  catLabel: { fontSize: 13, fontWeight: '700' },
  closeBtn: { marginLeft: 'auto', padding: 6 },
  closeBtnText: { fontSize: 16, color: '#94A3B8' },

  body: { paddingHorizontal: 20, paddingBottom: 12 },
  placeName: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 8 },

  stars: { flexDirection: 'row', alignItems: 'center', gap: 1, marginBottom: 2 },
  star: { fontSize: 16 },
  starFull: { color: '#F59E0B' },
  starHalf: { color: '#F59E0B' },
  starEmpty: { color: '#D1D5DB' },
  ratingNum: { fontSize: 13, fontWeight: '700', color: '#374151', marginLeft: 4 },
  ratingsCount: { fontSize: 12, color: '#94A3B8', marginBottom: 12 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  infoIcon: { fontSize: 16, width: 22, textAlign: 'center', marginTop: 1 },
  infoText: { fontSize: 14, color: '#374151', flex: 1, lineHeight: 20 },
  infoLink: { color: '#0EA5E9', fontWeight: '600' },

  hoursSection: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginVertical: 10 },
  hoursTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  hoursLine: { fontSize: 12, color: '#64748B', marginBottom: 3 },

  privacyNote: { fontSize: 11, color: '#94A3B8', marginTop: 12, lineHeight: 17 },

  actions: { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5 },
  actionBtnSave: { borderColor: '#E0F2FE', backgroundColor: '#F0F9FF' },
  actionBtnSaved: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  actionBtnRoute: { borderColor: '#0EA5E9', backgroundColor: '#0EA5E9' },
  actionBtnGoogle: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', flex: 0, paddingHorizontal: 14 },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#0EA5E9' },
});
