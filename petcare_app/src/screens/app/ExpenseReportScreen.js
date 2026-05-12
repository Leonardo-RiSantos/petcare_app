import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DatePickerInput from '../../components/DatePickerInput';
import { generateExpenseReportHTML, exportReport } from '../../utils/generateReport';

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const fmt = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};
const toISO = (ddmmyyyy) => {
  const m = ddmmyyyy?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const currency = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

export default function ExpenseReportScreen({ navigation }) {
  const { user } = useAuth();
  const [pets, setPets] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null); // null = todos
  const [startDate, setStartDate] = useState(fmt(firstOfMonth.toISOString().slice(0, 10)));
  const [endDate, setEndDate] = useState(fmt(today.toISOString().slice(0, 10)));
  const [preview, setPreview] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    supabase.from('pets').select('id, name, species').eq('user_id', user.id).order('name')
      .then(({ data }) => setPets(data || []));
    supabase.from('profiles').select('full_name').eq('id', user.id).single()
      .then(({ data }) => setProfile(data));
  }, []);

  const fetchPreview = async () => {
    const isoStart = toISO(startDate);
    const isoEnd = toISO(endDate);
    if (!isoStart || !isoEnd) return;

    setLoading(true);
    let query = supabase
      .from('expenses')
      .select('id, pet_id, amount, date, category, description')
      .eq('user_id', user.id)
      .gte('date', isoStart)
      .lte('date', isoEnd)
      .order('date', { ascending: false });

    if (selectedPet) query = query.eq('pet_id', selectedPet);

    const { data } = await query;
    setPreview(data || []);
    setTotal((data || []).reduce((s, e) => s + (e.amount || 0), 0));
    setLoading(false);
  };

  useEffect(() => { fetchPreview(); }, [selectedPet, startDate, endDate]);

  const handleExport = async () => {
    const isoStart = toISO(startDate);
    const isoEnd = toISO(endDate);
    if (!isoStart || !isoEnd) return;

    setGenerating(true);
    try {
      if (selectedPet) {
        // Relatório de um pet específico
        const pet = pets.find(p => p.id === selectedPet);
        const html = generateExpenseReportHTML({
          pet,
          expenses: preview,
          startDate: isoStart,
          endDate: isoEnd,
          ownerName: profile?.full_name,
        });
        await exportReport(html, `gastos_${pet.name}.pdf`);
      } else {
        // Relatório consolidado de todos os pets
        const petMap = {};
        pets.forEach(p => { petMap[p.id] = p; });

        // Cria um "pet" virtual representando todos
        const allPet = { name: 'Todos os pets', species: '', breed: '' };
        const expensesWithPetName = preview.map(e => ({
          ...e,
          description: `${petMap[e.pet_id]?.name || ''}${e.description ? ' · ' + e.description : ''}`,
        }));

        const html = generateExpenseReportHTML({
          pet: allPet,
          expenses: expensesWithPetName,
          startDate: isoStart,
          endDate: isoEnd,
          ownerName: profile?.full_name,
        });
        await exportReport(html, `gastos_todos_pets.pdf`);
      }
    } catch (e) {
      console.warn('Erro ao gerar relatório:', e);
    } finally {
      setGenerating(false);
    }
  };

  const byCategory = {};
  preview.forEach(e => {
    const cat = e.category || 'Outros';
    byCategory[cat] = (byCategory[cat] || 0) + (e.amount || 0);
  });

  const CATEGORY_COLORS = {
    Ração:       '#D97706',
    Veterinário: '#0284C7',
    'Banho/Tosa':'#16A34A',
    Remédio:     '#7C3AED',
    Acessórios:  '#EA580C',
    Outros:      '#64748B',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Filtro de período */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Período</Text>
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLabel}>De</Text>
            <DatePickerInput value={startDate} onChangeText={setStartDate} label="Data inicial" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLabel}>Até</Text>
            <DatePickerInput value={endDate} onChangeText={setEndDate} label="Data final" />
          </View>
        </View>
      </View>

      {/* Filtro por pet */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pet</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petFilters}>
          <TouchableOpacity
            style={[styles.petChip, !selectedPet && styles.petChipActive]}
            onPress={() => setSelectedPet(null)}
          >
            <Text style={[styles.petChipText, !selectedPet && styles.petChipTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          {pets.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.petChip, selectedPet === p.id && styles.petChipActive]}
              onPress={() => setSelectedPet(p.id)}
            >
              <Text style={[styles.petChipText, selectedPet === p.id && styles.petChipTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Resumo */}
      {loading ? (
        <ActivityIndicator color="#0EA5E9" style={{ marginTop: 32 }} />
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryBox, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
              <Text style={styles.summaryLabel}>Total do período</Text>
              <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{currency(total)}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Lançamentos</Text>
              <Text style={styles.summaryValue}>{preview.length}</Text>
            </View>
          </View>

          {/* Por categoria */}
          {Object.keys(byCategory).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Por categoria</Text>
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, val]) => {
                  const pct = total ? (val / total) * 100 : 0;
                  const color = CATEGORY_COLORS[cat] || '#64748B';
                  return (
                    <View key={cat} style={styles.catRow}>
                      <View style={[styles.catDot, { backgroundColor: color }]} />
                      <Text style={styles.catName}>{cat}</Text>
                      <View style={styles.catBarWrap}>
                        <View style={[styles.catBar, { width: `${pct}%`, backgroundColor: color + '33' }]} />
                      </View>
                      <Text style={styles.catValue}>{currency(val)}</Text>
                    </View>
                  );
                })}
            </View>
          )}

          {/* Lista prévia */}
          {preview.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Lançamentos ({preview.length})</Text>
              {preview.slice(0, 10).map(e => {
                const petName = pets.find(p => p.id === e.pet_id)?.name;
                const color = CATEGORY_COLORS[e.category] || '#64748B';
                return (
                  <View key={e.id} style={styles.expRow}>
                    <View style={[styles.expCatDot, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expDesc}>{e.description || e.category}</Text>
                      {!selectedPet && petName && <Text style={styles.expPet}>{petName}</Text>}
                      <Text style={styles.expDate}>{fmt(e.date)}</Text>
                    </View>
                    <Text style={styles.expAmount}>{currency(e.amount)}</Text>
                  </View>
                );
              })}
              {preview.length > 10 && (
                <Text style={styles.moreText}>+{preview.length - 10} lançamentos no PDF</Text>
              )}
            </View>
          )}

          {preview.length === 0 && (
            <View style={styles.emptyCard}>
              <Image source={require('../../../assets/icon_expenses.png')} style={{ width: 48, height: 48, opacity: 0.3, marginBottom: 10 }} resizeMode="contain" />
              <Text style={styles.emptyText}>Nenhum gasto no período</Text>
            </View>
          )}
        </>
      )}

      {/* Botão exportar */}
      <TouchableOpacity style={styles.exportWrap} onPress={handleExport} disabled={generating || preview.length === 0}>
        <LinearGradient
          colors={preview.length === 0 ? ['#CBD5E1', '#CBD5E1'] : ['#0EA5E9', '#38BDF8']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.exportBtn}
        >
          {generating
            ? <ActivityIndicator color="#fff" />
            : <>
                <Image source={require('../../../assets/icon_doc.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />
                <Text style={styles.exportBtnText}>Gerar e exportar PDF</Text>
              </>}
        </LinearGradient>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 16, paddingBottom: 50 },

  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#0EA5E9', marginBottom: 12, letterSpacing: 0.3 },

  dateRow: { flexDirection: 'row', gap: 12 },
  dateLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 6 },

  petFilters: { gap: 8, paddingBottom: 4 },
  petChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 22,
    backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  petChipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  petChipText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  petChipTextActive: { color: '#fff' },

  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  summaryBox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  summaryLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: '900', color: '#1E293B' },

  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  catName: { fontSize: 13, fontWeight: '600', color: '#374151', width: 90 },
  catBarWrap: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  catBar: { height: '100%', borderRadius: 4 },
  catValue: { fontSize: 13, fontWeight: '700', color: '#1E293B', width: 80, textAlign: 'right' },

  expRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  expCatDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  expDesc: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  expPet: { fontSize: 11, color: '#0EA5E9', fontWeight: '600', marginTop: 1 },
  expDate: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  expAmount: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  moreText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 8 },

  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#94A3B8' },

  exportWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  exportBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
