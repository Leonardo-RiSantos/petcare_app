import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../hooks/useLayout';
import DatePickerInput from '../../components/DatePickerInput';

const ICON_MEDICAL  = require('../../../assets/icon_medical.png');
const ICON_WARNING  = require('../../../assets/icon_warning.png');
const ICON_MEDICINE = require('../../../assets/icon_medicine.png');
const ICON_DOC      = require('../../../assets/icon_doc.png');

const TYPES = [
  { key: 'consulta',    label: 'Consulta',    icon: ICON_MEDICAL  },
  { key: 'cirurgia',    label: 'Cirurgia',    icon: ICON_MEDICAL  },
  { key: 'exame',       label: 'Exame',       icon: ICON_MEDICAL  },
  { key: 'alergia',     label: 'Alergia',     icon: ICON_WARNING  },
  { key: 'medicamento', label: 'Medicamento', icon: ICON_MEDICINE },
  { key: 'outro',       label: 'Outro',       icon: ICON_DOC      },
];

const todayDDMMYYYY = () => {
  const n = new Date();
  return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}`;
};
const fmtDate = (text) => {
  const d = text.replace(/\D/g,'').slice(0,8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
};
const toStorage = (ddmmyyyy) => {
  if (!ddmmyyyy) return null;
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export default function AddMedicalRecordScreen({ route, navigation }) {
  const { petId, petName, isVet = false, vetName = '' } = route.params || {};
  const { isDesktop } = useLayout();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: '',
    title: '',
    description: '',
    date: todayDDMMYYYY(),
    veterinarian: '',
    diagnosis: '',
    prescription: '',
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.type || !form.title || !form.date) {
      Alert.alert('Atenção', 'Tipo, título e data são obrigatórios.');
      return;
    }

    const dateStorage = toStorage(form.date);
    if (!dateStorage) { Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.'); return; }

    setLoading(true);
    const { error } = await supabase.from('medical_records').insert({
      pet_id: petId,
      user_id: user.id,
      vet_id: isVet ? user.id : null,
      created_by_role: isVet ? 'vet' : 'tutor',
      type: form.type,
      title: form.title,
      description: form.description || null,
      date: dateStorage,
      veterinarian: isVet ? vetName : (form.veterinarian || null),
      diagnosis: form.diagnosis || null,
      prescription: form.prescription || null,
    });
    setLoading(false);

    if (error) Alert.alert('Erro', error.message);
    else navigation.goBack();
  };

  const isVetMode = isVet;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
      <Text style={styles.petName}>Registro para {petName}</Text>

      {/* Tipo */}
      <Text style={styles.label}>Tipo *</Text>
      <View style={styles.typeGrid}>
        {TYPES.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typeCard, form.type === t.key && styles.typeCardActive]}
            onPress={() => set('type', t.key)}
          >
            <Image source={t.icon} style={styles.typeIcon} resizeMode="contain" />
            <Text style={[styles.typeLabel, form.type === t.key && styles.typeLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Título */}
      <Text style={styles.label}>Título *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Consulta de rotina, Raio-X de tórax..."
        placeholderTextColor="#9CA3AF"
        value={form.title}
        onChangeText={v => set('title', v)}
      />

      {/* Data */}
      <Text style={styles.label}>Data *</Text>
      <DatePickerInput
        value={form.date}
        onChangeText={v => set('date', v)}
        label="Data do registro"
      />

      {/* Veterinário — só aparece no modo tutor */}
      {!isVet && (
        <>
          <Text style={styles.label}>Veterinário</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome do veterinário"
            placeholderTextColor="#9CA3AF"
            value={form.veterinarian}
            onChangeText={v => set('veterinarian', v)}
          />
        </>
      )}

      {/* Descrição */}
      <Text style={styles.label}>Observações</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="Detalhes da consulta, procedimento..."
        placeholderTextColor="#9CA3AF"
        value={form.description}
        onChangeText={v => set('description', v)}
        multiline numberOfLines={3}
      />

      {/* Campos extras para modo vet */}
      {isVetMode && (
        <>
          <View style={[styles.vetBanner, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }]}>
            <Image source={ICON_MEDICAL} style={{ width: 18, height: 18 }} resizeMode="contain" />
            <Text style={styles.vetBannerText}>Campos profissionais</Text>
          </View>

          <Text style={styles.label}>Diagnóstico</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Diagnóstico clínico..."
            placeholderTextColor="#9CA3AF"
            value={form.diagnosis}
            onChangeText={v => set('diagnosis', v)}
            multiline numberOfLines={3}
          />

          <Text style={styles.label}>Prescrição</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Medicamentos, doses, frequência..."
            placeholderTextColor="#9CA3AF"
            value={form.prescription}
            onChangeText={v => set('prescription', v)}
            multiline numberOfLines={3}
          />

          <View style={styles.agendaBanner}>
            <Text style={styles.agendaBannerText}>📅 Para marcar consultas, use o botão "Agendar" na tela do paciente</Text>
          </View>
        </>
      )}

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar registro</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 40 },
  contentDesktop: { maxWidth: 720, alignSelf: 'center', width: '100%', paddingHorizontal: 32 },
  petName: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B',
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  typeCardActive: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  typeEmoji: { fontSize: 24, marginBottom: 4 },
  typeLabel: { fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center' },
  typeLabelActive: { color: '#0EA5E9', fontWeight: '700' },
  typeIcon: { width: 24, height: 24, marginBottom: 4 },
  vetBanner: {
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12,
    marginTop: 20, borderWidth: 1, borderColor: '#BAE6FD',
  },
  vetBannerText: { color: '#0EA5E9', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  agendaBanner: {
    backgroundColor: '#F5F3FF', borderRadius: 10, padding: 12,
    marginTop: 16, borderWidth: 1, borderColor: '#DDD6FE',
  },
  agendaBannerText: { color: '#7C3AED', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  button: {
    backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 32,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
