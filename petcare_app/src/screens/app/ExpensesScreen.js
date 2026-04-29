import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

const CATEGORIES = [
  { key: 'racao',      label: 'Ração',       emoji: '🍖', color: '#F59E0B', light: '#FEF9C3', grad: ['#F59E0B', '#FB923C'] },
  { key: 'veterinario',label: 'Veterinário', emoji: '🏥', color: '#EF4444', light: '#FEE2E2', grad: ['#EF4444', '#F87171'] },
  { key: 'banho_tosa', label: 'Banho/Tosa',  emoji: '✂️', color: '#8B5CF6', light: '#EDE9FE', grad: ['#8B5CF6', '#A78BFA'] },
  { key: 'remedio',    label: 'Remédio',     emoji: '💊', color: '#EC4899', light: '#FCE7F3', grad: ['#EC4899', '#F472B6'] },
  { key: 'acessorios', label: 'Acessórios',  emoji: '🎾', color: '#10B981', light: '#D1FAE5', grad: ['#10B981', '#34D399'] },
  { key: 'outros',     label: 'Outros',      emoji: '📦', color: '#64748B', light: '#F1F5F9', grad: ['#64748B', '#94A3B8'] },
];

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function formatCurrency(value) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function PetChip({ pet, active, onPress }) {
  const EMOJIS = { Cachorro: '🐶', Gato: '🐱', Ave: '🐦', Coelho: '🐰', Hamster: '🐹', Réptil: '🦎', Outro: '🐾' };
  return (
    <TouchableOpacity onPress={onPress} style={[styles.petChip, active && styles.petChipActive]}>
      <Text style={styles.petChipEmoji}>{EMOJIS[pet.species] || '🐾'}</Text>
      <Text style={[styles.petChipText, active && styles.petChipTextActive]}>{pet.name}</Text>
    </TouchableOpacity>
  );
}

