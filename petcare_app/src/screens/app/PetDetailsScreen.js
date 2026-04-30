import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import WeightChart from '../../components/WeightChart';

const SUGGESTED_VACCINES = {
  Cachorro: [
    { name: 'V8/V10 (Polivalente)', desc: 'Proteção contra cinomose, parvovirose, hepatite, leptospirose e outras doenças' },
    { name: 'Antirrábica', desc: 'Proteção contra a raiva — obrigatória por lei' },
    { name: 'Giárdia', desc: 'Previne a giardíase, doença intestinal comum' },
    { name: 'Gripe Canina (Tosse dos Canis)', desc: 'Proteção contra bordetella e parainfluenza' },
    { name: 'Leishmaniose', desc: 'Prevenção de leishmaniose visceral canina' },
    { name: 'Lyme', desc: 'Proteção contra borreliose transmitida por carrapatos' },
  ],
  Gato: [
    { name: 'Tríplice Felina', desc: 'Proteção contra rinotraqueíte, calicivirose e panleucopenia' },
    { name: 'Quádrupla Felina', desc: 'Tríplice + clamidiose felina' },
    { name: 'Antirrábica', desc: 'Proteção contra a raiva — obrigatória por lei' },
    { name: 'Leucemia Felina (FeLV)', desc: 'Previne a leucemia viral felina' },
  ],
};

const SPECIES_EMOJI = { Cachorro: '🐶', Gato: '🐱', Ave: '🐦', Coelho: '🐰', Hamster: '🐹', Réptil: '🦎', Outro: '🐾' };

const formatDate = (d) => {
  if (!d) return '—';
  const s = String(d).split('T')[0];
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
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

function VaccineStatusBadge({ status }) {
  const config = {
    'Em dia':   { bg: '#DCFCE7', color: '#16A34A' },
    'Vencendo': { bg: '#FEF9C3', color: '#B45309' },
    'Atrasada': { bg: '#FEE2E2', color: '#DC2626' },
    'Pendente': { bg: '#EFF6FF', color: '#0369A1' },
  };
  const c = config[status] || config['Pendente'];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.color }]}>{status}</Text>
    </View>
  );
}

