import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Switch, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DatePickerInput from '../../components/DatePickerInput';
import { formatPhone } from '../../utils/formatPhone';

const SPECIES = ['Cachorro', 'Gato', 'Ave', 'Coelho', 'Hamster', 'Réptil', 'Peixe', 'Outro'];
const SEX     = ['Macho', 'Fêmea'];

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
  Peixe:    require('../../../assets/pet_peixe.png'),
};

const toISO = (ddmmyyyy) => {
  const m = ddmmyyyy?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const fromISO = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export default function VetAddUnlinkedPatientScreen({ route, navigation }) {
  const { patientId } = route.params || {};
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const [form, setForm] = useState({
    name: '', species: '', breed: '', sex: '',
    birth_date: '', weight_kg: '', coat_color: '',
    neutered: false, health_notes: '', medications: '',
    owner_name: '', owner_phone: '', owner_email: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setErro('');
    if (!form.name.trim()) { setErro('O nome do paciente é obrigatório.'); return; }
    setLoading(true);
    const payload = {
      vet_id: user.id,
      name: form.name.trim(),
      species: form.species || null,
      breed: form.breed || null,
      sex: form.sex || null,
      birth_date: toISO(form.birth_date) || null,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg.replace(',', '.')) : null,
      coat_color: form.coat_color || null,
      neutered: form.neutered,
      health_notes: form.health_notes || null,
      medications: form.medications || null,
      owner_name: form.owner_name || null,
      owner_phone: form.owner_phone || null,
      owner_email: form.owner_email || null,
    };
    let err;
    if (patientId) {
      ({ error: err } = await supabase.from('vet_unlinked_patients').update(payload).eq('id', patientId));
    } else {
      ({ error: err } = await supabase.from('vet_unlinked_patients').insert(payload));
    }
    setLoading(false);
    if (err) { setErro(err.message); return; }
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Nome */}
      <Text style={styles.label}>Nome do paciente *</Text>
      <TextInput style={styles.input} placeholder="Ex: Thor, Luna..." placeholderTextColor="#9CA3AF" value={form.name} onChangeText={v => set('name', v)} />

      {/* Espécie */}
      <Text style={styles.label}>Espécie</Text>
      <View style={styles.speciesGrid}>
        {SPECIES.map(s => {
          const img = SPECIES_IMAGES[s];
          const active = form.species === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.speciesChip, active && styles.speciesChipActive]}
              onPress={() => set('species', s)}
              activeOpacity={0.8}
            >
              {img
                ? <Image source={img} style={{ width: 36, height: 36 }} resizeMode="contain" />
                : <Text style={{ fontSize: 28 }}>🐾</Text>}
              <Text style={[styles.speciesLabel, active && { color: '#0EA5E9' }]}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Raça */}
      <Text style={styles.label}>Raça</Text>
      <TextInput style={styles.input} placeholder="Ex: Beagle, Siamês..." placeholderTextColor="#9CA3AF" value={form.breed} onChangeText={v => set('breed', v)} />

      {/* Sexo */}
      <Text style={styles.label}>Sexo</Text>
      <View style={styles.chips}>
        {SEX.map(s => (
          <TouchableOpacity key={s} style={[styles.chip, form.sex === s && styles.chipActive]} onPress={() => set('sex', s)}>
            <Text style={[styles.chipTxt, form.sex === s && styles.chipTxtActive]}>
              {s === 'Macho' ? '♂ Macho' : '♀ Fêmea'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Data de nascimento */}
      <Text style={styles.label}>Data de nascimento</Text>
      <DatePickerInput value={form.birth_date} onChangeText={v => set('birth_date', v)} label="Data de nascimento" isBirthDate />

      {/* Peso */}
      <Text style={styles.label}>Peso (kg)</Text>
      <TextInput style={styles.input} placeholder="Ex: 4,5" placeholderTextColor="#9CA3AF" value={form.weight_kg} onChangeText={v => set('weight_kg', v)} keyboardType="decimal-pad" />

      {/* Pelagem */}
      <Text style={styles.label}>Cor da pelagem</Text>
      <TextInput style={styles.input} placeholder="Ex: Dourado, Tigrado..." placeholderTextColor="#9CA3AF" value={form.coat_color} onChangeText={v => set('coat_color', v)} />

      {/* Castrado */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>Castrado(a)?</Text>
        <Switch value={form.neutered} onValueChange={v => set('neutered', v)} trackColor={{ true: '#0EA5E9' }} />
      </View>

      {/* Saúde */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Histórico de Saúde</Text>
        <Text style={styles.label}>Condições de saúde</Text>
        <TextInput style={[styles.input, styles.inputMulti]} multiline numberOfLines={3} placeholder="Alergias, condições especiais..." placeholderTextColor="#9CA3AF" value={form.health_notes} onChangeText={v => set('health_notes', v)} textAlignVertical="top" />
        <Text style={styles.label}>Medicamentos em uso</Text>
        <TextInput style={[styles.input, styles.inputMulti]} multiline numberOfLines={3} placeholder="Medicamentos, dosagem..." placeholderTextColor="#9CA3AF" value={form.medications} onChangeText={v => set('medications', v)} textAlignVertical="top" />
      </View>

      {/* Dados do tutor */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dados do Tutor</Text>
        <Text style={styles.label}>Nome</Text>
        <TextInput style={styles.input} placeholder="Nome do tutor" placeholderTextColor="#9CA3AF" value={form.owner_name} onChangeText={v => set('owner_name', v)} />
        <Text style={styles.label}>Telefone</Text>
        <TextInput style={styles.input} placeholder="(00) 00000-0000" placeholderTextColor="#9CA3AF" value={form.owner_phone} onChangeText={v => set('owner_phone', formatPhone(v))} keyboardType="phone-pad" />
        <Text style={styles.label}>E-mail</Text>
        <TextInput style={styles.input} placeholder="email@exemplo.com" placeholderTextColor="#9CA3AF" value={form.owner_email} onChangeText={v => set('owner_email', v)} keyboardType="email-address" autoCapitalize="none" />
      </View>

      {/* Erro */}
      {erro ? (
        <View style={{ backgroundColor: '#FFF1F2', borderRadius: 12, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#FECDD3' }}>
          <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center' }}>{erro}</Text>
        </View>
      ) : null}

      {/* Salvar */}
      <TouchableOpacity style={styles.saveWrap} onPress={handleSave} disabled={loading}>
        <LinearGradient colors={['#0284C7', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Salvar paciente</Text>}
        </LinearGradient>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 50 },

  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 18 },
  input: {
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },
  inputMulti: { minHeight: 80, paddingTop: 14 },

  speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  speciesChip: {
    width: '30%', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 12,
    alignItems: 'center', borderWidth: 2, borderColor: '#E0F2FE',
  },
  speciesChipActive: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  speciesLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', marginTop: 4 },

  chips: { flexDirection: 'row', gap: 10 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E0F2FE' },
  chipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipTxt: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  chipTxtActive: { color: '#fff' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },

  section: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginTop: 20,
    borderWidth: 1.5, borderColor: '#E0F2FE',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 4 },

  saveWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 32 },
  saveBtn: { paddingVertical: 17, alignItems: 'center' },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
