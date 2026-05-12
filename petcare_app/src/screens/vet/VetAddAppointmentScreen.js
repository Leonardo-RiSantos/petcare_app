import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../hooks/useLayout';
import DatePickerInput from '../../components/DatePickerInput';

const ICON_MEDICAL = require('../../../assets/icon_medical.png');
const ICON_DOC     = require('../../../assets/icon_doc.png');

const TYPES = [
  { key: 'consulta', label: 'Consulta', icon: ICON_MEDICAL },
  { key: 'retorno',  label: 'Retorno',  icon: ICON_MEDICAL },
  { key: 'cirurgia', label: 'Cirurgia', icon: ICON_MEDICAL },
  { key: 'exame',    label: 'Exame',    icon: ICON_MEDICAL },
  { key: 'outro',    label: 'Outro',    icon: ICON_DOC     },
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
const fmtTime = (text) => {
  const d = text.replace(/\D/g,'').slice(0,4);
  if (d.length <= 2) return d;
  return `${d.slice(0,2)}:${d.slice(2)}`;
};
const toStorage = (ddmmyyyy) => {
  if (!ddmmyyyy) return null;
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export default function VetAddAppointmentScreen({ route, navigation }) {
  const { petId, petName, tutorId } = route.params || {};
  const { user } = useAuth();
  const { isDesktop } = useLayout();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    type: 'consulta',
    date: todayDDMMYYYY(),
    time: '',
    notes: '',
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const dateStorage = toStorage(form.date);
    if (!dateStorage) {
      alert('Data inválida. Use o formato DD/MM/AAAA.');
      return;
    }
    if (form.time && !/^\d{2}:\d{2}$/.test(form.time)) {
      alert('Horário inválido. Use HH:MM (ex: 14:30).');
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('appointments').insert({
      pet_id:         petId,
      vet_id:         user.id,
      tutor_id:       tutorId,
      type:           form.type,
      scheduled_date: dateStorage,
      scheduled_time: form.time || null,
      notes:          form.notes.trim() || null,
      status:         'scheduled',
    });
    setLoading(false);

    if (error) {
      alert('Erro ao salvar agendamento: ' + error.message);
    } else {
      setSaved(true);
    }
  };

  if (saved) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successCard}>
          <Text style={styles.successEmoji}>📅</Text>
          <Text style={styles.successTitle}>Agendamento confirmado!</Text>
          <Text style={styles.successSub}>
            O tutor de <Text style={styles.successPet}>{petName}</Text> poderá ver este agendamento no app.
          </Text>
          <TouchableOpacity style={styles.successBtnWrap} onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={['#0EA5E9', '#38BDF8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.successBtn}
            >
              <Text style={styles.successBtnText}>Voltar ao paciente →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} keyboardShouldPersistTaps="handled">

      <Text style={styles.petName}>Agendar para {petName}</Text>

      {/* Tipo */}
      <Text style={styles.label}>Tipo de consulta *</Text>
      <View style={styles.typeGrid}>
        {TYPES.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typeCard, form.type === t.key && styles.typeCardActive]}
            onPress={() => set('type', t.key)}
          >
            <Image source={t.icon} style={{ width: 24, height: 24, marginBottom: 4 }} resizeMode="contain" />
            <Text style={[styles.typeLabel, form.type === t.key && styles.typeLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Data */}
      <Text style={styles.label}>Data *</Text>
      <DatePickerInput
        value={form.date}
        onChangeText={v => set('date', v)}
        label="Data do agendamento"
      />

      {/* Horário */}
      <Text style={styles.label}>Horário (opcional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 14:30"
        placeholderTextColor="#9CA3AF"
        value={form.time}
        onChangeText={v => set('time', fmtTime(v))}
        keyboardType="numeric"
        maxLength={5}
      />

      {/* Instruções */}
      <Text style={styles.label}>Instruções para o tutor</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="Ex: Trazer em jejum de 8h, trazer exames anteriores..."
        placeholderTextColor="#9CA3AF"
        value={form.notes}
        onChangeText={v => set('notes', v)}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
        <LinearGradient
          colors={['#0EA5E9', '#38BDF8']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.saveBtnGrad}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Confirmar agendamento</Text>}
        </LinearGradient>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 48 },
  contentDesktop: { maxWidth: 680, alignSelf: 'center', width: '100%', paddingHorizontal: 32 },
  petName: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 20 },

  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 18 },
  input: {
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15,
    fontSize: 15, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },
  textarea: { height: 110, textAlignVertical: 'top' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    width: '30%', backgroundColor: '#fff', borderRadius: 14, padding: 12,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#E0F2FE',
  },
  typeCardActive: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  typeEmoji: { fontSize: 24, marginBottom: 4 },
  typeLabel: { fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center' },
  typeLabelActive: { color: '#0EA5E9', fontWeight: '700' },

  saveBtn: { marginTop: 32, borderRadius: 16, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 17, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Sucesso
  successContainer: { flex: 1, backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center', padding: 32 },
  successCard: {
    backgroundColor: '#fff', borderRadius: 28, padding: 32, alignItems: 'center', width: '100%',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
    borderWidth: 1, borderColor: '#E0F2FE',
  },
  successEmoji: { fontSize: 52, marginBottom: 14 },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B', marginBottom: 8 },
  successSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  successPet: { color: '#0EA5E9', fontWeight: '800' },
  successBtnWrap: { borderRadius: 16, overflow: 'hidden', width: '100%' },
  successBtn: { paddingVertical: 16, alignItems: 'center' },
  successBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
