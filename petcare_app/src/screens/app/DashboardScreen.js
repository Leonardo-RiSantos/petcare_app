import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
};

const ICON_CHECK   = require('../../../assets/icon_check.png');
const ICON_WARNING = require('../../../assets/icon_warning.png');
const ICON_LATE    = require('../../../assets/icon_late.png');

function calcVaccineStatus(vaccines) {
  const today = new Date();
  const in30 = new Date(); in30.setDate(today.getDate() + 30);
  let ok = 0, warning = 0, late = 0;
  vaccines.forEach(v => {
    if (!v.next_dose_date) { ok++; return; }
    const next = new Date(v.next_dose_date);
    if (next < today) late++;
    else if (next <= in30) warning++;
    else ok++;
  });
  return { ok, warning, late };
}

// Pílula compacta de status de vacina
function StatusPill({ icon, count, label, bg, labelColor }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Image source={icon} style={styles.pillIcon} resizeMode="contain" />
      <Text style={[styles.pillCount, { color: labelColor }]}>{count}</Text>
      <Text style={[styles.pillLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [pets, setPets] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    const [petsRes, vacRes, profileRes] = await Promise.all([
      supabase.from('pets').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('vaccines').select('*').eq('user_id', user.id),
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    ]);
    if (petsRes.data) setPets(petsRes.data);
    if (vacRes.data) setVaccines(vacRes.data);
    if (profileRes.data) setProfile(profileRes.data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const { ok, warning, late } = calcVaccineStatus(vaccines);
  const firstName = profile?.full_name?.split(' ')[0] || 'tutor';
  const hasAlerts = late > 0 || warning > 0;
  const allGood = vaccines.length > 0 && !hasAlerts;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
    >
      {/* ── Hero slim ── */}
      <LinearGradient
        colors={['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.bubble, { width: 180, height: 180, top: -60, right: -40 }]} />
        <View style={[styles.bubble, { width: 90,  height: 90,  bottom: -25, left: 30 }]} />

        <Text style={styles.heroTitle}>Olá, {firstName}! 🐾</Text>
        <Text style={styles.heroSub}>
          {pets.length === 0
            ? 'Adicione seu primeiro pet para começar'
            : allGood
              ? `${pets.length} pet${pets.length > 1 ? 's' : ''} com vacinas em dia ✓`
              : hasAlerts
                ? `${pets.length} pet${pets.length > 1 ? 's' : ''} · ${late + warning} alerta${(late + warning) > 1 ? 's' : ''} de vacina`
                : `${pets.length} pet${pets.length > 1 ? 's' : ''} cadastrado${pets.length > 1 ? 's' : ''}`}
        </Text>
      </LinearGradient>

      {/* ── Status compacto ── */}
      {vaccines.length > 0 && (
        <View style={styles.statusRow}>
          <StatusPill icon={ICON_CHECK}   count={ok}      label="Em dia"    bg="#F0FDF4" labelColor="#16A34A" />
          <StatusPill icon={ICON_WARNING} count={warning} label="Vencendo"  bg="#FFFBEB" labelColor="#D97706" />
          <StatusPill icon={ICON_LATE}    count={late}    label="Atrasadas" bg="#FFF1F2" labelColor="#DC2626" />
        </View>
      )}

      {/* ── Banner de alerta (só aparece quando há problema) ── */}
      {hasAlerts && (
        <View style={[styles.alertBanner, late > 0 ? styles.alertBannerRed : styles.alertBannerYellow]}>
          <Image
            source={late > 0 ? ICON_LATE : ICON_WARNING}
            style={styles.alertBannerIcon}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertBannerTitle}>
              {late > 0
                ? `${late} vacina${late > 1 ? 's' : ''} em atraso!`
                : `${warning} vacina${warning > 1 ? 's' : ''} vencendo em breve`}
            </Text>
            <Text style={styles.alertBannerSub}>Veja os pets abaixo e registre o reforço</Text>
          </View>
        </View>
      )}

      {/* ── Meus Pets ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Meus Pets</Text>
        <TouchableOpacity style={styles.addBtnWrap} onPress={() => navigation.navigate('AddPet')}>
          <LinearGradient
            colors={['#0EA5E9', '#38BDF8']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.addBtnGrad}
          >
            <Text style={styles.addBtnText}>+ Adicionar</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {pets.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🐶🐱</Text>
          <Text style={styles.emptyTitle}>Nenhum pet cadastrado ainda</Text>
          <Text style={styles.emptySub}>Adicione seu primeiro pet para começar!</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddPet')}>
            <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Adicionar pet</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        pets.map(pet => {
          const petVaccines = vaccines.filter(v => v.pet_id === pet.id);
          const s = calcVaccineStatus(petVaccines);
          return (
            <TouchableOpacity
              key={pet.id}
              style={styles.petCard}
              onPress={() => navigation.navigate('PetDetails', { petId: pet.id })}
              activeOpacity={0.82}
            >
              <LinearGradient
                colors={['#DBEAFE', '#EFF6FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.petEmojiWrap}
              >
                {SPECIES_IMAGES[pet.species]
                  ? <Image source={SPECIES_IMAGES[pet.species]} style={{ width: 36, height: 36 }} resizeMode="contain" />
                  : <Text style={{ fontSize: 30 }}>🐾</Text>}
              </LinearGradient>

              <View style={styles.petInfo}>
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petBreed}>{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</Text>
                {pet.weight_kg ? <Text style={styles.petWeight}>⚖️ {pet.weight_kg} kg</Text> : null}
              </View>

              <View style={styles.petRight}>
                {s.late > 0 ? (
                  <View style={[styles.badge, styles.badgeLate]}>
                    <Text style={[styles.badgeTxt, { color: '#DC2626' }]}>Atrasada</Text>
                  </View>
                ) : s.warning > 0 ? (
                  <View style={[styles.badge, styles.badgeWarn]}>
                    <Text style={[styles.badgeTxt, { color: '#D97706' }]}>Vencendo</Text>
                  </View>
                ) : petVaccines.length > 0 ? (
                  <View style={[styles.badge, styles.badgeOk]}>
                    <Text style={[styles.badgeTxt, { color: '#16A34A' }]}>Em dia</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, styles.badgeNone]}>
                    <Text style={[styles.badgeTxt, { color: '#94A3B8' }]}>Sem vacinas</Text>
                  </View>
                )}
                <Text style={styles.petArrow}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero — mais slim, sem painel de stats
  hero: {
    paddingHorizontal: 24, paddingTop: 26, paddingBottom: 30,
    overflow: 'hidden',
  },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 6 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.88)', lineHeight: 20 },

  // Barra de status compacta — substitui os 3 cards grandes
  statusRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 20, marginTop: 14,
  },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10,
  },
  pillIcon: { width: 20, height: 20 },
  pillCount: { fontSize: 16, fontWeight: '800' },
  pillLabel: { fontSize: 11, fontWeight: '600', flex: 1 },

  // Banner de alerta contextual
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginTop: 12,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
  },
  alertBannerRed: { backgroundColor: '#FFF1F2', borderWidth: 1.5, borderColor: '#FECDD3' },
  alertBannerYellow: { backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#FDE68A' },
  alertBannerIcon: { width: 32, height: 32 },
  alertBannerTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  alertBannerSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // Pets
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginTop: 22, marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  addBtnWrap: { borderRadius: 22, overflow: 'hidden' },
  addBtnGrad: { paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  emptyState: {
    backgroundColor: '#fff', borderRadius: 22, padding: 36, alignItems: 'center',
    marginHorizontal: 20, shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#EFF6FF',
  },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 24 },
  emptyBtn: { borderRadius: 16, paddingHorizontal: 30, paddingVertical: 14 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  petCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 14,
    marginHorizontal: 20, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#EFF6FF',
  },
  petEmojiWrap: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  petInfo: { flex: 1 },
  petName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  petBreed: { fontSize: 13, color: '#64748B', marginTop: 2 },
  petWeight: { fontSize: 12, color: '#94A3B8', marginTop: 3 },
  petRight: { alignItems: 'flex-end', gap: 6 },
  petArrow: { fontSize: 20, color: '#BAE6FD' },

  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOk: { backgroundColor: '#DCFCE7' },
  badgeWarn: { backgroundColor: '#FEF9C3' },
  badgeLate: { backgroundColor: '#FFE4E6' },
  badgeNone: { backgroundColor: '#F1F5F9' },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
});
