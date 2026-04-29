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

const CATEGORY_LABEL = {
  racao: 'Ração', veterinario: 'Veterinário', banho_tosa: 'Banho/Tosa',
  remedio: 'Remédio', acessorios: 'Acessórios', outros: 'Outros',
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

function formatCurrency(value) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function calcVaccineStatus(vaccines) {
  const today = new Date();
  const in30 = new Date();
  in30.setDate(today.getDate() + 30);
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

export default function PetDetailsScreen({ route, navigation }) {
  const { petId } = route.params;
  const [pet, setPet] = useState(null);
  const [vaccines, setVaccines] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [weightRecords, setWeightRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [petRes, vacRes, expRes, weightRes] = await Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase.from('vaccines').select('*').eq('pet_id', petId).order('applied_date', { ascending: false }),
      supabase.from('expenses').select('*').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('weight_records').select('*').eq('pet_id', petId).order('date', { ascending: false }),
    ]);
    if (petRes.data) setPet(petRes.data);
    if (vacRes.data) setVaccines(vacRes.data);
    if (expRes.data) setExpenses(expRes.data);
    if (weightRes.data) setWeightRecords(weightRes.data);
    setLoading(false);
  };

  const handleGenerateVetCode = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('vet_invite_codes').insert({
      pet_id: petId,
      tutor_id: pet.user_id,
      code,
    });
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      Alert.alert(
        '🔗 Código de convite gerado',
        `Compartilhe este código com o veterinário:\n\n${code}\n\nVálido por 7 dias.`,
        [{ text: 'OK' }]
      );
    }
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  if (!pet) return null;

  const age = calcAge(pet.birth_date);
  const emoji = SPECIES_EMOJI[pet.species] || '🐾';
  const vaccineStatus = calcVaccineStatus(vaccines);

  const now = new Date();
  const totalMes = expenses
    .filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalGeral = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const recentExpenses = expenses.slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Hero */}
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

      {/* Atalhos rápidos */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('AddVaccine', { petId, petName: pet.name, petSpecies: pet.species })}
        >
          <Text style={styles.quickBtnEmoji}>💉</Text>
          <Text style={styles.quickBtnText}>Vacina</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('WeightHistory', { petId, petName: pet.name })}
        >
          <Text style={styles.quickBtnEmoji}>⚖️</Text>
          <Text style={styles.quickBtnText}>Peso</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('AddExpense', { petId, pets: [pet] })}
        >
          <Text style={styles.quickBtnEmoji}>💰</Text>
          <Text style={styles.quickBtnText}>Add gasto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('MedicalHistory', { petId, petName: pet.name })}
        >
          <Text style={styles.quickBtnEmoji}>🏥</Text>
          <Text style={styles.quickBtnText}>Histórico</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={handleGenerateVetCode}
        >
          <Text style={styles.quickBtnEmoji}>🔗</Text>
          <Text style={styles.quickBtnText}>Inv. vet</Text>
        </TouchableOpacity>
      </View>

      {/* Card de peso */}
      {(() => {
        const sorted = [...weightRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
        const latest = sorted[sorted.length - 1];
        const prev = sorted[sorted.length - 2];
        const diff = latest && prev ? (Number(latest.weight_kg) - Number(prev.weight_kg)).toFixed(2) : null;
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>⚖️ Peso</Text>
              <TouchableOpacity onPress={() => navigation.navigate('WeightHistory', { petId, petName: pet.name })}>
                <Text style={styles.cardLink}>Ver histórico →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.weightRow}>
              <View>
                <Text style={styles.weightCurrent}>
                  {latest ? `${Number(latest.weight_kg).toFixed(2)} kg` : pet.weight_kg ? `${pet.weight_kg} kg` : '—'}
                </Text>
                {latest && <Text style={styles.weightDate}>Registrado em {latest.date}</Text>}
              </View>
              <View style={styles.weightRight}>
                {diff !== null && (
                  <View style={[styles.diffBadge, Number(diff) > 0 ? styles.diffBadgeUp : Number(diff) < 0 ? styles.diffBadgeDown : styles.diffBadgeStable]}>
                    <Text style={styles.diffBadgeText}>
                      {Number(diff) > 0 ? `+${diff}` : diff} kg
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.addWeightBtn}
                  onPress={() => navigation.navigate('AddWeight', { petId, petName: pet.name, currentWeight: latest?.weight_kg ?? pet.weight_kg })}
                >
                  <Text style={styles.addWeightBtnText}>+ Registrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Resumo financeiro */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>💰 Financeiro</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('ExpensesTab', { petId })}
          >
            <Text style={styles.cardLink}>Ver tudo →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.finRow}>
          <View style={styles.finBox}>
            <Text style={styles.finLabel}>Este mês</Text>
            <Text style={styles.finValue}>{formatCurrency(totalMes)}</Text>
          </View>
          <View style={[styles.finBox, styles.finBoxAlt]}>
            <Text style={[styles.finLabel, { color: '#BAE6FD' }]}>Total geral</Text>
            <Text style={[styles.finValue, { color: '#fff' }]}>{formatCurrency(totalGeral)}</Text>
          </View>
        </View>
        {recentExpenses.length > 0 && (
          <View style={styles.recentExpenses}>
            {recentExpenses.map(e => (
              <View key={e.id} style={styles.expRow}>
                <Text style={styles.expLabel}>{e.description || CATEGORY_LABEL[e.category]}</Text>
                <Text style={styles.expAmount}>{formatCurrency(e.amount)}</Text>
              </View>
            ))}
          </View>
        )}
        {expenses.length === 0 && (
          <Text style={styles.emptyText}>Nenhum gasto registrado</Text>
        )}
      </View>

      {/* Vacinas */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>💉 Vacinas</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddVaccine', { petId, petName: pet.name, petSpecies: pet.species })}
          >
            <Text style={styles.cardLink}>+ Adicionar</Text>
          </TouchableOpacity>
        </View>

        {/* Status badges */}
        <View style={styles.vaccineStatusRow}>
          <View style={[styles.vsBadge, styles.vsOk]}>
            <Text style={styles.vsCount}>{vaccineStatus.ok}</Text>
            <Text style={styles.vsLabel}>Em dia</Text>
          </View>
          <View style={[styles.vsBadge, styles.vsWarn]}>
            <Text style={styles.vsCount}>{vaccineStatus.warning}</Text>
            <Text style={styles.vsLabel}>Vencendo</Text>
          </View>
          <View style={[styles.vsBadge, styles.vsLate]}>
            <Text style={styles.vsCount}>{vaccineStatus.late}</Text>
            <Text style={styles.vsLabel}>Atrasadas</Text>
          </View>
        </View>

        {vaccines.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma vacina cadastrada</Text>
        ) : (
          vaccines.map(v => {
            const today = new Date();
            const next = v.next_dose_date ? new Date(v.next_dose_date) : null;
            const isLate = next && next < today;
            const isWarn = next && !isLate && (next - today) / (1000 * 60 * 60 * 24) <= 30;
            return (
              <View key={v.id} style={styles.vaccineItem}>
                <View style={styles.vaccineItemLeft}>
                  <Text style={styles.vaccineName}>{v.name}</Text>
                  <Text style={styles.vaccineDate}>Aplicada: {v.applied_date}</Text>
                  {v.next_dose_date && (
                    <Text style={[styles.vaccineNext, isLate && styles.vaccineNextLate, isWarn && styles.vaccineNextWarn]}>
                      Próxima: {v.next_dose_date}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 20 }}>{isLate ? '❌' : isWarn ? '⚠️' : '✅'}</Text>
              </View>
            );
          })
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
    backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  heroEmoji: { fontSize: 64, marginBottom: 8 },
  heroName: { fontSize: 26, fontWeight: '700', color: '#1E293B' },
  heroSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 12 },
  heroBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  badge: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontSize: 13, color: '#3B82F6', fontWeight: '500' },

  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  quickBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0',
  },
  quickBtnEmoji: { fontSize: 22, marginBottom: 4 },
  quickBtnText: { fontSize: 12, color: '#64748B', fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  cardLink: { fontSize: 13, color: '#0EA5E9', fontWeight: '600' },

  finRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  finBox: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0',
  },
  finBoxAlt: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  finLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginBottom: 4 },
  finValue: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  recentExpenses: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  expRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  expLabel: { fontSize: 13, color: '#64748B' },
  expAmount: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 },

  vaccineStatusRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  vsBadge: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1 },
  vsOk: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  vsWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  vsLate: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  vsCount: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  vsLabel: { fontSize: 10, color: '#64748B', marginTop: 2 },

  vaccineItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  vaccineItemLeft: { flex: 1 },
  vaccineName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  vaccineDate: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  vaccineNext: { fontSize: 12, color: '#10B981', marginTop: 2 },
  vaccineNextWarn: { color: '#F59E0B' },
  vaccineNextLate: { color: '#EF4444' },

  weightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weightCurrent: { fontSize: 28, fontWeight: '800', color: '#1E293B' },
  weightDate: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  weightRight: { alignItems: 'flex-end', gap: 8 },
  diffBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  diffBadgeUp: { backgroundColor: '#FEF9C3' },
  diffBadgeDown: { backgroundColor: '#DCFCE7' },
  diffBadgeStable: { backgroundColor: '#F1F5F9' },
  diffBadgeText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  addWeightBtn: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addWeightBtnText: { color: '#0EA5E9', fontWeight: '700', fontSize: 13 },

  deleteButton: {
    borderWidth: 1, borderColor: '#FECDD3', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  deleteText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
});
