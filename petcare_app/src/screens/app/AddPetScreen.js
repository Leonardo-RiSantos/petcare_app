import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Switch, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DatePickerInput from '../../components/DatePickerInput';

const SPECIES = ['Cachorro', 'Gato', 'Ave', 'Coelho', 'Hamster', 'Réptil', 'Peixe', 'Outro'];
const SEX = ['Macho', 'Fêmea'];

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
  Peixe:    require('../../../assets/pet_peixe.png'),
};

const PERSONALITY_OPTIONS = [
  { label: 'Brincalhão',   emoji: '🎾' },
  { label: 'Enérgico',     emoji: '⚡' },
  { label: 'Calmo',        emoji: '😌' },
  { label: 'Curioso',      emoji: '🔍' },
  { label: 'Carinhoso',    emoji: '🥰' },
  { label: 'Independente', emoji: '😎' },
  { label: 'Tímido',       emoji: '🙈' },
  { label: 'Protetor',     emoji: '🛡️' },
  { label: 'Guloso',       emoji: '🍗' },
  { label: 'Dorminhoco',   emoji: '😴' },
];

const coatLabel = (species) => {
  if (['Cachorro', 'Gato', 'Coelho', 'Hamster'].includes(species)) return 'Cor da pelagem';
  if (species === 'Ave') return 'Cor da plumagem';
  if (species === 'Réptil') return 'Cor das escamas / pele';
  if (species === 'Peixe')  return 'Cor das escamas';
  return 'Cor / aparência';
};

// Converte DD/MM/AAAA → AAAA-MM-DD para salvar no banco
const parseBirthDate = (input) => {
  if (!input || !input.trim()) return null;
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) return input.trim();
  return null;
};

