import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const COMMON_VACCINES = {
  Cachorro: ['V8', 'V10', 'Antirrábica', 'Giárdia', 'Gripe', 'Leishmaniose'],
  Gato: ['Tríplice Felina', 'Antirrábica', 'Leucemia Felina', 'Quádrupla Felina'],
};

export default function AddVaccineScreen({ route, navigation }) {
  const { petId, petName, petSpecies } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    applied_date: '',
    next_dose_date: '',
    veterinarian: '',
    notes: '',
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const suggestions = COMMON_VACCINES[petSpecies] || [];

  const handleSave = async () => {
    if (!form.name || !form.applied_date) {
      Alert.alert('Atenção', 'Nome da vacina e data de aplicação são obrigatórios.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('vaccines').insert({
      pet_id: petId,
      user_id: user.id,
      name: form.name,
      applied_date: form.applied_date,
      next_dose_date: form.next_dose_date || null,
      veterinarian: form.veterinarian || null,
      notes: form.notes || null,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      navigation.goBack();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.petName}>Vacina para {petName}</Text>

      {suggestions.length > 0 && (
        <>
          <Text style={styles.label}>Sugestões rápidas</Text>
          <View style={styles.chips}>
            {suggestions.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, form.name === s && styles.chipActive]}
                onPress={() => set('name', s)}
              >
                <Text style={[styles.chipText, form.name === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>Nome da vacina *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: V10, Antirrábica..."
        placeholderTextColor="#9CA3AF"
        value={form.name}
        onChangeText={v => set('name', v)}
      />

      <Text style={styles.label}>Data de aplicação *</Text>
      <TextInput
        style={styles.input}
        placeholder="AAAA-MM-DD"
        placeholderTextColor="#9CA3AF"
        value={form.applied_date}
        onChangeText={v => set('applied_date', v)}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Data do próximo reforço</Text>
      <TextInput
        style={styles.input}
        placeholder="AAAA-MM-DD"
        placeholderTextColor="#9CA3AF"
        value={form.next_dose_date}
        onChangeText={v => set('next_dose_date', v)}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Veterinário(a)</Text>
      <TextInput
        style={styles.input}
        placeholder="Nome do veterinário"
        placeholderTextColor="#9CA3AF"
        value={form.veterinarian}
        onChangeText={v => set('veterinarian', v)}
      />

      <Text style={styles.label}>Observações</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="Reações, lote, clínica..."
        placeholderTextColor="#9CA3AF"
        value={form.notes}
        onChangeText={v => set('notes', v)}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Salvar vacina</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 40 },
  petName: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B',
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipText: { fontSize: 13, color: '#64748B' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 32,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