function CategoryCard({ cat, amount, total, onPress }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <TouchableOpacity style={styles.catCard} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient colors={[cat.light, '#fff']} style={styles.catCardGrad}>
        <View style={[styles.catIconCircle, { backgroundColor: cat.color }]}>
          <Text style={styles.catIconEmoji}>{cat.emoji}</Text>
        </View>
        <Text style={styles.catCardLabel}>{cat.label}</Text>
        <Text style={styles.catCardAmount}>{formatCurrency(amount)}</Text>
        <View style={styles.catBarBg}>
          <View style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
        </View>
        <Text style={styles.catPct}>{pct}%</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function TransactionCard({ expense, pets, categories }) {
  const cat = categories.find(c => c.key === expense.category) || categories[5];
  const pet = pets.find(p => p.id === expense.pet_id);
  return (
    <View style={styles.txCard}>
      <View style={[styles.txIconWrap, { backgroundColor: cat.light }]}>
        <Text style={styles.txEmoji}>{cat.emoji}</Text>
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {expense.description || cat.label}
        </Text>
        <Text style={styles.txMeta}>
          {pet ? `${pet.name}` : '—'} · {expense.date}
        </Text>
      </View>
      <View style={[styles.txAmountBadge, { backgroundColor: cat.light }]}>
        <Text style={[styles.txAmount, { color: cat.color }]}>
          {formatCurrency(expense.amount)}
        </Text>
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

  const thisMonth = filtered.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = filtered.filter(e => {
    const d = new Date(e.date);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });

  const totalMes = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const totalMesAnterior = lastMonth.reduce((s, e) => s + Number(e.amount), 0);
  const totalGeral = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const diff = totalMesAnterior > 0
    ? Math.round(((totalMes - totalMesAnterior) / totalMesAnterior) * 100)
    : null;

  const byCategory = CATEGORIES.map(cat => ({
    ...cat,
    amount: filtered.filter(e => e.category === cat.key).reduce((s, e) => s + Number(e.amount), 0),
  }));

  const activeCats = byCategory.filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  const petName = selectedPetId ? pets.find(p => p.id === selectedPetId)?.name : null;

  const funMessages = [
    'Seu pet é amado de verdade! 🐾',
    'Cuidando com carinho e dedicação! 💚',
    'Que tutor incrível você é! ✨',
    'Seu pet tem o melhor lar! 🏡',
    'Investindo no melhor amigo! 🐶',
  ];
  const msg = funMessages[Math.floor(totalMes * 7) % funMessages.length];

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#10B981" /></View>;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Filtro por pet */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipScrollContent}>
          <TouchableOpacity
            style={[styles.petChip, !selectedPetId && styles.petChipActive]}
            onPress={() => setSelectedPetId(null)}
          >
            <Text style={styles.petChipEmoji}>🐾</Text>
            <Text style={[styles.petChipText, !selectedPetId && styles.petChipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {pets.map(p => (
            <PetChip key={p.id} pet={p} active={selectedPetId === p.id} onPress={() => setSelectedPetId(p.id)} />
          ))}
        </ScrollView>

        {/* Hero Card */}
        <LinearGradient
          colors={['#065F46', '#10B981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>
                {petName ? `${petName} · ` : ''}{MONTHS[now.getMonth()]} {now.getFullYear()}
              </Text>
              <Text style={styles.heroAmount}>{formatCurrency(totalMes)}</Text>
              <Text style={styles.heroMsg}>{msg}</Text>
            </View>
            <Text style={styles.heroPaw}>🐾</Text>
          </View>
          <View style={styles.heroBottom}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>vs mês anterior</Text>
              <Text style={styles.heroStatValue}>
                {diff === null ? '—' : diff === 0 ? '→ igual' : diff > 0 ? `↑ ${diff}%` : `↓ ${Math.abs(diff)}%`}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>total geral</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(totalGeral)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>registros</Text>
              <Text style={styles.heroStatValue}>{thisMonth.length}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Botão adicionar */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddExpense', { petId: selectedPetId, pets })}
          activeOpacity={0.85}
        >
          <Text style={styles.addBtnIcon}>+</Text>
          <Text style={styles.addBtnText}>Registrar gasto</Text>
        </TouchableOpacity>

        {/* Por categoria */}
        {activeCats.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Por onde foi o dinheiro? 🐾</Text>
            </View>
            <View style={styles.catGrid}>
              {activeCats.map(cat => (
                <CategoryCard key={cat.key} cat={cat} amount={cat.amount} total={totalGeral} />
              ))}
            </View>
          </>
        )}

        {/* Últimas transações */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimas transações</Text>
          <Text style={styles.sectionCount}>{filtered.length} registros</Text>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIllo}>🐾💸</Text>
            <Text style={styles.emptyTitle}>Nenhum gasto ainda!</Text>
            <Text style={styles.emptyDesc}>Registre os gastos com seu pet para acompanhar tudo em um lugar só.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AddExpense', { petId: selectedPetId, pets })}>
              <Text style={styles.emptyBtnText}>Registrar primeiro gasto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.slice(0, 15).map(expense => (
            <TransactionCard key={expense.id} expense={expense} pets={pets} categories={CATEGORIES} />
          ))
        )}

        {filtered.length > 15 && (
          <Text style={styles.moreText}>+ {filtered.length - 15} registros anteriores</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF4' },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Chips
  chipScroll: { marginBottom: 16 },
  chipScrollContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  petChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  petChipActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  petChipEmoji: { fontSize: 15 },
  petChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  petChipTextActive: { color: '#fff' },

  // Hero
  heroCard: {
    marginHorizontal: 16, borderRadius: 24, padding: 22, marginBottom: 14,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 6 },
  heroAmount: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroMsg: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6, fontStyle: 'italic' },
  heroPaw: { fontSize: 40, opacity: 0.6 },
  heroBottom: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  heroStatValue: { fontSize: 14, color: '#fff', fontWeight: '800' },
  heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },

  // Add button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, paddingVertical: 14,
    marginBottom: 20, borderWidth: 2, borderColor: '#10B981',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
  },
  addBtnIcon: { fontSize: 20, color: '#10B981', fontWeight: '700' },
  addBtnText: { fontSize: 15, fontWeight: '700', color: '#10B981' },

  // Sections
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  sectionCount: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },

  // Category grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 24 },
  catCard: {
    width: CARD_W, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  catCardGrad: { padding: 16, alignItems: 'flex-start' },
  catIconCircle: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center',
    alignItems: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
  catIconEmoji: { fontSize: 22 },
  catCardLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  catCardAmount: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
  catBarBg: { width: '100%', height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  catBarFill: { height: 5, borderRadius: 3 },
  catPct: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },

  // Transactions
  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16,
    padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  txIconWrap: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  txEmoji: { fontSize: 22 },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  txMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  txAmountBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0 },
  txAmount: { fontSize: 14, fontWeight: '800' },

  // Empty
  emptyCard: {
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 24, padding: 36,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  emptyIllo: { fontSize: 56, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  emptyBtn: { backgroundColor: '#10B981', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  moreText: { textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 8, marginBottom: 4 },
});