export default function AddPetScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    species: '',
    custom_species: '',
    breed: '',
    sex: '',
    birth_date: '',
    neutered: false,
    weight_kg: '',
    coat_color: '',
    personality: [],
    health_notes: '',
    medications: '',
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const togglePersonality = (label) => {
    setForm(prev => ({
      ...prev,
      personality: prev.personality.includes(label)
        ? prev.personality.filter(p => p !== label)
        : [...prev.personality, label],
    }));
  };

  const handleSave = async () => {
    if (!form.name) { Alert.alert('Atenção', 'O nome do pet é obrigatório.'); return; }
    if (!form.species) { Alert.alert('Atenção', 'Selecione a espécie do pet.'); return; }
    if (form.species === 'Outro' && !form.custom_species.trim()) {
      Alert.alert('Atenção', 'Descreva o tipo de animal.'); return;
    }

    const birthDateParsed = parseBirthDate(form.birth_date);

    setLoading(true);
    const { error } = await supabase.from('pets').insert({
      user_id: user.id,
      name: form.name.trim(),
      species: form.species,
      custom_species: form.species === 'Outro' ? form.custom_species.trim() : null,
      breed: form.breed || null,
      sex: form.sex || null,
      birth_date: birthDateParsed,
      neutered: form.neutered,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      coat_color: form.coat_color || null,
      personality: form.personality.length > 0 ? form.personality : null,
      health_notes: form.health_notes.trim() || null,
      medications: form.medications.trim() || null,
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

      {/* Nome */}
      <Text style={styles.label}>Nome do pet *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Thor, Luna, Bolinha..."
        placeholderTextColor="#9CA3AF"
        value={form.name}
        onChangeText={v => set('name', v)}
      />

      {/* Espécie */}
      <Text style={styles.label}>Espécie *</Text>
      <View style={styles.speciesGrid}>
        {SPECIES.map(s => {
          const img = SPECIES_IMAGES[s];
          const active = form.species === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.speciesChip, active && styles.speciesChipActive]}
              onPress={() => { set('species', s); set('custom_species', ''); }}
              activeOpacity={0.8}
            >
              {img
                ? <Image source={img} style={{ width: 44, height: 44 }} resizeMode="contain" />
                : <Text style={{ fontSize: 36 }}>🐾</Text>}
              <Text style={[styles.speciesLabel, active && styles.speciesLabelActive]}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Campo "Outro" espécie */}
      {form.species === 'Outro' && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.labelSmall}>Qual animal é? *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Furão, Porquinho-da-índia..."
            placeholderTextColor="#9CA3AF"
            value={form.custom_species}
            onChangeText={v => set('custom_species', v)}
            autoFocus
          />
        </View>
      )}

      {/* Raça */}
      <Text style={styles.label}>Raça</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Beagle, Siamês, Persa..."
        placeholderTextColor="#9CA3AF"
        value={form.breed}
        onChangeText={v => set('breed', v)}
      />

      {/* Sexo */}
      <Text style={styles.label}>Sexo</Text>
      <View style={styles.chips}>
        {SEX.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, form.sex === s && styles.chipActive]}
            onPress={() => set('sex', s)}
          >
            <Text style={[styles.chipText, form.sex === s && styles.chipTextActive]}>
              {s === 'Macho' ? '♂ Macho' : '♀ Fêmea'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Data de nascimento */}
      <Text style={styles.label}>Data de nascimento</Text>
      <DatePickerInput
        value={form.birth_date}
        onChangeText={v => set('birth_date', v)}
        label="Data de nascimento"
        isBirthDate
      />

      {/* Peso */}
      <Text style={styles.label}>Peso atual (kg)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 4.5"
        placeholderTextColor="#9CA3AF"
        value={form.weight_kg}
        onChangeText={v => set('weight_kg', v)}
        keyboardType="decimal-pad"
      />

      {/* Cor da pelagem / plumagem / escamas */}
      {form.species !== '' && (
        <>
          <Text style={styles.label}>{coatLabel(form.species)}</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Dourado, Branco e preto, Tigrado..."
            placeholderTextColor="#9CA3AF"
            value={form.coat_color}
            onChangeText={v => set('coat_color', v)}
          />
        </>
      )}

      {/* Personalidade */}
      <Text style={styles.label}>Personalidade 🐾</Text>
      <Text style={styles.labelHint}>Selecione quantas quiser</Text>
      <View style={styles.personalityGrid}>
        {PERSONALITY_OPTIONS.map(opt => {
          const selected = form.personality.includes(opt.label);
          return (
            <TouchableOpacity
              key={opt.label}
              style={[styles.personalityChip, selected && styles.personalityChipSelected]}
              onPress={() => togglePersonality(opt.label)}
              activeOpacity={0.8}
            >
              <Text style={styles.personalityEmoji}>{opt.emoji}</Text>
              <Text style={[styles.personalityLabel, selected && styles.personalityLabelSelected]}>
                {opt.label}
              </Text>
              {selected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Saúde e medicamentos */}
      <View style={styles.healthSection}>
        <Text style={styles.healthSectionTitle}>🌿 Saúde e bem-estar</Text>
        <Text style={styles.healthSectionHint}>Opcional — ajuda o veterinário a cuidar melhor do seu pet</Text>

        <Text style={styles.labelSmall}>Condições de saúde</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          multiline
          numberOfLines={3}
          placeholder="Alergias, condições especiais, cuidados importantes..."
          placeholderTextColor="#9CA3AF"
          value={form.health_notes}
          onChangeText={v => set('health_notes', v)}
          textAlignVertical="top"
        />

        <Text style={styles.labelSmall}>Medicamentos em uso</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          multiline
          numberOfLines={3}
          placeholder="Nome do medicamento, dosagem, frequência..."
          placeholderTextColor="#9CA3AF"
          value={form.medications}
          onChangeText={v => set('medications', v)}
          textAlignVertical="top"
        />
      </View>

      {/* Castrado */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>Castrado(a)?</Text>
        <Switch
          value={form.neutered}
          onValueChange={v => set('neutered', v)}
          trackColor={{ true: '#0EA5E9' }}
        />
      </View>

      {/* Botão salvar */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
        <LinearGradient
          colors={['#0EA5E9', '#38BDF8']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.saveBtnGrad}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Salvar pet 🐾</Text>}
        </LinearGradient>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 50 },

  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 20 },
  labelSmall: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  labelHint: { fontSize: 12, color: '#94A3B8', marginTop: -6, marginBottom: 10 },

  input: {
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },
  inputMulti: { minHeight: 80, paddingTop: 14 },

  speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  speciesChip: {
    width: '30%', backgroundColor: '#fff', borderRadius: 18, paddingVertical: 14,
    alignItems: 'center', borderWidth: 2, borderColor: '#E0F2FE',
  },
  speciesChipActive: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  speciesLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', marginTop: 6 },
  speciesLabelActive: { color: '#0EA5E9' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E0F2FE' },
  chipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  personalityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personalityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1.5, borderColor: '#E0F2FE',
  },
  personalityChipSelected: { backgroundColor: '#EFF6FF', borderColor: '#0EA5E9' },
  personalityEmoji: { fontSize: 16 },
  personalityLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  personalityLabelSelected: { color: '#0EA5E9' },
  checkmark: { fontSize: 12, color: '#0EA5E9', fontWeight: '800' },

  healthSection: {
    marginTop: 24, backgroundColor: '#fff', borderRadius: 18, padding: 16,
    borderWidth: 1.5, borderColor: '#E0F2FE',
  },
  healthSectionTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  healthSectionHint: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },

  saveBtn: { marginTop: 32, borderRadius: 16, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 17, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
