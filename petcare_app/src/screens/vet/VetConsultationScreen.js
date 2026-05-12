import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Switch, Alert, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DatePickerInput from '../../components/DatePickerInput';
import { generatePrescriptionHTML, exportReport } from '../../utils/generateReport';

const TYPE_OPTIONS = [
  { key: 'consulta',   label: 'Consulta'  },
  { key: 'retorno',    label: 'Retorno'   },
  { key: 'cirurgia',   label: 'Cirurgia'  },
  { key: 'exame',      label: 'Exame'     },
  { key: 'vacinacao',  label: 'Vacinação' },
  { key: 'outro',      label: 'Outro'     },
];
const TYPE_COLORS = { consulta: '#0EA5E9', retorno: '#10B981', cirurgia: '#8B5CF6', exame: '#F59E0B', vacinacao: '#16A34A', outro: '#64748B' };

const ICON_MEDICINE = require('../../../assets/icon_medicine.png');
const ICON_MEDICAL  = require('../../../assets/icon_medical.png');

const toISO = (ddmmyyyy) => {
  const m = ddmmyyyy?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const fromISO = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

function PrescriptionItem({ item, index, onChange, onRemove }) {
  const s = (k, v) => onChange(index, k, v);
  return (
    <View style={styles.prescItem}>
      <View style={styles.prescHeader}>
        <Image source={ICON_MEDICINE} style={{ width: 16, height: 16, marginRight: 6 }} resizeMode="contain" />
        <Text style={styles.prescTitle}>Medicamento {index + 1}</Text>
        <TouchableOpacity onPress={() => onRemove(index)} style={styles.prescRemove}>
          <Text style={styles.prescRemoveTxt}>✕</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={styles.prescInput} value={item.medication} onChangeText={v => s('medication', v)} placeholder="Nome do medicamento *" placeholderTextColor="#9CA3AF" />
      <View style={styles.prescRow}>
        <TextInput style={[styles.prescInput, { flex: 1 }]} value={item.dosage} onChangeText={v => s('dosage', v)} placeholder="Dose (ex: 10mg)" placeholderTextColor="#9CA3AF" />
        <TextInput style={[styles.prescInput, { flex: 1 }]} value={item.frequency} onChangeText={v => s('frequency', v)} placeholder="Frequência (ex: 2x/dia)" placeholderTextColor="#9CA3AF" />
      </View>
      <View style={styles.prescRow}>
        <TextInput style={[styles.prescInput, { flex: 1 }]} value={item.duration} onChangeText={v => s('duration', v)} placeholder="Duração (ex: 7 dias)" placeholderTextColor="#9CA3AF" />
        <TextInput style={[styles.prescInput, { flex: 1 }]} value={item.instructions} onChangeText={v => s('instructions', v)} placeholder="Observação" placeholderTextColor="#9CA3AF" />
      </View>
    </View>
  );
}

export default function VetConsultationScreen({ route, navigation }) {
  const { petId, unlinkedId, petName, consultationId } = route.params || {};
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    date: fromISO(today),
    type: 'consulta',
    chief_complaint: '',
    physical_exam: '',
    diagnosis: '',
    treatment_plan: '',
    notes: '',
    weight_at_visit: '',
    temperature: '',
    visible_to_owner: true,
  });
  const [prescriptions, setPrescriptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!consultationId);
  const [generatingRx, setGeneratingRx] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Carrega consulta existente para edição
  useEffect(() => {
    if (!consultationId) return;
    supabase.from('vet_consultations').select('*').eq('id', consultationId).single()
      .then(({ data }) => {
        if (!data) return;
        setForm({
          date: fromISO(data.date),
          type: data.type || 'consulta',
          chief_complaint: data.chief_complaint || '',
          physical_exam: data.physical_exam || '',
          diagnosis: data.diagnosis || '',
          treatment_plan: data.treatment_plan || '',
          notes: data.notes || '',
          weight_at_visit: data.weight_at_visit ? String(data.weight_at_visit) : '',
          temperature: data.temperature ? String(data.temperature) : '',
          visible_to_owner: data.visible_to_owner !== false,
        });
        setLoading(false);
      });
    supabase.from('vet_prescriptions').select('*').eq('consultation_id', consultationId)
      .then(({ data }) => { if (data) setPrescriptions(data.map(p => ({ ...p }))); });
  }, [consultationId]);

  const addPrescription = () => setPrescriptions(p => [
    ...p, { medication: '', dosage: '', frequency: '', duration: '', instructions: '' }
  ]);

  const updatePrescription = (index, key, value) => {
    setPrescriptions(p => p.map((item, i) => i === index ? { ...item, [key]: value } : item));
  };

  const removePrescription = (index) => setPrescriptions(p => p.filter((_, i) => i !== index));

  const handleSave = async () => {
    const isoDate = toISO(form.date);
    if (!isoDate) { Alert.alert('Atenção', 'Informe uma data válida.'); return; }

    setSaving(true);
    const payload = {
      vet_id: user.id,
      pet_id: petId || null,
      unlinked_patient_id: unlinkedId || null,
      date: isoDate,
      type: form.type,
      chief_complaint: form.chief_complaint || null,
      physical_exam: form.physical_exam || null,
      diagnosis: form.diagnosis || null,
      treatment_plan: form.treatment_plan || null,
      notes: form.notes || null,
      weight_at_visit: form.weight_at_visit ? parseFloat(form.weight_at_visit.replace(',', '.')) : null,
      temperature: form.temperature ? parseFloat(form.temperature.replace(',', '.')) : null,
      visible_to_owner: form.visible_to_owner,
    };

    let consultId = consultationId;
    const isNew = !consultationId;
    if (consultationId) {
      await supabase.from('vet_consultations').update(payload).eq('id', consultationId);
    } else {
      const { data } = await supabase.from('vet_consultations').insert(payload).select('id').single();
      consultId = data?.id;
    }

    // Salva prescrições
    if (consultId) {
      await supabase.from('vet_prescriptions').delete().eq('consultation_id', consultId);
      const validPresc = prescriptions.filter(p => p.medication?.trim());
      if (validPresc.length) {
        await supabase.from('vet_prescriptions').insert(
          validPresc.map(p => ({ ...p, id: undefined, consultation_id: consultId, vet_id: user.id }))
        );
      }
    }

    // Se tiver peso, registra no histórico do pet vinculado
    if (petId && form.weight_at_visit) {
      const w = parseFloat(form.weight_at_visit.replace(',', '.'));
      if (!isNaN(w)) {
        await supabase.from('weight_records').insert({
          pet_id: petId, user_id: user.id, weight_kg: w,
          recorded_at: isoDate, notes: 'Registrado durante consulta',
        });
      }
    }

    // Nova consulta → registra automaticamente na agenda e no financeiro
    if (isNew && consultId) {
      const typeLabels = { consulta: 'Consulta', retorno: 'Retorno', cirurgia: 'Cirurgia', exame: 'Exame', vacinacao: 'Vacinação', outro: 'Procedimento' };
      const label = typeLabels[form.type] || 'Procedimento';

      await supabase.from('vet_schedule').insert({
        vet_id: user.id,
        pet_id: petId || null,
        unlinked_patient_id: unlinkedId || null,
        patient_name: petName || null,
        scheduled_date: isoDate,
        scheduled_time: null,
        type: form.type,
        status: 'completed',
        notes: form.chief_complaint || null,
      });

      await supabase.from('vet_billing').insert({
        vet_id: user.id,
        pet_id: petId || null,
        unlinked_patient_id: unlinkedId || null,
        consultation_id: consultId,
        patient_name: petName || null,
        description: `${label}${petName ? ` — ${petName}` : ''}`,
        amount: 0,
        type: 'income',
        status: 'pending',
      });
    }

    setSaving(false);
    navigation.goBack();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;

  const color = TYPE_COLORS[form.type] || '#0EA5E9';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Cabeçalho do paciente */}
      <View style={styles.patientHeader}>
        <Image source={ICON_MEDICAL} style={{ width: 20, height: 20, marginRight: 8 }} resizeMode="contain" />
        <Text style={styles.patientName}>{petName || 'Paciente'}</Text>
        <View style={[styles.typePill, { backgroundColor: color + '20', borderColor: color }]}>
          <Text style={[styles.typePillTxt, { color }]}>{form.type}</Text>
        </View>
      </View>

      {/* Tipo de consulta */}
      <Text style={styles.label}>Tipo *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
        {TYPE_OPTIONS.map(t => {
          const c = TYPE_COLORS[t.key];
          const active = form.type === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => set('type', t.key)}
              style={[styles.typeChip, active && { backgroundColor: c + '20', borderColor: c }]}>
              <Text style={[styles.typeChipTxt, active && { color: c, fontWeight: '800' }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Data */}
      <Text style={styles.label}>Data *</Text>
      <DatePickerInput value={form.date} onChangeText={v => set('date', v)} label="Data da consulta" />

      {/* Vitais */}
      <Text style={styles.sectionTitle}>Dados vitais</Text>
      <View style={styles.vitalsRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Peso (kg)</Text>
          <TextInput style={styles.input} value={form.weight_at_visit} onChangeText={v => set('weight_at_visit', v)} placeholder="Ex: 8,5" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Temperatura (°C)</Text>
          <TextInput style={styles.input} value={form.temperature} onChangeText={v => set('temperature', v)} placeholder="Ex: 38,5" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
        </View>
      </View>

      {/* Campos clínicos */}
      {[
        { key: 'chief_complaint', label: 'Queixa principal', placeholder: 'Descreva o motivo da consulta...' },
        { key: 'physical_exam',   label: 'Exame físico',     placeholder: 'Achados do exame físico...' },
        { key: 'diagnosis',       label: 'Diagnóstico',      placeholder: 'Diagnóstico / hipótese diagnóstica...' },
        { key: 'treatment_plan',  label: 'Plano terapêutico',placeholder: 'Tratamento recomendado, retornos, exames...' },
        { key: 'notes',           label: 'Observações',      placeholder: 'Outras observações relevantes...' },
      ].map(f => (
        <View key={f.key}>
          <Text style={styles.label}>{f.label}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={form[f.key]}
            onChangeText={v => set(f.key, v)}
            placeholder={f.placeholder}
            placeholderTextColor="#9CA3AF"
            multiline numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      ))}

      {/* Prescrições */}
      <Text style={styles.sectionTitle}>Prescrições</Text>
      {prescriptions.map((p, i) => (
        <PrescriptionItem key={i} item={p} index={i} onChange={updatePrescription} onRemove={removePrescription} />
      ))}
      <TouchableOpacity style={styles.addPrescBtn} onPress={addPrescription} activeOpacity={0.8}>
        <Image source={ICON_MEDICINE} style={{ width: 14, height: 14, marginRight: 6 }} resizeMode="contain" />
        <Text style={styles.addPrescTxt}>+ Adicionar medicamento</Text>
      </TouchableOpacity>

      {/* Visibilidade para tutor */}
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Visível para o tutor</Text>
          <Text style={styles.switchSub}>O tutor poderá ver este registro no app</Text>
        </View>
        <Switch
          value={form.visible_to_owner}
          onValueChange={v => set('visible_to_owner', v)}
          trackColor={{ true: '#0EA5E9' }}
        />
      </View>

      {/* Gerar Receita (só aparece se há prescrições) */}
      {prescriptions.filter(p => p.medication?.trim()).length > 0 && (
        <TouchableOpacity
          style={[styles.saveWrap, { marginTop: 12 }]}
          onPress={async () => {
            setGeneratingRx(true);
            try {
              const pet = petId ? (await supabase.from('pets').select('name,species,breed').eq('id', petId).single()).data : { name: petName };
              const html = generatePrescriptionHTML({
                consultation: form,
                prescriptions: prescriptions.filter(p => p.medication?.trim()),
                pet: pet || { name: petName },
                vet: { ...vetProfile, signature_url: vetProfile?.signature_url },
              });
              await exportReport(html, `receita_${petName || 'paciente'}.pdf`);
            } catch (e) { Alert.alert('Erro', e.message); }
            setGeneratingRx(false);
          }}
          disabled={generatingRx}
        >
          <LinearGradient colors={['#7C3AED', '#A78BFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
            {generatingRx ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Gerar receita PDF</Text>}
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Salvar */}
      <TouchableOpacity style={styles.saveWrap} onPress={handleSave} disabled={saving}>
        <LinearGradient colors={['#0284C7', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Salvar prontuário</Text>}
        </LinearGradient>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  patientHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: '#E0F2FE',
  },
  patientName: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1E293B' },
  typePill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  typePillTxt: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: '#0EA5E9',
    marginTop: 24, marginBottom: 8, letterSpacing: 0.5,
    borderBottomWidth: 1, borderBottomColor: '#E0F2FE', paddingBottom: 8,
  },

  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },
  inputMulti: { minHeight: 90, paddingTop: 14 },

  vitalsRow: { flexDirection: 'row', gap: 12 },

  typeChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22,
    backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  typeChipTxt: { fontSize: 13, color: '#64748B' },

  prescItem: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    marginBottom: 10, borderWidth: 1.5, borderColor: '#E0F2FE',
  },
  prescHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  prescTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#374151' },
  prescRemove: { padding: 4 },
  prescRemoveTxt: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  prescInput: {
    backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B', marginBottom: 8,
  },
  prescRow: { flexDirection: 'row', gap: 8 },

  addPrescBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#BAE6FD',
    borderStyle: 'dashed', backgroundColor: '#F0F9FF', marginBottom: 8,
  },
  addPrescTxt: { fontSize: 14, fontWeight: '700', color: '#0EA5E9' },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: '#E0F2FE',
  },
  switchLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  switchSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  saveWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 24 },
  saveBtn: { paddingVertical: 17, alignItems: 'center' },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
