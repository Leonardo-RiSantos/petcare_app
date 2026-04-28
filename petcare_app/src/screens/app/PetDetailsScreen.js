import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';

const SPECIES_EMOJI = {
  Cachorro: '🐶', Gato: '🐱', Ave: '🐦',
  Coelho: '🐰', Hamster: '🐹', Réptil: '🦎', Outro: '🐾',
};

function calcAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}

export default function PetDetailsScreen({ route, navigation }) {
  const { petId } = route.params;
  const [pet, setPet] = useState(null);
  const [vaccines, setVaccines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [petRes, vacRes] = await Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase.from('vaccines').select('*').eq('pet_id', petId).order('applied_date', { ascending: false }),
    ]);
    if (petRes.data) setPet(petRes.data);
    if (vacRes.data) setVaccines(vacRes.data);
    setLoading(false);
  };

  const handleDelete = () => {
    Alert.alert('Remover pet', `Deseja remover ${pet?.name}? Esta ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          await supabase.from('pets').delete().eq('id', petId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!pet) return null;

  const age = calcAge(pet.birth_date);
  const emoji = SPECIES_EMOJI[pet.species] || '🐾';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>{emoji}</Text>
        <Text style={styles.heroName}>{pet.name}</Text>
        <Text style={styles.heroSubtitle}>
          {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}{age ? ` · ${age}` : ''}
        </Text>
        <View style={styles.heroBadges}>
          {pet.sex && <View style={styles.badge}><Text style={styles.badgeText}>{pet.sex}</Text></View>}
          {pet.neutered && <View style={styles.badge}><Text style={styles.badgeText}>Castrado(a)</Text></View>}
          {pet.weight_kg && <View style={styles.badge}><Text style={styles.badgeText}>{pet.weight_kg} kg</Text></View>}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vacinas</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddVaccine', { petId, petName: pet.name })}>
            <Text style={styles.addLink}>+ Adicionar</Text>
          </TouchableOpacity>
        </View>

        {vaccines.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Nenhuma vacina cadastrada</Text>
          </View>
        ) : (
          vaccines.map(v => (
            <View key={v.id} style={styles.vaccineItem}>
              <View>
                <Text style={styles.vaccineName}>{v.name}</Text>
                <Text style={styles.vaccineDate}>Aplicada: {v.applied_date}</Text>
                {v.next_dose_date && (
                  <Text style={styles.vaccineNext}>Próxima: {v.next_dose_date}</Text>
                )}
              </View>
              <View style={styles.vaccineStatus}>
                <Text style={styles.vaccineStatusDot}>✅</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteText}>Remover pet</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  heroEmoji: { fontSize: 64, marginBottom: 8 },
  heroName: { fontSize: 26, fontWeight: '700', color: '#1E293B' },
  heroSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 12 },
  heroBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  badge: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontSize: 13, color: '#3B82F6', fontWeight: '500' },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  addLink: { color: '#0EA5E9', fontWeight: '600', fontSize: 14 },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center',
  },
  emptyText: { color: '#94A3B8', fontSize: 14 },
  vaccineItem: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  vaccineName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  vaccineDate: { fontSize: 13, color: '#64748B', marginTop: 2 },
  vaccineNext: { fontSize: 13, color: '#F59E0B', marginTop: 2 },
  vaccineStatus: { alignItems: 'center' },
  vaccineStatusDot: { fontSize: 20 },
  deleteButton: {
    borderWidth: 1, borderColor: '#FECDD3', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  deleteText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
});
