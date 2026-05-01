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

// Ícones de status de vacina
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

  // Primeiro nome do usuário
  const firstName = profile?.full_name?.split(' ')[0] || 'tutor';

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
    >
      {/* Hero */}
      <LinearGradient
        colors={['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.bubble, { width: 150, height: 150, top: -45, right: -30 }]} />
        <View style={[styles.bubble, { width: 85, height: 85, top: 25, right: 75 }]} />
        <View style={[styles.bubble, { width: 55, height: 55, bottom: -15, left: 45 }]} />

        <Text style={styles.heroTitle}>Olá, {firstName}! 🐾</Text>
        <Text style={styles.heroSub}>Tudo organizado em um só lugar</Text>

        <View style={styles.heroPanel}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum}>{pets.length}</Text>
            <Text style={styles.heroStatLabel}>Pets</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum}>{vaccines.length}</Text>
            <Text style={styles.heroStatLabel}>Vacinas</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatNum, (late + warning) > 0 && styles.heroStatAlert]}>
              {late + warning}
            </Text>
            <Text style={styles.heroStatLabel}>Alertas</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Status das Vacinas */}
      <Text style={styles.sectionTitle}>Status das Vacinas</Text>
      <View style={styles.vaccineRow}>
        <View style={[styles.vaccineCard, styles.vaccineOk]}>
          <Image source={ICON_CHECK} style={styles.vaccineCardIcon} resizeMode="contain" />
          <Text style={styles.vaccineCount}>{ok}</Text>
          <Text style={styles.vaccineLabel}>Em dia</Text>
        </View>
        <View style={[styles.vaccineCard, styles.vaccineWarn]}>
          <Image source={ICON_WARNING} style={styles.vaccineCardIcon} resizeMode="contain" />
          <Text style={styles.vaccineCount}>{warning}</Text>
          <Text style={styles.vaccineLabel}>Vencendo</Text>
        </View>
        <View style={[styles.vaccineCard, styles.vaccineLate]}>
          <Image source={ICON_LATE} style={styles.vaccineCardIcon} resizeMode="contain" />
          <Text style={styles.vaccineCount}>{late}</Text>
          <Text style={styles.vaccineLabel}>Atrasadas</Text>
        </View>
      </View>

      {/* Meus Pets */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Meus Pets</Text>
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
              <LinearGradient colors={['#DBEAFE', '#EFF6FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.petEmojiWrap}>
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
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 28, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroTitle: { fontSize: 27, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 20 },
  heroPanel: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 18, padding: 16 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroStatAlert: { color: '#FEF08A' },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 12, paddingHorizontal: 20, marginTop: 22 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 22, marginBottom: 12 },
  addBtnWrap: { borderRadius: 22, overflow: 'hidden' },
  addBtnGrad: { paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  vaccineRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  vaccineCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1 },
  vaccineOk: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  vaccineWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  vaccineLate: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  vaccineCardIcon: { width: 32, height: 32, marginBottom: 6 },
  vaccineCount: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  vaccineLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },

  emptyState: { backgroundColor: '#fff', borderRadius: 22, padding: 36, alignItems: 'center', marginHorizontal: 20, shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#EFF6FF' },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 24 },
  emptyBtn: { borderRadius: 16, paddingHorizontal: 30, paddingVertical: 14 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  petCard: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginHorizontal: 20, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#EFF6FF' },
  petEmojiWrap: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
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
