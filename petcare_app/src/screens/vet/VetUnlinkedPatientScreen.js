import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const ICON_MEDICAL  = require('../../../assets/icon_medical.png');
const ICON_MEDICINE = require('../../../assets/icon_medicine.png');
const ICON_WEIGHT   = require('../../../assets/icon_weight.png');
const ICON_EXPENSES = require('../../../assets/icon_expenses.png');

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
  Peixe:    require('../../../assets/pet_peixe.png'),
};

const fmt = (d) => { if (!d) return '—'; const [y,m,dd] = String(d).split('T')[0].split('-'); return `${dd}/${m}/${y}`; };
const TYPE_COLORS = { consulta: '#0EA5E9', retorno: '#10B981', cirurgia: '#8B5CF6', exame: '#F59E0B', vacinacao: '#16A34A', outro: '#64748B' };
const TYPE_LABELS = { consulta: 'Consulta', retorno: 'Retorno', cirurgia: 'Cirurgia', exame: 'Exame', vacinacao: 'Vacinação', outro: 'Outro' };

export default function VetUnlinkedPatientScreen({ route, navigation }) {
  const { patientId } = route.params;
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [billing, setBilling] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    const [patRes, consRes, billRes] = await Promise.all([
      supabase.from('vet_unlinked_patients').select('*').eq('id', patientId).single(),
      supabase.from('vet_consultations')
        .select('id, date, type, chief_complaint, diagnosis, visible_to_owner')
        .eq('unlinked_patient_id', patientId)
        .order('date', { ascending: false }),
      supabase.from('vet_billing')
        .select('id, description, amount, status, created_at')
        .eq('unlinked_patient_id', patientId)
        .order('created_at', { ascending: false }),
    ]);
    if (patRes.data)  setPatient(patRes.data);
    if (consRes.data) setConsultations(consRes.data);
    if (billRes.data) setBilling(billRes.data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [patientId]));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading || !patient) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;

  const speciesImg = SPECIES_IMAGES[patient.species];
  const totalPending = billing.filter(b => b.status === 'pending').reduce((s,b) => s + (b.amount||0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F9FF' }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
      >
        {/* Card do paciente */}
        <View style={styles.patientCard}>
          <View style={styles.patientTop}>
            <LinearGradient colors={['#F5F3FF', '#EDE9FE']} style={styles.patientAvatar}>
              {speciesImg
                ? <Image source={speciesImg} style={{ width: 44, height: 44 }} resizeMode="contain" />
                : <Text style={{ fontSize: 36 }}>🐾</Text>}
            </LinearGradient>
            <View style={styles.patientMeta}>
              <View style={styles.patientNameRow}>
                <Text style={styles.patientName}>{patient.name}</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('VetAddUnlinkedPatient', { patientId })}
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnTxt}>✏️</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.clinicBadge]}><Text style={styles.clinicBadgeTxt}>Paciente da Clínica</Text></View>
            </View>
          </View>

          {/* Info grid */}
          <View style={styles.infoGrid}>
            {patient.species   && <View style={styles.infoCell}><Text style={styles.infoCellLabel}>ESPÉCIE</Text><Text style={styles.infoCellValue}>{patient.species}</Text></View>}
            {patient.breed     && <View style={styles.infoCell}><Text style={styles.infoCellLabel}>RAÇA</Text><Text style={styles.infoCellValue}>{patient.breed}</Text></View>}
            {patient.sex       && <View style={styles.infoCell}><Text style={styles.infoCellLabel}>SEXO</Text><Text style={styles.infoCellValue}>{patient.sex}</Text></View>}
            {patient.birth_date && <View style={styles.infoCell}><Text style={styles.infoCellLabel}>NASCIMENTO</Text><Text style={styles.infoCellValue}>{fmt(patient.birth_date)}</Text></View>}
            {patient.weight_kg  && <View style={styles.infoCell}><Text style={styles.infoCellLabel}>PESO</Text><Text style={styles.infoCellValue}>{patient.weight_kg} kg</Text></View>}
            {patient.neutered   && <View style={styles.infoCell}><Text style={styles.infoCellLabel}>CASTRADO</Text><Text style={[styles.infoCellValue, { color: '#16A34A' }]}>Sim ✓</Text></View>}
          </View>

          {/* Tutor */}
          {(patient.owner_name || patient.owner_phone) && (
            <View style={styles.ownerRow}>
              <Text style={styles.ownerLabel}>Tutor: </Text>
              <Text style={styles.ownerValue}>
                {patient.owner_name}{patient.owner_phone ? ` · ${patient.owner_phone}` : ''}
              </Text>
            </View>
          )}

          {/* Pendente financeiro */}
          {totalPending > 0 && (
            <View style={styles.pendingBanner}>
              <Image source={ICON_EXPENSES} style={{ width: 16, height: 16, marginRight: 6 }} resizeMode="contain" />
              <Text style={styles.pendingTxt}>R$ {totalPending.toFixed(2)} pendente</Text>
              <TouchableOpacity onPress={() => navigation.navigate('VetFinancial')}>
                <Text style={styles.pendingLink}>Ver →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Ação: nova consulta */}
          <TouchableOpacity
            style={styles.newConsultBtn}
            onPress={() => navigation.navigate('VetConsultation', { unlinkedId: patientId, petName: patient.name })}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#0284C7', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.newConsultGrad}>
              <Image source={ICON_MEDICAL} style={{ width: 16, height: 16, marginRight: 8 }} resizeMode="contain" />
              <Text style={styles.newConsultTxt}>+ Nova Consulta / Prontuário</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Histórico de consultas */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Histórico de Consultas</Text>
          <Text style={styles.sectionCount}>{consultations.length}</Text>
        </View>

        {consultations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Image source={ICON_MEDICAL} style={{ width: 36, height: 36, opacity: 0.25, marginBottom: 8 }} resizeMode="contain" />
            <Text style={styles.emptyTxt}>Nenhuma consulta registrada</Text>
          </View>
        ) : consultations.map(c => {
          const color = TYPE_COLORS[c.type] || '#64748B';
          return (
            <TouchableOpacity
              key={c.id}
              style={styles.consultCard}
              onPress={() => navigation.navigate('VetConsultation', { consultationId: c.id, unlinkedId: patientId, petName: patient.name })}
              activeOpacity={0.82}
            >
              <View style={[styles.consultStripe, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.consultRow}>
                  <Text style={styles.consultDate}>{fmt(c.date)}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.typeBadgeTxt, { color }]}>{TYPE_LABELS[c.type] || c.type}</Text>
                  </View>
                </View>
                {c.chief_complaint && <Text style={styles.consultComplaint} numberOfLines={1}>{c.chief_complaint}</Text>}
                {c.diagnosis && <Text style={styles.consultDiagnosis} numberOfLines={1}>Dx: {c.diagnosis}</Text>}
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  patientCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4,
  },
  patientTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  patientAvatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  patientMeta: { flex: 1 },
  patientNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  patientName: { fontSize: 22, fontWeight: '900', color: '#1E293B', flex: 1 },
  editBtn: { padding: 4, backgroundColor: '#EFF6FF', borderRadius: 8 },
  editBtnTxt: { fontSize: 14 },
  clinicBadge: { alignSelf: 'flex-start', backgroundColor: '#EDE9FE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  clinicBadgeTxt: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, gap: 0 },
  infoCell: { width: '33.33%', paddingHorizontal: 4, paddingVertical: 8 },
  infoCellLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.8, marginBottom: 3 },
  infoCellValue: { fontSize: 13, fontWeight: '700', color: '#1E293B' },

  ownerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ownerLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  ownerValue: { fontSize: 12, color: '#374151', flex: 1 },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 10, marginTop: 12,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  pendingTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: '#D97706' },
  pendingLink: { fontSize: 13, color: '#0EA5E9', fontWeight: '700' },

  newConsultBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 14 },
  newConsultGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  newConsultTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  sectionCount: { fontSize: 13, fontWeight: '700', color: '#0EA5E9', backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 18, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#E0F2FE' },
  emptyTxt: { fontSize: 14, color: '#94A3B8' },

  consultCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  consultStripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  consultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  consultDate: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  consultComplaint: { fontSize: 13, color: '#374151', marginBottom: 2 },
  consultDiagnosis: { fontSize: 12, color: '#64748B' },
  typeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeTxt: { fontSize: 11, fontWeight: '700' },
  arrow: { fontSize: 20, color: '#BAE6FD' },
});
