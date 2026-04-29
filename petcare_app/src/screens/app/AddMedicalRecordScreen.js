import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const TYPES = [
  { key: 'consulta',    label: 'Consulta',    emoji: '🏥' },
  { key: 'cirurgia',    label: 'Cirurgia',    emoji: '⚕️' },
  { key: 'exame',       label: 'Exame',       emoji: '🔬' },
  { key: 'alergia',     label: 'Alergia',     emoji: '⚠️' },
  { key: 'medicamento', label: 'Medicamento', emoji: '💊' },
  { key: 'outro',       label: 'Outro',       emoji: '📋' },
];

export default function AddMedicalRecordScreen({ route, navigation }) {
  const { petId, petName, isVet = false } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: '',
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    veterinarian: '',
    diagnosis: '',
    prescription: '',
    next_appointment: '',
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.type || !form.title || !form.date) {
      Alert.alert('Atenção', 'Tipo, título e data são obrigatórios.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('medical_records').insert({
      pet_id: petId,
      user_id: user.id,
      vet_id: isVet ? user.id : null,
      created_by_role: isVet ? 'vet' : 'tutor',
      type: form.type,
      title: form.title,
      description: form.description || null,
      date: form.date,
      veterinarian: form.veterinarian || null,
      diagnosis: form.diagnosis || null,
      prescription: form.prescription || null,
      next_appointment: form.next_appointment || null,
    });
    setLoading(false);

    if (error) Alert.alert('Erro', error.message);
    else navigation.goBack();
  };

  const isVetMode = isVet;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
            <Text style={styles.typeEmoji}>{t.emoji}</Text>
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
      <TextInput
        style={styles.input}
        placeholder="AAAA-MM-DD"
        placeholderTextColor="#9CA3AF"
        value={form.date}
        onChangeText={v => set('date', v)}
        keyboardType="numeric"
      />

      {/* Veterinário */}
      <Text style={styles.label}>Veterinário</Text>
      <TextInput
        style={styles.input}
        placeholder="Nome do veterinário"
        placeholderTextColor="#9CA3AF"
        value={form.veterinarian}
        onChangeText={v => set('veterinarian', v)}
      />

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
          <View style={styles.vetBanner}>
            <Text style={styles.vetBannerText}>👨‍⚕️ Campos profissionais</Text>
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

          <Text style={styles.label}>Próxima consulta</Text>
          <TextInput
            style={styles.input}
            placeholder="AAAA-MM-DD"
            placeholderTextColor="#9CA3AF"
            value={form.next_appointment}
            onChangeText={v => set('next_appointment', v)}
            keyboardType="numeric"
          />
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
  vetBanner: {
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12,
    marginTop: 20, borderWidth: 1, borderColor: '#BAE6FD',
  },
  vetBannerText: { color: '#0EA5E9', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  button: {
    backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 32,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
