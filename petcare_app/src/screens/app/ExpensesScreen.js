import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');
const CARD_W = (width - 52) / 2;

// Paleta baseada na logo PetCare+
// Azul céu: #0EA5E9 | Azul marinho: #0F3460 | Ciano: #38BDF8
// Laranja accent: #F59E0B | Background: #F0F9FF
const CATEGORIES = [
  { key: 'racao',       label: 'Ração',      emoji: '🍖', image: require('../../../assets/icon_racao.png'),   color: '#F59E0B', light: '#FFFBEB', dark: '#B45309', grad: ['#FEF3C7', '#FFFBEB'] },
  { key: 'veterinario', label: 'Veterinário', emoji: '🏥', image: require('../../../assets/icon_medical.png'), color: '#F43F5E', light: '#FFF1F2', dark: '#BE123C', grad: ['#FFE4E6', '#FFF1F2'] },
  { key: 'banho_tosa',  label: 'Banho/Tosa',  emoji: '✂️', color: '#8B5CF6', light: '#F5F3FF', dark: '#6D28D9', grad: ['#EDE9FE', '#F5F3FF'] },
  { key: 'remedio',     label: 'Remédio',     emoji: '💊', image: require('../../../assets/icon_medicine.png'), color: '#EC4899', light: '#FDF2F8', dark: '#BE185D', grad: ['#FCE7F3', '#FDF2F8'] },
  { key: 'acessorios',  label: 'Acessórios',  emoji: '🎾', color: '#0EA5E9', light: '#F0F9FF', dark: '#0369A1', grad: ['#E0F2FE', '#F0F9FF'] },
  { key: 'outros',      label: 'Outros',      emoji: '📦', color: '#64748B', light: '#F8FAFC', dark: '#475569', grad: ['#F1F5F9', '#F8FAFC'] },
];

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
};

