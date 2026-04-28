import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const SPECIES = ['Cachorro', 'Gato', 'Ave', 'Coelho', 'Hamster', 'Réptil', 'Outro'];
const SEX = ['Macho', 'Fêmea'];

export default function AddPetScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    species: '',
    breed: '',
    sex: '',
    birth_date: '',
    neutered: false,
    weight_kg: '',
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.name || !form.species) {
      Alert.alert('Atenção', 'Nome e espécie são obrigatórios.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('pets').insert({
      user_id: user.id,
      name: form.name,
      species: form.species,
      breed: form.breed || null,
      sex: form.sex || null,
      birth_date: form.birth_date || null,
      neutered: form.neutered,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
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
      <Text style={styles.label}>Nome do pet *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Thor, Luna..."
        placeholderTextColor="#9CA3AF"
        value={form.name}
        onChangeText={v => set('name', v)}
      />

      <Text style={styles.label}>Espécie *</Text>
      <View style={styles.chips}>
        {SPECIES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, form.species === s && styles.chipActive]}
            onPress={() => set('species', s)}
          >
            <Text style={[styles.chipText, form.species === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Raça</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Beagle, Siamês..."
        placeholderTextColor="#9CA3AF"
        value={form.breed}
        onChangeText={v => set('breed', v)}
      />

      <Text style={styles.label}>Sexo</Text>
      <View style={styles.chips}>
        {SEX.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, form.sex === s && styles.chipActive]}
            onPress={() => set('sex', s)}
          >
            <Text style={[styles.chipText, form.sex === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Data de nascimento</Text>
      <TextInput
        style={styles.input}
        placeholder="AAAA-MM-DD"
        placeholderTextColor="#9CA3AF"
        value={form.birth_date}
        onChangeText={v => set('birth_date', v)}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Peso atual (kg)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 4.5"
        placeholderTextColor="#9CA3AF"
        value={form.weight_kg}
        onChangeText={v => set('weight_kg', v)}
        keyboardType="numeric"
      />

      <View style={styles.switchRow}>
        <Text style={styles.label}>Castrado(a)?</Text>
        <Switch
          value={form.neutered}
          onValueChange={v => set('neutered', v)}
          trackColor={{ true: '#0EA5E9' }}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Salvar pet</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipText: { fontSize: 14, color: '#64748B' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  button: {
    backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 32,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
