import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';

const SPECIES_EMOJI = { Cachorro: '🐶', Gato: '🐱', Ave: '🐦', Coelho: '🐰', Hamster: '🐹', Réptil: '🦎', Outro: '🐾' };

function calcAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 12) return `${months} meses`;
  return `${Math.floor(months / 12)} anos`;
}

const TYPE_EMOJI = { consulta: '🏥', cirurgia: '⚕️', exame: '🔬', alergia: '⚠️', medicamento: '💊', outro: '📋' };
const TYPE_COLOR = { consulta: '#3B82F6', cirurgia: '#8B5CF6', exame: '#F59E0B', alergia: '#EF4444', medicamento: '#EC4899', outro: '#64748B' };

export default function VetPatientScreen({ route, navigation }) {
  const { petId, petName } = route.params;
  const [pet, setPet] = useState(null);
  const [records, setRecords] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [petRes, recRes, vacRes, wRes] = await Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase.from('medical_records').select('*').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('vaccines').select('*').eq('pet_id', petId).order('applied_date', { ascending: false }),
      supabase.from('weight_records').select('*').eq('pet_id', petId).order('date', { ascending: false }).limit(5),
    ]);
    if (petRes.data) setPet(petRes.data);
    if (recRes.data) setRecords(recRes.data);
    if (vacRes.data) setVaccines(vacRes.data);
    if (wRes.data) setWeights(wRes.data);
    setLoading(false);
  };

  const handleRemovePatient = () => {
    Alert.alert('Remover paciente', `Deseja remover ${petName} da sua lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          await supabase.from('pet_vet_links').update({ status: 'removed' }).eq('pet_id', petId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#10B981" /></View>;
  if (!pet) return null;

  const latestWeight = weights[0];
  const overdueVaccines = vaccines.filter(v => v.next_dose_date && new Date(v.next_dose_date) < new Date());

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>{SPECIES_EMOJI[pet.species] || '🐾'}</Text>
        <Text style={styles.heroName}>{pet.name}</Text>
        <Text style={styles.heroSub}>
          {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}{pet.birth_date ? ` · ${calcAge(pet.birth_date)}` : ''}
        </Text>
        <View style={styles.heroBadges}>
          {pet.sex && <View style={styles.badge}><Text style={styles.badgeText}>{pet.sex}</Text></View>}
          {pet.neutered && <View style={styles.badge}><Text style={styles.badgeText}>Castrado(a)</Text></View>}
          {latestWeight && <View style={styles.badge}><Text style={styles.badgeText}>{latestWeight.weight_kg} kg</Text></View>}
        </View>
      </View>

      {/* Alertas */}
      {overdueVaccines.length > 0 && (
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>⚠️ {overdueVaccines.length} vacina(s) atrasada(s)</Text>
          {overdueVaccines.map(v => (
            <Text key={v.id} style={styles.alertItem}>• {v.name} — venceu em {v.next_dose_date}</Text>
          ))}
        </View>
      )}

      {/* Botão adicionar registro */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => navigation.navigate('AddMedicalRecord', { petId, petName: pet.name, isVet: true })}
      >
        <Text style={styles.addBtnText}>👨‍⚕️ Adicionar consulta / registro</Text>
      </TouchableOpacity>

      {/* Vacinas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💉 Vacinas ({vaccines.length})</Text>
        {vaccines.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma vacina cadastrada</Text>
        ) : (
          vaccines.slice(0, 5).map(v => {
            const isLate = v.next_dose_date && new Date(v.next_dose_date) < new Date();
            return (
              <View key={v.id} style={styles.vaccineRow}>
                <Text style={styles.vaccineName}>{v.name}</Text>
                <Text style={[styles.vaccineDate, isLate && styles.overdue]}>
                  {isLate ? '❌ ' : '✅ '}{v.applied_date}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* Histórico médico */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏥 Histórico Médico ({records.length})</Text>
        {records.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum registro médico</Text>
        ) : (
          records.map(r => (
            <View key={r.id} style={[styles.recordCard, { borderLeftColor: TYPE_COLOR[r.type] || '#94A3B8' }]}>
              <View style={styles.recordHeader}>
                <Text style={styles.recordType}>{TYPE_EMOJI[r.type] || '📋'} {r.type}</Text>
                <Text style={styles.recordDate}>{r.date}</Text>
              </View>
              <Text style={styles.recordTitle}>{r.title}</Text>
              {r.diagnosis && <Text style={styles.recordField}>Diagnóstico: {r.diagnosis}</Text>}
              {r.prescription && <Text style={styles.recordField}>Prescrição: {r.prescription}</Text>}
              {r.next_appointment && <Text style={[styles.recordField, { color: '#10B981' }]}>Próxima: {r.next_appointment}</Text>}
              <Text style={styles.recordCreator}>
                {r.created_by_role === 'vet' ? '👨‍⚕️ Veterinário' : '👤 Tutor'}
                {r.veterinarian ? ` · ${r.veterinarian}` : ''}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Remover paciente */}
      <TouchableOpacity style={styles.removeBtn} onPress={handleRemovePatient}>
        <Text style={styles.removeBtnText}>Remover paciente da lista</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF4' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  heroEmoji: { fontSize: 60, marginBottom: 8 },
  heroName: { fontSize: 24, fontWeight: '700', color: '#1E293B' },
  heroSub: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 10 },
  heroBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  badge: { backgroundColor: '#ECFDF5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontSize: 13, color: '#10B981', fontWeight: '500' },
  alertCard: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FED7AA' },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#EA580C', marginBottom: 6 },
  alertItem: { fontSize: 13, color: '#9A3412', marginTop: 2 },
  addBtn: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 },
  vaccineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  vaccineName: { fontSize: 14, color: '#1E293B' },
  vaccineDate: { fontSize: 13, color: '#10B981' },
  overdue: { color: '#EF4444' },
  recordCard: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 12, paddingTop: 4 },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordType: { fontSize: 12, color: '#64748B', textTransform: 'capitalize' },
  recordDate: { fontSize: 12, color: '#94A3B8' },
  recordTitle: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  recordField: { fontSize: 12, color: '#64748B', marginTop: 2 },
  recordCreator: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
  removeBtn: { borderWidth: 1, borderColor: '#FECDD3', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  removeBtnText: { color: '#EF4444', fontWeight: '600' },
});