function VaccineCard({ vaccine, registered, onRegister }) {
  const today = new Date();
  let status = 'Pendente';
  if (registered) {
    if (!registered.next_dose_date) status = 'Em dia';
    else {
      const next = new Date(registered.next_dose_date);
      const days = Math.floor((next - today) / (1000 * 60 * 60 * 24));
      if (days < 0) status = 'Atrasada';
      else if (days <= 30) status = 'Vencendo';
      else status = 'Em dia';
    }
  }
  const dotColor = { 'Em dia': '#10B981', 'Vencendo': '#F59E0B', 'Atrasada': '#EF4444', 'Pendente': '#BAE6FD' };

  return (
    <View style={styles.vaccineCard}>
      <View style={[styles.vaccineDot, { backgroundColor: dotColor[status] }]} />
      <View style={styles.vaccineCardContent}>
        <View style={styles.vaccineCardHeader}>
          <Text style={styles.vaccineCardName}>{vaccine.name}</Text>
          <VaccineStatusBadge status={status} />
        </View>
        <Text style={styles.vaccineCardDesc}>{vaccine.desc}</Text>
        {registered ? (
          <Text style={styles.vaccineCardDate}>
            Aplicada: {formatDate(registered.applied_date)}
            {registered.next_dose_date ? `  •  Próxima: ${formatDate(registered.next_dose_date)}` : ''}
          </Text>
        ) : (
          <TouchableOpacity style={styles.registerBtn} onPress={() => onRegister(vaccine.name)}>
            <LinearGradient
              colors={['#0EA5E9', '#38BDF8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.registerBtnGrad}
            >
              <Text style={styles.registerBtnText}>Registrar</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function TimelineItem({ item }) {
  const icons = { vaccine: '💉', expense: '💰', weight: '⚖️', medical: '🏥' };
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDotWrap}>
        <View style={styles.timelineDot} />
        <View style={styles.timelineLine} />
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineDate}>{item.displayDate}</Text>
        <View style={styles.timelineCard}>
          <Text style={styles.timelineIcon}>{icons[item.type] || '📋'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.timelineTitle}>{item.title}</Text>
            {item.subtitle ? <Text style={styles.timelineSubtitle}>{item.subtitle}</Text> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function PetDetailsScreen({ route, navigation }) {
  const { petId } = route.params;
  const [pet, setPet] = useState(null);
  const [vaccines, setVaccines] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [weightRecords, setWeightRecords] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('vacinas');

  const fetchData = async () => {
    const [petRes, vacRes, expRes, wRes, medRes] = await Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase.from('vaccines').select('*').eq('pet_id', petId).order('applied_date', { ascending: false }),
      supabase.from('expenses').select('*').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('weight_records').select('*').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('medical_records').select('*').eq('pet_id', petId).order('date', { ascending: false }),
    ]);
    if (petRes.data) setPet(petRes.data);
    if (vacRes.data) setVaccines(vacRes.data);
    if (expRes.data) setExpenses(expRes.data);
    if (wRes.data) setWeightRecords(wRes.data);
    if (medRes.data) setMedicalRecords(medRes.data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleDelete = () => {
    Alert.alert('Remover pet', `Deseja remover ${pet?.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        await supabase.from('pets').delete().eq('id', petId);
        navigation.goBack();
      }},
    ]);
  };

  const handleRegisterVaccine = (vaccineName) => {
    navigation.navigate('AddVaccine', { petId, petName: pet.name, petSpecies: pet.species, prefillName: vaccineName });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  if (!pet) return null;

  const age = calcAge(pet.birth_date);
  const emoji = SPECIES_EMOJI[pet.species] || '🐾';
  const suggested = SUGGESTED_VACCINES[pet.species] || [];
  const now = new Date();

  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, e) => s + Number(e.amount), 0);

  const pendingCount = suggested.filter(s => !vaccines.find(v => v.name.toLowerCase().includes(s.name.split(' ')[0].toLowerCase()))).length;
  const nextVaccine = vaccines.find(v => v.next_dose_date && new Date(v.next_dose_date) > now);
  const latestWeight = weightRecords[0];

  const timeline = [
    ...vaccines.map(v => ({ type: 'vaccine', date: v.applied_date, displayDate: formatDate(v.applied_date), title: v.name, subtitle: `Aplicada${v.veterinarian ? ` — ${v.veterinarian}` : ''}` })),
    ...expenses.slice(0, 5).map(e => ({ type: 'expense', date: e.date, displayDate: formatDate(e.date), title: e.description || e.category, subtitle: `R$ ${Number(e.amount).toFixed(2)}` })),
    ...weightRecords.slice(0, 5).map(w => ({ type: 'weight', date: w.date, displayDate: formatDate(w.date), title: `Peso: ${w.weight_kg} kg`, subtitle: w.notes })),
    ...medicalRecords.slice(0, 5).map(m => ({ type: 'medical', date: m.date, displayDate: formatDate(m.date), title: m.title, subtitle: m.type })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pet.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('PetQR', { petId })}>
            <Text style={styles.headerBtnIcon}>📱</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleDelete}>
            <Text style={styles.headerBtnIcon}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
      >
        {/* Card principal */}
        <View style={styles.petCard}>
          {/* Avatar + info */}
          <View style={styles.petTop}>
            <LinearGradient
              colors={['#DBEAFE', '#EFF6FF']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.petAvatarWrap}
            >
              <Text style={styles.petEmoji}>{emoji}</Text>
            </LinearGradient>
            <View style={styles.petMeta}>
              <Text style={styles.petName}>{pet.name}</Text>
              <View style={styles.petTagsRow}>
                {pet.species && <View style={styles.petTag}><Text style={styles.petTagText}>{pet.species}</Text></View>}
                {pet.breed && <View style={styles.petTag}><Text style={styles.petTagText}>{pet.breed}</Text></View>}
                {pet.neutered && <View style={[styles.petTag, styles.petTagBlue]}><Text style={[styles.petTagText, { color: '#0369A1' }]}>Castrado</Text></View>}
              </View>
              <Text style={styles.petInfoRow}>
                {age ? `Idade: ${age}` : ''}
                {age ? '  •  ' : ''}
                {pet.birth_date ? `Nasc.: ${formatDate(pet.birth_date)}` : ''}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>PRÓXIMAS{'\n'}VACINAS</Text>
              <Text style={styles.statValue}>{pendingCount}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Text style={styles.statLabel}>PRÓXIMA{'\n'}VACINA</Text>
              <Text style={[styles.statValue, styles.statValueSm]} numberOfLines={1}>
                {nextVaccine?.name?.split(' ')[0] || '—'}
              </Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Text style={styles.statLabel}>GASTOS DO{'\n'}MÊS</Text>
              <Text style={styles.statValue}>R${monthExpenses.toFixed(0)}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Text style={styles.statLabel}>PESO{'\n'}ATUAL</Text>
              <Text style={styles.statValue}>{latestWeight ? `${latestWeight.weight_kg}kg` : '—'}</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            {['vacinas', 'linha', 'evolução'].map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tab: Vacinas */}
        {activeTab === 'vacinas' && (
          <View style={styles.tabContent}>
            <View style={styles.tabContentHeader}>
              <Text style={styles.tabContentTitle}>Carteira de Vacinação</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AddVaccine', { petId, petName: pet.name, petSpecies: pet.species })}>
                <Text style={styles.tabContentAdd}>+ Adicionar</Text>
              </TouchableOpacity>
            </View>
            {suggested.map(sv => {
              const registered = vaccines.find(v => v.name.toLowerCase().includes(sv.name.split(' ')[0].toLowerCase()));
              return (
                <VaccineCard key={sv.name} vaccine={sv} registered={registered} onRegister={handleRegisterVaccine} />
              );
            })}
            {vaccines.filter(v => !suggested.find(s => v.name.toLowerCase().includes(s.name.split(' ')[0].toLowerCase()))).map(v => (
              <VaccineCard
                key={v.id}
                vaccine={{ name: v.name, desc: v.notes || '' }}
                registered={v}
                onRegister={handleRegisterVaccine}
              />
            ))}
          </View>
        )}

        {/* Tab: Linha do tempo */}
        {activeTab === 'linha' && (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentTitle}>Linha do Tempo</Text>
            {timeline.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyText}>Nenhum registro ainda</Text>
              </View>
            ) : (
              timeline.map((item, i) => <TimelineItem key={i} item={item} />)
            )}
          </View>
        )}

        {/* Tab: Evolução */}
        {activeTab === 'evolução' && (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentTitle}>Evolução de Peso</Text>
            <View style={styles.chartCard}>
              <WeightChart records={[...weightRecords].sort((a, b) => new Date(a.date) - new Date(b.date))} />
            </View>
            <TouchableOpacity
              style={styles.addWeightBtnWrap}
              onPress={() => navigation.navigate('AddWeight', { petId, petName: pet.name, currentWeight: latestWeight?.weight_kg })}
            >
              <LinearGradient
                colors={['#0EA5E9', '#38BDF8']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.addWeightBtnGrad}
              >
                <Text style={styles.addWeightBtnText}>+ Registrar peso</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('WeightHistory', { petId, petName: pet.name })}>
              <Text style={styles.viewHistoryLink}>Ver histórico completo →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#EFF6FF',
  },
  backBtn: { marginRight: 12, padding: 4 },
  backIcon: { fontSize: 22, color: '#0EA5E9' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1E293B' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { padding: 6 },
  headerBtnIcon: { fontSize: 18 },

  content: { paddingBottom: 40 },

  petCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 22,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 14, elevation: 4,
    overflow: 'hidden',
  },

  petTop: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 14 },
  petAvatarWrap: {
    width: 70, height: 70, borderRadius: 35,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#BFDBFE',
  },
  petEmoji: { fontSize: 38 },
  petMeta: { flex: 1 },
  petName: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  petTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  petTag: { backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  petTagBlue: { backgroundColor: '#DBEAFE' },
  petTagText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  petInfoRow: { fontSize: 12, color: '#94A3B8' },

  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EFF6FF' },
  statBox: { flex: 1, padding: 12, alignItems: 'center' },
  statBoxBorder: { borderLeftWidth: 1, borderLeftColor: '#EFF6FF' },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', textAlign: 'center', letterSpacing: 0.3, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  statValueSm: { fontSize: 13 },

  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EFF6FF' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#0EA5E9' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  tabBtnTextActive: { color: '#0EA5E9' },

  tabContent: { paddingHorizontal: 16, paddingTop: 4 },
  tabContentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  tabContentTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 8, marginBottom: 12 },
  tabContentAdd: { fontSize: 14, fontWeight: '600', color: '#0EA5E9' },

  vaccineCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'flex-start',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#F0F9FF',
  },
  vaccineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, marginRight: 12, flexShrink: 0 },
  vaccineCardContent: { flex: 1 },
  vaccineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  vaccineCardName: { fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1 },
  vaccineCardDesc: { fontSize: 12, color: '#64748B', lineHeight: 17, marginBottom: 10 },
  vaccineCardDate: { fontSize: 11, color: '#94A3B8' },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  registerBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 2 },
  registerBtnGrad: { paddingVertical: 9, alignItems: 'center' },
  registerBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  timelineItem: { flexDirection: 'row', marginBottom: 4 },
  timelineDotWrap: { alignItems: 'center', width: 20, marginRight: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0EA5E9', marginTop: 14 },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#E0F2FE', marginTop: 2 },
  timelineContent: { flex: 1, paddingBottom: 12 },
  timelineDate: { fontSize: 11, color: '#94A3B8', marginTop: 12, marginBottom: 4 },
  timelineCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  timelineIcon: { fontSize: 20 },
  timelineTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  timelineSubtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  chartCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  addWeightBtnWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  addWeightBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  addWeightBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  viewHistoryLink: { textAlign: 'center', color: '#0EA5E9', fontWeight: '600', fontSize: 14, paddingVertical: 4 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 18, padding: 32, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#94A3B8' },
});
