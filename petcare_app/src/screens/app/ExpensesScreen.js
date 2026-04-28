import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = [
  { key: 'racao', label: 'Ração', emoji: '🍖', color: '#F59E0B' },
  { key: 'veterinario', label: 'Veterinário', emoji: '🏥', color: '#EF4444' },
  { key: 'banho_tosa', label: 'Banho/Tosa', emoji: '✂️', color: '#8B5CF6' },
  { key: 'remedio', label: 'Remédio', emoji: '💊', color: '#EC4899' },
  { key: 'acessorios', label: 'Acessórios', emoji: '🎾', color: '#10B981' },
  { key: 'outros', label: 'Outros', emoji: '📦', color: '#64748B' },
];

function formatCurrency(value) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function CategoryBar({ category, amount, total }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <View style={styles.catRow}>
      <Text style={styles.catEmoji}>{category.emoji}</Text>
      <View style={styles.catInfo}>
        <View style={styles.catLabelRow}>
          <Text style={styles.catLabel}>{category.label}</Text>
          <Text style={styles.catAmount}>{formatCurrency(amount)}</Text>
        </View>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: category.color }]} />
        </View>
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

  const filtered = selectedPetId
    ? expenses.filter(e => e.pet_id === selectedPetId)
    : expenses;

  const totalGeral = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const now = new Date();
  const currentMonth = filtered.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalMes = currentMonth.reduce((s, e) => s + Number(e.amount), 0);

  const byCategory = CATEGORIES.map(cat => ({
    ...cat,
    amount: filtered.filter(e => e.category === cat.key).reduce((s, e) => s + Number(e.amount), 0),
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  const recent = filtered.slice(0, 10);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
    >
      {/* Filtro por pet */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <TouchableOpacity
          style={[styles.filterChip, !selectedPetId && styles.filterChipActive]}
          onPress={() => setSelectedPetId(null)}
        >
          <Text style={[styles.filterChipText, !selectedPetId && styles.filterChipTextActive]}>
            Todos os pets
          </Text>
        </TouchableOpacity>
        {pets.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[styles.filterChip, selectedPetId === p.id && styles.filterChipActive]}
            onPress={() => setSelectedPetId(p.id)}
          >
            <Text style={[styles.filterChipText, selectedPetId === p.id && styles.filterChipTextActive]}>
              {p.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Totais */}
      <View style={styles.totalsRow}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Este mês</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalMes)}</Text>
        </View>
        <View style={[styles.totalCard, styles.totalCardAlt]}>
          <Text style={styles.totalLabel}>Total geral</Text>
          <Text style={[styles.totalValue, styles.totalValueAlt]}>{formatCurrency(totalGeral)}</Text>
        </View>
      </View>

      {/* Breakdown por categoria */}
      {byCategory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Por categoria</Text>
          {byCategory.map(cat => (
            <CategoryBar key={cat.key} category={cat} amount={cat.amount} total={totalGeral} />
          ))}
        </View>
      )}

      {/* Botão adicionar */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddExpense', { petId: selectedPetId, pets })}
      >
        <Text style={styles.addButtonText}>+ Registrar gasto</Text>
      </TouchableOpacity>

      {/* Histórico recente */}
      <Text style={styles.sectionTitle}>Histórico recente</Text>
      {recent.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Nenhum gasto registrado ainda</Text>
        </View>
      ) : (
        recent.map(expense => {
          const cat = CATEGORIES.find(c => c.key === expense.category);
          const pet = pets.find(p => p.id === expense.pet_id);
          return (
            <View key={expense.id} style={styles.expenseItem}>
              <View style={[styles.expenseDot, { backgroundColor: cat?.color ?? '#94A3B8' }]}>
                <Text style={{ fontSize: 16 }}>{cat?.emoji ?? '📦'}</Text>
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDesc}>{expense.description || cat?.label}</Text>
                <Text style={styles.expenseMeta}>
                  {pet?.name ?? '—'} · {expense.date}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  filterScroll: { marginBottom: 16, marginHorizontal: -20, paddingHorizontal: 20 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
  },
  filterChipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  filterChipText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  totalsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  totalCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  totalCardAlt: { backgroundColor: '#0EA5E9' },
  totalLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '500', marginBottom: 4 },
  totalValue: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
  totalValueAlt: { color: '#fff' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 14 },

  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catEmoji: { fontSize: 20, marginRight: 10, width: 28, textAlign: 'center' },
  catInfo: { flex: 1 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
  catAmount: { fontSize: 13, color: '#1E293B', fontWeight: '700' },
  barBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  addButton: {
    backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginBottom: 20,
  },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 12 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 14 },

  expenseItem: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  expenseDot: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  expenseInfo: { flex: 1 },
  expenseDesc: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  expenseMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  expenseAmount: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
});
