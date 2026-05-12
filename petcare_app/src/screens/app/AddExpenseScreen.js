import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DatePickerInput from '../../components/DatePickerInput';

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
  Peixe:    require('../../../assets/pet_peixe.png'),
};

const CATEGORIES = [
  { key: 'racao',       label: 'Ração',      image: require('../../../assets/icon_racao.png'),       color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'veterinario', label: 'Veterinário', image: require('../../../assets/icon_medical.png'),    color: '#F43F5E', bg: '#FFE4E6' },
  { key: 'banho_tosa',  label: 'Banho/Tosa',  image: require('../../../assets/icon_banho.png'),      color: '#8B5CF6', bg: '#EDE9FE' },
  { key: 'remedio',     label: 'Remédio',     image: require('../../../assets/icon_medicine.png'),   color: '#EC4899', bg: '#FCE7F3' },
  { key: 'acessorios',  label: 'Acessórios',  image: require('../../../assets/icon_acessorios.png'), color: '#0EA5E9', bg: '#E0F2FE' },
  { key: 'outros',      label: 'Outros',      image: require('../../../assets/icon_outros.png'),     color: '#64748B', bg: '#F1F5F9' },
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
const toStorage = (ddmmyyyy) => {
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const dbToDDMMYYYY = (yyyymmdd) => {
  if (!yyyymmdd) return todayDDMMYYYY();
  const [y,m,d] = String(yyyymmdd).split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

export default function AddExpenseScreen({ route, navigation }) {
  const { user } = useAuth();
  const { petId: initialPetId, pets = [], editExpense } = route.params ?? {};
  const isEditing = !!editExpense;

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    pet_id:      editExpense?.pet_id      ?? initialPetId ?? (pets[0]?.id ?? ''),
    category:    editExpense?.category    ?? '',
    description: editExpense?.description ?? '',
    amount:      editExpense?.amount      ? String(editExpense.amount).replace('.',',') : '',
    date:        editExpense?.date        ? dbToDDMMYYYY(editExpense.date) : todayDDMMYYYY(),
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.pet_id || !form.category || !form.amount) {
      Alert.alert('Atenção', 'Pet, categoria e valor são obrigatórios.');
      return;
    }
    const amount = parseFloat(form.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.'); return;
    }
    const dateStorage = toStorage(form.date);
    if (!dateStorage) {
      Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.'); return;
    }
    setLoading(true);
    const payload = {
      user_id: user.id, pet_id: form.pet_id, category: form.category,
      description: form.description || null, amount, date: dateStorage,
    };
    const { error } = isEditing
      ? await supabase.from('expenses').update(payload).eq('id', editExpense.id)
      : await supabase.from('expenses').insert(payload);
    setLoading(false);
    if (error) Alert.alert('Erro', error.message);
    else navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {pets.length > 0 && (
        <>
          <Text style={styles.label}>Para qual pet?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.petCardsRow}
          >
            {pets.map(p => {
              const active = form.pet_id === p.id;
              const speciesImg = SPECIES_IMAGES[p.species];
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.petCard, active && styles.petCardActive]}
                  onPress={() => set('pet_id', p.id)}
                  activeOpacity={0.8}
                >
                  {/* Avatar */}
                  <View style={[styles.petCardAvatar, active && styles.petCardAvatarActive]}>
                    {p.photo_url ? (
                      <Image source={{ uri: p.photo_url }} style={styles.petCardPhoto} />
                    ) : speciesImg ? (
                      <Image source={speciesImg} style={styles.petCardSpeciesImg} resizeMode="contain" />
                    ) : (
                      <Text style={{ fontSize: 22 }}>🐾</Text>
                    )}
                  </View>

                  {/* Nome */}
                  <Text style={[styles.petCardName, active && styles.petCardNameActive]} numberOfLines={1}>
                    {p.name}
                  </Text>

                  {/* Indicador ativo */}
                  {active && (
                    <View style={styles.petCardCheck}>
                      <Image source={require('../../../assets/icon_check.png')} style={{ width: 10, height: 10 }} resizeMode="contain" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      <Text style={styles.label}>Categoria *</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => {
          const active = form.category === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryCard, active && { borderColor: cat.color, backgroundColor: cat.bg }]}
              onPress={() => set('category', cat.key)}
            >
              <View style={[styles.catIconWrap, { backgroundColor: active ? cat.color : '#F1F5F9' }]}>
                <Image source={cat.image} style={styles.catIcon} resizeMode="contain" />
              </View>
              <Text style={[styles.categoryLabel, active && { color: cat.color, fontWeight: '700' }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Valor (R$) *</Text>
      <TextInput
        style={styles.input}
        placeholder="0,00"
        placeholderTextColor="#9CA3AF"
        value={form.amount}
        onChangeText={v => set('amount', v)}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Descrição</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Consulta anual, Ração 15kg..."
        placeholderTextColor="#9CA3AF"
        value={form.description}
        onChangeText={v => set('description', v)}
      />

      <Text style={styles.label}>Data</Text>
      <DatePickerInput
        value={form.date}
        onChangeText={v => set('date', v)}
        label="Data do gasto"
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
        <LinearGradient colors={['#0EA5E9','#38BDF8']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.saveBtnGrad}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{isEditing ? 'Salvar alterações 💾' : 'Registrar gasto 💰'}</Text>}
        </LinearGradient>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 50 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 20 },
  input: {
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },
  petCardsRow: { paddingBottom: 4, gap: 10, paddingRight: 4 },

  petCard: {
    width: 76, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6,
    backgroundColor: '#fff', borderRadius: 18,
    borderWidth: 2, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    position: 'relative',
  },
  petCardActive: {
    borderColor: '#0EA5E9', backgroundColor: '#EFF6FF',
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 4,
  },
  petCardAvatar: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center',
    marginBottom: 8, overflow: 'hidden',
    borderWidth: 2, borderColor: '#E0F2FE',
  },
  petCardAvatarActive: {
    borderColor: '#0EA5E9', backgroundColor: '#DBEAFE',
  },
  petCardPhoto: { width: 48, height: 48, borderRadius: 14 },
  petCardSpeciesImg: { width: 32, height: 32 },
  petCardName: {
    fontSize: 11, fontWeight: '600', color: '#64748B',
    textAlign: 'center', maxWidth: 64,
  },
  petCardNameActive: { color: '#0EA5E9', fontWeight: '800' },
  petCardCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#0EA5E9', justifyContent: 'center', alignItems: 'center',
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: {
    width: '30%', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
    alignItems: 'center', borderWidth: 2, borderColor: '#E0F2FE',
  },
  catIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  catIcon: { width: 32, height: 32 },
  categoryLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', textAlign: 'center' },
  saveBtn: { marginTop: 32, borderRadius: 16, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 17, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
