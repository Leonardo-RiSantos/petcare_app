import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = [
  { key: 'racao', label: 'Ração', emoji: '🍖' },
  { key: 'veterinario', label: 'Veterinário', emoji: '🏥' },
  { key: 'banho_tosa', label: 'Banho/Tosa', emoji: '✂️' },
  { key: 'remedio', label: 'Remédio', emoji: '💊' },
  { key: 'acessorios', label: 'Acessórios', emoji: '🎾' },
  { key: 'outros', label: 'Outros', emoji: '📦' },
];

export default function AddExpenseScreen({ route, navigation }) {
  const { user } = useAuth();
  const { petId: initialPetId, pets = [] } = route.params ?? {};

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    pet_id: initialPetId ?? (pets[0]?.id ?? ''),
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.pet_id || !form.category || !form.amount) {
      Alert.alert('Atenção', 'Pet, categoria e valor são obrigatórios.');
      return;
    }
    const amount = parseFloat(form.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      pet_id: form.pet_id,
      category: form.category,
      description: form.description || null,
      amount,
      date: form.date,
    });
    setLoading(false);

    if (error) Alert.alert('Erro', error.message);
    else navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Selecionar pet */}
      {pets.length > 1 && (
        <>
          <Text style={styles.label}>Pet</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {pets.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, form.pet_id === p.id && styles.chipActive]}
                onPress={() => set('pet_id', p.id)}
              >
                <Text style={[styles.chipText, form.pet_id === p.id && styles.chipTextActive]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Categoria */}
      <Text style={styles.label}>Categoria *</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.categoryCard, form.category === cat.key && styles.categoryCardActive]}
            onPress={() => set('category', cat.key)}
          >
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text style={[styles.categoryLabel, form.category === cat.key && styles.categoryLabelActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Valor */}
      <Text style={styles.label}>Valor (R$) *</Text>
      <TextInput
        style={styles.input}
        placeholder="0,00"
        placeholderTextColor="#9CA3AF"
        value={form.amount}
        onChangeText={v => set('amount', v)}
        keyboardType="numeric"
      />

      {/* Descrição */}
      <Text style={styles.label}>Descrição</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Consulta anual, Ração 15kg..."
        placeholderTextColor="#9CA3AF"
        value={form.description}
        onChangeText={v => set('description', v)}
      />

      {/* Data */}
      <Text style={styles.label}>Data</Text>
      <TextInput
        style={styles.input}
        placeholder="AAAA-MM-DD"
        placeholderTextColor="#9CA3AF"
        value={form.date}
        onChangeText={v => set('date', v)}
        keyboardType="numeric"
      />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar gasto</Text>}
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
  chipsScroll: { marginBottom: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, marginRight: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: {
    width: '30%', backgroundColor: '#fff', borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  categoryCardActive: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  categoryEmoji: { fontSize: 26, marginBottom: 6 },
  categoryLabel: { fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center' },
  categoryLabelActive: { color: '#0EA5E9', fontWeight: '700' },
  button: {
    backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 32,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
