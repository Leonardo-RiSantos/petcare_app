import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const SPECIES_EMOJI = {
  Cachorro: '🐶', Gato: '🐱', Ave: '🐦',
  Coelho: '🐰', Hamster: '🐹', Réptil: '🦎', Outro: '🐾',
};

function calcVaccineStatus(vaccines) {
  const today = new Date();
  const in30Days = new Date();
  in30Days.setDate(today.getDate() + 30);

  let ok = 0, warning = 0, late = 0;
  vaccines.forEach(v => {
    if (!v.next_dose_date) { ok++; return; }
    const next = new Date(v.next_dose_date);
    if (next < today) late++;
    else if (next <= in30Days) warning++;
    else ok++;
  });
  return { ok, warning, late };
}

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [pets, setPets] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    const [petsRes, vacRes] = await Promise.all([
      supabase.from('pets').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('vaccines').select('*').eq('user_id', user.id),
    ]);
    if (petsRes.data) setPets(petsRes.data);
    if (vacRes.data) setVaccines(vacRes.data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchData(); };
  const { ok, warning, late } = calcVaccineStatus(vaccines);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, tutor! 🐾</Text>
        <Text style={styles.subtitle}>Tudo organizado em um só lugar</Text>
      </View>

      <Text style={styles.sectionTitle}>Status das Vacinas</Text>
      <View style={styles.vaccineCards}>
        <View style={[styles.vaccineCard, styles.vaccineOk]}>
          <Text style={styles.vaccineIcon}>✅</Text>
          <Text style={styles.vaccineCount}>{ok}</Text>
          <Text style={styles.vaccineLabel}>Em dia</Text>
        </View>
        <View style={[styles.vaccineCard, styles.vaccineWarn]}>
          <Text style={styles.vaccineIcon}>⚠️</Text>
          <Text style={styles.vaccineCount}>{warning}</Text>
          <Text style={styles.vaccineLabel}>Vencendo</Text>
        </View>
        <View style={[styles.vaccineCard, styles.vaccineLate]}>
          <Text style={styles.vaccineIcon}>❌</Text>
          <Text style={styles.vaccineCount}>{late}</Text>
          <Text style={styles.vaccineLabel}>Atrasadas</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Meus Pets</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddPet')}>
          <Text style={styles.addButton}>+ Adicionar</Text>
        </TouchableOpacity>
      </View>

      {pets.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🐶🐱</Text>
          <Text style={styles.emptyText}>Nenhum pet cadastrado ainda</Text>
          <Text style={styles.emptySubtext}>Adicione seu primeiro pet para começar!</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('AddPet')}>
            <Text style={styles.emptyButtonText}>Adicionar pet</Text>
          </TouchableOpacity>
        </View>
      ) : (
        pets.map(pet => {
          const petVaccines = vaccines.filter(v => v.pet_id === pet.id);
          const status = calcVaccineStatus(petVaccines);
          return (
            <TouchableOpacity
              key={pet.id}
              style={styles.petCard}
              onPress={() => navigation.navigate('PetDetails', { petId: pet.id })}
            >
              <View style={styles.petEmoji}>
                <Text style={{ fontSize: 32 }}>{SPECIES_EMOJI[pet.species] || '🐾'}</Text>
              </View>
              <View style={styles.petInfo}>
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petBreed}>{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</Text>
                {pet.weight_kg && <Text style={styles.petWeight}>{pet.weight_kg} kg</Text>}
              </View>
              <View style={styles.petVaccineStatus}>
                {status.late > 0 ? (
                  <View style={[styles.statusBadge, styles.statusLate]}>
                    <Text style={styles.statusText}>Atrasada</Text>
                  </View>
                ) : status.warning > 0 ? (
                  <View style={[styles.statusBadge, styles.statusWarn]}>
                    <Text style={styles.statusText}>Vencendo</Text>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, styles.statusOk]}>
                    <Text style={styles.statusText}>Em dia</Text>
                  </View>
                )}
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
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#1E293B' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  addButton: { color: '#0EA5E9', fontWeight: '600', fontSize: 14 },
  vaccineCards: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  vaccineCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1 },
  vaccineOk: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  vaccineWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  vaccineLate: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  vaccineIcon: { fontSize: 22, marginBottom: 4 },
  vaccineCount: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
  vaccineLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  emptyState: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 20 },
  emptyButton: { backgroundColor: '#0EA5E9', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  petCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  petEmoji: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#F0F9FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  petInfo: { flex: 1 },
  petName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  petBreed: { fontSize: 13, color: '#64748B', marginTop: 2 },
  petWeight: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  petVaccineStatus: { marginLeft: 8 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusOk: { backgroundColor: '#DCFCE7' },
  statusWarn: { backgroundColor: '#FEF9C3' },
  statusLate: { backgroundColor: '#FFE4E6' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#1E293B' },
});
