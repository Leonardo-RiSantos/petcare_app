import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const COMMON_VACCINES = {
  Cachorro: ['V8/V10', 'Antirrábica', 'Giárdia', 'Gripe Canina', 'Leishmaniose', 'Lyme'],
  Gato:     ['Tríplice Felina', 'Quádrupla Felina', 'Antirrábica', 'Leucemia Felina (FeLV)'],
};

// Intervalo padrão em meses por vacina
const VACCINE_INTERVALS = {
  'giárdia': 6,
  'giardia': 6,
  'gripe':   6,
};

// Formata dígitos como DD/MM/AAAA enquanto o usuário digita
const fmtDate = (text) => {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

// Converte DD/MM/AAAA → AAAA-MM-DD para salvar no banco
const toStorage = (ddmmaaaa) => {
  const m = ddmmaaaa.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

// Calcula a próxima dose a partir da data de aplicação e nome da vacina
const calcNextDose = (appliedDDMM, vaccineName) => {
  const m = appliedDDMM.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';

  const nameLower = (vaccineName || '').toLowerCase();
  let months = 12; // padrão: anual
  for (const [key, val] of Object.entries(VACCINE_INTERVALS)) {
    if (nameLower.includes(key)) { months = val; break; }
  }

  const date = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  date.setMonth(date.getMonth() + months);

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
};

export default function AddVaccineScreen({ route, navigation }) {
  const { petId, petName, petSpecies, prefillName } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name:          prefillName || '',
    applied_date:  '',
    next_dose_date: '',
    veterinarian:  '',
    notes:         '',
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleAppliedDateChange = (text) => {
    const formatted = fmtDate(text);
    setForm(prev => {
      const next = formatted.length === 10 ? calcNextDose(formatted, prev.name) : prev.next_dose_date;
      return { ...prev, applied_date: formatted, next_dose_date: next };
    });
  };

  const handleNameChange = (name) => {
    set('name', name);
    // Recalcula próxima dose se data já estiver preenchida
    if (form.applied_date.length === 10) {
      set('next_dose_date', calcNextDose(form.applied_date, name));
    }
  };

  const handleSave = async () => {
    if (!form.name) { Alert.alert('Atenção', 'Informe o nome da vacina.'); return; }
    if (!form.applied_date || form.applied_date.length < 10) {
      Alert.alert('Atenção', 'Informe a data de aplicação no formato DD/MM/AAAA.'); return;
    }

    const appliedStorage  = toStorage(form.applied_date);
    const nextStorage     = form.next_dose_date.length === 10 ? toStorage(form.next_dose_date) : null;

    if (!appliedStorage) { Alert.alert('Data inválida', 'Verifique a data de aplicação.'); return; }

    setLoading(true);
    const { error } = await supabase.from('vaccines').insert({
      pet_id:         petId,
      user_id:        user.id,
      name:           form.name,
      applied_date:   appliedStorage,
      next_dose_date: nextStorage,
      veterinarian:   form.veterinarian || null,
      notes:          form.notes || null,
    });
    setLoading(false);

    if (error) { Alert.alert('Erro', error.message); }
    else { navigation.goBack(); }
  };

  const suggestions = COMMON_VACCINES[petSpecies] || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.petLabel}>Vacina para</Text>
      <Text style={styles.petName}>{petName} 🐾</Text>

      {/* Sugestões rápidas */}
      {suggestions.length > 0 && (
        <>
          <Text style={styles.label}>Sugestões rápidas</Text>
          <View style={styles.chips}>
            {suggestions.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, form.name === s && styles.chipActive]}
                onPress={() => handleNameChange(s)}
              >
                <Text style={[styles.chipText, form.name === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Nome da vacina */}
      <Text style={styles.label}>Nome da vacina *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: V10, Antirrábica, Tríplice..."
        placeholderTextColor="#9CA3AF"
        value={form.name}
        onChangeText={handleNameChange}
      />

      {/* Data de aplicação */}
      <Text style={styles.label}>Data de aplicação *</Text>
      <TextInput
        style={styles.input}
        placeholder="DD/MM/AAAA"
        placeholderTextColor="#9CA3AF"
        value={form.applied_date}
        onChangeText={handleAppliedDateChange}
        keyboardType="numeric"
        maxLength={10}
      />

      {/* Próximo reforço — preenchido automaticamente */}
      <View style={styles.nextDoseLabelRow}>
        <Text style={styles.label}>Próximo reforço</Text>
        {form.next_dose_date.length === 10 && (
          <View style={styles.autoBadge}>
            <Text style={styles.autoBadgeText}>✦ preenchido automaticamente</Text>
          </View>
        )}
      </View>
      <TextInput
        style={[styles.input, form.next_dose_date.length === 10 && styles.inputAutoFilled]}
        placeholder="DD/MM/AAAA"
        placeholderTextColor="#9CA3AF"
        value={form.next_dose_date}
        onChangeText={v => set('next_dose_date', fmtDate(v))}
        keyboardType="numeric"
        maxLength={10}
      />
      {form.next_dose_date.length === 10 && (
        <Text style={styles.autoHint}>
          Calculado com base no intervalo típico da vacina. Edite se necessário.
        </Text>
      )}

      {/* Veterinário */}
      <Text style={styles.label}>Veterinário(a)</Text>
      <TextInput
        style={styles.input}
        placeholder="Nome do veterinário"
        placeholderTextColor="#9CA3AF"
        value={form.veterinarian}
        onChangeText={v => set('veterinarian', v)}
      />

      {/* Observações */}
      <Text style={styles.label}>Observações</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="Reações, lote, clínica..."
        placeholderTextColor="#9CA3AF"
        value={form.notes}
        onChangeText={v => set('notes', v)}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Botão salvar */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
        <LinearGradient
          colors={['#0EA5E9', '#38BDF8']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.saveBtnGrad}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Salvar vacina 💉</Text>}
        </LinearGradient>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 50 },

  petLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  petName: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 4 },

  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 20 },

  input: {
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  inputAutoFilled: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  textarea: { minHeight: 90, paddingTop: 14 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E0F2FE',
  },
  chipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  nextDoseLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 8 },
  autoBadge: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#BAE6FD' },
  autoBadgeText: { fontSize: 11, color: '#0EA5E9', fontWeight: '700' },
  autoHint: { fontSize: 11, color: '#94A3B8', marginTop: 6 },

  saveBtn: { marginTop: 32, borderRadius: 16, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 17, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