function fmt(v) {
  return `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function formatDate(d) {
  if (!d) return '—';
  const s = String(d).split('T')[0];
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function CategoryCard({ cat, amount, total }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <View style={[styles.catCard, { shadowColor: cat.color }]}>
      <LinearGradient colors={cat.grad} style={styles.catGrad}>
        {/* Icon */}
        <View style={[styles.catCircle, { backgroundColor: cat.color }]}>
          {cat.image
            ? <Image source={cat.image} style={{ width: 28, height: 28 }} resizeMode="contain" />
            : <Text style={styles.catEmoji}>{cat.emoji}</Text>}
        </View>

        <Text style={styles.catLabel}>{cat.label}</Text>
        <Text style={[styles.catAmount, { color: cat.dark }]}>{fmt(amount)}</Text>

        {/* Barra */}
        <View style={styles.catBarBg}>
          <View style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
        </View>
        <Text style={[styles.catPct, { color: cat.color }]}>{pct}% do total</Text>
      </LinearGradient>
    </View>
  );
}

function TxCard({ expense, pets }) {
  const cat = CATEGORIES.find(c => c.key === expense.category) || CATEGORIES[5];
  const pet = pets.find(p => p.id === expense.pet_id);
  return (
    <View style={styles.txCard}>
      <View style={[styles.txIcon, { backgroundColor: cat.light }]}>
        {cat.image
          ? <Image source={cat.image} style={{ width: 26, height: 26 }} resizeMode="contain" />
          : <Text style={styles.txEmoji}>{cat.emoji}</Text>}
      </View>
      <View style={styles.txBody}>
        <Text style={styles.txTitle} numberOfLines={1}>{expense.description || cat.label}</Text>
        <Text style={styles.txSub}>{pet?.name || '—'} · {formatDate(expense.date)}</Text>
      </View>
      <View style={[styles.txBadge, { backgroundColor: cat.light }]}>
        <Text style={[styles.txAmt, { color: cat.dark }]}>{fmt(expense.amount)}</Text>
      </View>
    </View>
  );
}

export default function ExpensesScreen({ navigation, route }) {
  const { user } = useAuth();
  const initialPetId = route?.params?.petId ?? null;

  const [pets, setPets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState(initialPetId);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();

  const fetchData = async () => {
    const [petsRes, expRes] = await Promise.all([
      supabase.from('pets').select('id, name, species').eq('user_id', user.id).order('created_at'),
      supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    ]);
    if (petsRes.data) setPets(petsRes.data);
    if (expRes.data) setExpenses(expRes.data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => {
    if (route?.params?.petId) setSelectedPetId(route.params.petId);
    fetchData();
  }, [route?.params?.petId]));

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const filtered = selectedPetId ? expenses.filter(e => e.pet_id === selectedPetId) : expenses;

  const thisMes = filtered.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMes = filtered.filter(e => {
    const d = new Date(e.date);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });

  const totalMes = thisMes.reduce((s, e) => s + Number(e.amount), 0);
  const totalAnterior = lastMes.reduce((s, e) => s + Number(e.amount), 0);
  const totalGeral = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const diff = totalAnterior > 0 ? Math.round(((totalMes - totalAnterior) / totalAnterior) * 100) : null;

  const byCategory = CATEGORIES.map(cat => ({
    ...cat,
    amount: filtered.filter(e => e.category === cat.key).reduce((s, e) => s + Number(e.amount), 0),
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  const petName = pets.find(p => p.id === selectedPetId)?.name;

  const msgs = [
    'Seu pet está sendo muito bem cuidado! 🐾',
    'Que tutor dedicado você é! ✨',
    'Investindo no melhor amigo! 💙',
    'Amor que se mede em cuidado! 🐾',
  ];
  const heroMsg = msgs[Math.floor(totalMes * 3) % msgs.length];

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
    >
      {/* Filtro pets */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <TouchableOpacity
          style={[styles.chip, !selectedPetId && styles.chipActive]}
          onPress={() => setSelectedPetId(null)}
        >
          <Text style={styles.chipEmoji}>🐾</Text>
          <Text style={[styles.chipTxt, !selectedPetId && styles.chipTxtActive]}>Todos</Text>
        </TouchableOpacity>
        {pets.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[styles.chip, selectedPetId === p.id && styles.chipActive]}
            onPress={() => setSelectedPetId(p.id)}
          >
            {SPECIES_IMAGES[p.species]
            ? <Image source={SPECIES_IMAGES[p.species]} style={{ width: 20, height: 20 }} resizeMode="contain" />
            : <Text style={styles.chipEmoji}>🐾</Text>}
            <Text style={[styles.chipTxt, selectedPetId === p.id && styles.chipTxtActive]}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Hero Card */}
      <LinearGradient
        colors={['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* Círculos decorativos */}
        <View style={styles.heroBubble1} />
        <View style={styles.heroBubble2} />

        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroSub}>
              {petName ? `${petName}  ·  ` : ''}{MONTHS[now.getMonth()]}
            </Text>
            <Text style={styles.heroAmount}>{fmt(totalMes)}</Text>
            <Text style={styles.heroMsg}>{heroMsg}</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <Text style={styles.heroIconEmoji}>💙</Text>
          </View>
        </View>

        {/* Stats bar */}
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>
              {diff === null ? '—' : diff === 0 ? '→' : diff > 0 ? `↑ ${diff}%` : `↓ ${Math.abs(diff)}%`}
            </Text>
            <Text style={styles.heroStatLbl}>vs mês ant.</Text>
          </View>
          <View style={styles.heroDiv} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{fmt(totalGeral)}</Text>
            <Text style={styles.heroStatLbl}>total geral</Text>
          </View>
          <View style={styles.heroDiv} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{thisMes.length}</Text>
            <Text style={styles.heroStatLbl}>este mês</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Botão adicionar */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => navigation.navigate('AddExpense', { petId: selectedPetId, pets })}
        activeOpacity={0.85}
      >
        <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGrad}>
          <Text style={styles.addBtnText}>+ Registrar gasto</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Categorias */}
      {byCategory.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Para onde foi? 🐾</Text>
          </View>
          <View style={styles.catGrid}>
            {byCategory.map(cat => (
              <CategoryCard key={cat.key} cat={cat} amount={cat.amount} total={totalGeral} />
            ))}
          </View>
        </>
      )}

      {/* Transações */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Últimas transações</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countTxt}>{filtered.length}</Text>
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIllo}>🐾</Text>
          <Text style={styles.emptyTitle}>Sem gastos ainda!</Text>
          <Text style={styles.emptyDesc}>Registre os cuidados com seu pet e acompanhe tudo aqui.</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('AddExpense', { petId: selectedPetId, pets })}
          >
            <Text style={styles.emptyBtnTxt}>Registrar primeiro gasto</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.txList}>
          {filtered.slice(0, 20).map(e => <TxCard key={e.id} expense={e} pets={pets} />)}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Chips
  chips: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  chipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipEmoji: { fontSize: 15 },
  chipTxt: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  chipTxtActive: { color: '#fff' },

  // Hero
  hero: {
    marginHorizontal: 16, borderRadius: 28, padding: 24, marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#0284C7', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 16, elevation: 8,
  },
  heroBubble1: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.18)', right: -40, top: -40,
  },
  heroBubble2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.14)', right: 60, bottom: -20,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  heroAmount: { fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: -1.5, marginBottom: 6 },
  heroMsg: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' },
  heroIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  heroIconEmoji: { fontSize: 26 },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 14 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 3 },
  heroStatLbl: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 4 },

  // Add button
  addBtn: {
    marginHorizontal: 16, borderRadius: 18, marginBottom: 22, overflow: 'hidden',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  addBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  // Section
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  countBadge: { backgroundColor: '#E0F2FE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  countTxt: { fontSize: 12, fontWeight: '700', color: '#0369A1' },

  // Category grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 24 },
  catCard: {
    width: CARD_W, borderRadius: 20, overflow: 'hidden',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3,
  },
  catGrad: { padding: 16 },
  catCircle: {
    width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
  catEmoji: { fontSize: 24 },
  catLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  catAmount: { fontSize: 18, fontWeight: '900', marginBottom: 12 },
  catBarBg: { height: 5, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  catBarFill: { height: 5, borderRadius: 3 },
  catPct: { fontSize: 11, fontWeight: '700' },

  // Transactions
  txList: { paddingHorizontal: 16, gap: 8 },
  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 18, padding: 14,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1,
  },
  txIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  txEmoji: { fontSize: 22 },
  txBody: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  txSub: { fontSize: 12, color: '#94A3B8', marginTop: 3 },
  txBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0 },
  txAmt: { fontSize: 14, fontWeight: '800' },

  // Empty
  empty: {
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 24, padding: 36, alignItems: 'center',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  emptyIllo: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22, marginBottom: 22 },
  emptyBtn: {
    backgroundColor: '#0EA5E9', borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  emptyBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
