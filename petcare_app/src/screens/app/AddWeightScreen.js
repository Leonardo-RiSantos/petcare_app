import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DatePickerInput from '../../components/DatePickerInput';

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
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export default function AddWeightScreen({ route, navigation }) {
  const { petId, petName, currentWeight } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    weight_kg: '',
    date: todayDDMMYYYY(),
    notes: '',
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const weight = parseFloat(form.weight_kg.replace(',', '.'));
    if (!form.weight_kg || isNaN(weight) || weight <= 0) {
      Alert.alert('Atenção', 'Informe um peso válido.');
      return;
    }

    const dateStorage = toStorage(form.date);
    if (!dateStorage) { Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.'); return; }

    setLoading(true);
    const { error } = await supabase.from('weight_records').insert({
      pet_id: petId,
      user_id: user.id,
      weight_kg: weight,
      date: dateStorage,
      notes: form.notes || null,
    });

    // Atualiza peso atual no perfil do pet
    if (!error) {
      await supabase.from('pets').update({ weight_kg: weight }).eq('id', petId);
    }

    setLoading(false);
    if (error) Alert.alert('Erro', error.message);
    else navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.petName}>Peso de {petName}</Text>
      {currentWeight && (
        <Text style={styles.currentWeight}>Peso atual: {currentWeight} kg</Text>
      )}

      <Text style={styles.label}>Novo peso (kg) *</Text>
      <TextInput
        style={styles.inputLarge}
        placeholder="Ex: 8,5"
        placeholderTextColor="#9CA3AF"
        value={form.weight_kg}
        onChangeText={v => set('weight_kg', v)}
        keyboardType="decimal-pad"
        autoFocus
      />

      <Text style={styles.label}>Data da pesagem</Text>
      <DatePickerInput
        value={form.date}
        onChangeText={v => set('date', v)}
        label="Data da pesagem"
      />

      <Text style={styles.label}>Observações</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="Ex: pós-consulta, em jejum..."
        placeholderTextColor="#9CA3AF"
        value={form.notes}
        onChangeText={v => set('notes', v)}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar peso</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 40 },
  petName: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  currentWeight: { fontSize: 14, color: '#64748B', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 20 },
  inputLarge: {
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 20,
    fontSize: 32, fontWeight: '700', borderWidth: 1, borderColor: '#BAE6FD',
    color: '#0EA5E9', textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B',
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 32,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
