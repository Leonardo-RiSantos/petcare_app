import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DatePickerInput from '../../components/DatePickerInput';

const PAYMENT_METHODS = ['dinheiro', 'pix', 'cartão', 'convênio', 'outro'];
const STATUS_OPTIONS  = ['pending', 'paid', 'partial', 'waived'];
const STATUS_LABELS   = { pending: 'Pendente', paid: 'Pago', partial: 'Parcial', waived: 'Isento' };
const STATUS_COLORS   = { pending: '#D97706', paid: '#16A34A', partial: '#0EA5E9', waived: '#64748B' };
const STATUS_BG       = { pending: '#FFFBEB', paid: '#DCFCE7', partial: '#EFF6FF', waived: '#F1F5F9' };

const fmt = (d) => { if (!d) return '—'; const [y,m,dd] = String(d).split('T')[0].split('-'); return `${dd}/${m}/${y}`; };
const currency = (v) => `R$ ${Number(v||0).toFixed(2).replace('.',',')}`;
const toISO = (ddmmyyyy) => { const m = ddmmyyyy?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const fromISO = (iso) => { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function VetFinancialScreen({ navigation }) {
  const { user } = useAuth();
  const today = new Date();
  const [billings, setBillings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editBilling, setEditBilling] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState(null);
  const [typeTab, setTypeTab] = useState('income'); // 'income' | 'expense'

  const emptyForm = () => ({
    patient_name: '', description: '', amount: '',
    status: 'pending', payment_method: '', due_date: '', notes: '',
    type: 'income',
  });
  const [form, setForm] = useState(emptyForm());
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchData = async () => {
    const { data } = await supabase
      .from('vet_billing')
      .select('*')
      .eq('vet_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setBillings(data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const byType = useMemo(() =>
    billings.filter(b => (b.type || 'income') === typeTab),
    [billings, typeTab]
  );

  const filtered = useMemo(() =>
    filterStatus ? byType.filter(b => b.status === filterStatus) : byType,
    [byType, filterStatus]
  );

  const totals = useMemo(() => {
    const income    = billings.filter(b => (b.type || 'income') === 'income');
    const expense   = billings.filter(b => b.type === 'expense');
    const paid      = income.filter(b => b.status === 'paid').reduce((s,b) => s + (b.amount||0), 0);
    const pending   = income.filter(b => b.status === 'pending').reduce((s,b) => s + (b.amount||0), 0);
    const totalExp  = expense.reduce((s,b) => s + (b.amount||0), 0);
    const thisMonth = income.filter(b => {
      const d = b.created_at?.slice(0,7);
      return d === today.toISOString().slice(0,7);
    });
    const monthTotal = thisMonth.filter(b => b.status === 'paid').reduce((s,b) => s + (b.amount||0), 0);
    return { paid, pending, monthTotal, totalExp, incomeCount: income.length, expenseCount: expense.length };
  }, [billings]);

  // Agrupa receitas por mês para mini-gráfico
  const monthlyData = useMemo(() => {
    const map = {};
    billings.filter(b => (b.type || 'income') === 'income' && b.status === 'paid').forEach(b => {
      const month = b.created_at?.slice(0, 7);
      if (month) map[month] = (map[month] || 0) + (b.amount || 0);
    });
    const sorted = Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).slice(-6);
    const max = Math.max(...sorted.map(([,v]) => v), 1);
    return sorted.map(([k, v]) => ({ label: MONTHS_PT[parseInt(k.split('-')[1]) - 1], value: v, pct: v / max }));
  }, [billings]);

  const openNew = () => { setEditBilling(null); setForm({ ...emptyForm(), type: typeTab }); setShowModal(true); };
  const openEdit = (b) => {
    setEditBilling(b);
    setForm({
      patient_name: b.patient_name || '',
      description: b.description || '',
      amount: String(b.amount || ''),
      status: b.status || 'pending',
      payment_method: b.payment_method || '',
      due_date: fromISO(b.due_date),
      notes: b.notes || '',
      type: b.type || 'income',
    });
    setShowModal(true);
  };

  const deleteBilling = async () => {
    if (!editBilling) return;
    setSaving(true);
    await supabase.from('vet_billing').delete().eq('id', editBilling.id);
    setSaving(false);
    setShowModal(false);
    fetchData();
  };

  const saveBilling = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);
    const payload = {
      vet_id: user.id,
      patient_name: form.patient_name || null,
      description: form.description,
      amount: parseFloat(form.amount.replace(',', '.')),
      type: form.type || 'income',
      status: form.status,
      payment_method: form.payment_method || null,
      due_date: toISO(form.due_date) || null,
      paid_at: form.status === 'paid' ? today.toISOString().slice(0,10) : null,
      notes: form.notes || null,
    };
    if (editBilling) {
      await supabase.from('vet_billing').update(payload).eq('id', editBilling.id);
    } else {
      await supabase.from('vet_billing').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    fetchData();
  };

  const markPaid = async (b) => {
    await supabase.from('vet_billing').update({ status: 'paid', paid_at: today.toISOString().slice(0,10) }).eq('id', b.id);
    fetchData();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F9FF' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
      >
        {/* Resumo */}
        <LinearGradient colors={['#0F3460', '#0284C7', '#0EA5E9']} style={styles.hero}>
          <View style={[styles.bubble, { width: 160, height: 160, top: -40, right: -40 }]} />
          <Text style={styles.heroLabel}>Faturamento do mês</Text>
          <Text style={styles.heroValue}>{currency(totals.monthTotal)}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeTxt}>Recebido: {currency(totals.paid)}</Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: 'rgba(245,158,11,0.3)' }]}>
              <Text style={styles.heroBadgeTxt}>Pendente: {currency(totals.pending)}</Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: 'rgba(239,68,68,0.3)' }]}>
              <Text style={styles.heroBadgeTxt}>Gastos: {currency(totals.totalExp)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Tabs Receita / Despesa */}
        <View style={styles.typeTabs}>
          {[
            { key: 'income',  label: `Receitas (${totals.incomeCount})`,  color: '#16A34A' },
            { key: 'expense', label: `Despesas (${totals.expenseCount})`, color: '#EF4444' },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeTab, typeTab === t.key && { borderBottomColor: t.color, borderBottomWidth: 2.5 }]}
              onPress={() => setTypeTab(t.key)}
            >
              <Text style={[styles.typeTabTxt, typeTab === t.key && { color: t.color, fontWeight: '800' }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mini gráfico */}
        {monthlyData.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Histórico de recebimentos</Text>
            <View style={styles.barChart}>
              {monthlyData.map((item, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barWrap}>
                    <LinearGradient
                      colors={['#0284C7', '#38BDF8']}
                      style={[styles.bar, { height: Math.max(item.pct * 80, 4) }]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{item.label}</Text>
                  <Text style={styles.barValue}>R${item.value.toFixed(0)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Filtros de status */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4, marginBottom: 14 }}>
          <TouchableOpacity
            style={[styles.filterChip, !filterStatus && styles.filterChipActive]}
            onPress={() => setFilterStatus(null)}
          >
            <Text style={[styles.filterChipTxt, !filterStatus && { color: '#0EA5E9', fontWeight: '700' }]}>Todos ({billings.length})</Text>
          </TouchableOpacity>
          {STATUS_OPTIONS.map(s => {
            const count = billings.filter(b => b.status === s).length;
            const active = filterStatus === s;
            return (
              <TouchableOpacity key={s} style={[styles.filterChip, active && { backgroundColor: STATUS_BG[s], borderColor: STATUS_COLORS[s] }]} onPress={() => setFilterStatus(active ? null : s)}>
                <Text style={[styles.filterChipTxt, active && { color: STATUS_COLORS[s], fontWeight: '700' }]}>{STATUS_LABELS[s]} ({count})</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Lista */}
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTxt}>Nenhum lançamento encontrado</Text>
          </View>
        ) : filtered.map(b => (
          <TouchableOpacity key={b.id} style={styles.billingCard} onPress={() => openEdit(b)} activeOpacity={0.82}>
            <View style={[styles.statusStripe, { backgroundColor: STATUS_COLORS[b.status] }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.billingRow}>
                <Text style={styles.billingDesc}>{b.description}</Text>
                <Text style={styles.billingAmount}>{currency(b.amount)}</Text>
              </View>
              {b.patient_name && <Text style={styles.billingPatient}>{b.patient_name}</Text>}
              <View style={styles.billingMeta}>
                <View style={[styles.statusPill, { backgroundColor: STATUS_BG[b.status] }]}>
                  <Text style={[styles.statusPillTxt, { color: STATUS_COLORS[b.status] }]}>{STATUS_LABELS[b.status]}</Text>
                </View>
                {b.payment_method && <Text style={styles.billingMethod}>{b.payment_method}</Text>}
                {b.due_date && <Text style={styles.billingDate}>Vence: {fmt(b.due_date)}</Text>}
                {b.paid_at && <Text style={styles.billingDate}>Pago: {fmt(b.paid_at)}</Text>}
              </View>
            </View>
            {b.status === 'pending' && (
              <TouchableOpacity
                style={styles.payBtn}
                onPress={(e) => { e.stopPropagation?.(); markPaid(b); }}
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#10B981', '#34D399']} style={styles.payBtnGrad}>
                  <Text style={styles.payBtnTxt}>Pago</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.85}>
        <LinearGradient colors={['#0284C7', '#0EA5E9']} style={styles.fabGrad}>
          <Text style={styles.fabTxt}>+ Lançamento</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{editBilling ? 'Editar lançamento' : 'Novo lançamento'}</Text>

              <Text style={styles.label}>Tipo</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
                {[{ key: 'income', label: 'Receita', color: '#16A34A', bg: '#DCFCE7' }, { key: 'expense', label: 'Despesa', color: '#EF4444', bg: '#FEE2E2' }].map(t => (
                  <TouchableOpacity key={t.key} onPress={() => set('type', t.key)}
                    style={[styles.chip, { flex: 1, justifyContent: 'center' }, form.type === t.key && { backgroundColor: t.bg, borderColor: t.color }]}>
                    <Text style={[styles.chipTxt, { textAlign: 'center' }, form.type === t.key && { color: t.color, fontWeight: '800' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Paciente</Text>
              <TextInput style={styles.input} value={form.patient_name} onChangeText={v => set('patient_name', v)} placeholder="Nome do paciente" placeholderTextColor="#9CA3AF" />

              <Text style={styles.label}>Descrição *</Text>
              <TextInput style={styles.input} value={form.description} onChangeText={v => set('description', v)} placeholder="Ex: Consulta geral, Vacinação..." placeholderTextColor="#9CA3AF" />

              <Text style={styles.label}>Valor (R$) *</Text>
              <TextInput style={styles.input} value={form.amount} onChangeText={v => set('amount', v)} placeholder="0,00" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />

              <Text style={styles.label}>Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                {STATUS_OPTIONS.map(s => (
                  <TouchableOpacity key={s} onPress={() => set('status', s)}
                    style={[styles.chip, form.status === s && { backgroundColor: STATUS_BG[s], borderColor: STATUS_COLORS[s] }]}>
                    <Text style={[styles.chipTxt, form.status === s && { color: STATUS_COLORS[s], fontWeight: '700' }]}>{STATUS_LABELS[s]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Forma de pagamento</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity key={m} onPress={() => set('payment_method', m)}
                    style={[styles.chip, form.payment_method === m && { backgroundColor: '#EFF6FF', borderColor: '#0EA5E9' }]}>
                    <Text style={[styles.chipTxt, form.payment_method === m && { color: '#0EA5E9', fontWeight: '700' }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.label, { marginTop: 14 }]}>Data de vencimento</Text>
              <DatePickerInput value={form.due_date} onChangeText={v => set('due_date', v)} label="Data de vencimento" />

              <Text style={[styles.label, { marginTop: 14 }]}>Observações</Text>
              <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={form.notes} onChangeText={v => set('notes', v)} placeholder="Observações internas..." placeholderTextColor="#9CA3AF" multiline />

              <TouchableOpacity style={{ borderRadius: 14, overflow: 'hidden', marginTop: 20 }} onPress={saveBilling} disabled={saving}>
                <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center' }}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Salvar</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowModal(false)} style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ color: '#94A3B8', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              {editBilling && (
                <TouchableOpacity onPress={deleteBilling} style={{ alignItems: 'center', paddingBottom: 24 }} disabled={saving}>
                  <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>Excluir lançamento</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: { borderRadius: 20, padding: 20, marginBottom: 14, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 4 },
  heroValue: { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 12 },
  heroRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  heroBadgeTxt: { fontSize: 12, color: '#fff', fontWeight: '600' },

  chartCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#0EA5E9', marginBottom: 14, letterSpacing: 0.3 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 8 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barWrap: { flex: 1, justifyContent: 'flex-end', width: '100%' },
  bar: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  barValue: { fontSize: 9, color: '#94A3B8' },

  typeTabs: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E0F2FE', overflow: 'hidden' },
  typeTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  typeTabTxt: { fontSize: 14, color: '#64748B', fontWeight: '600' },

  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
  filterChipTxt: { fontSize: 13, color: '#64748B' },
  filterChipActive: { backgroundColor: '#EFF6FF', borderColor: '#0EA5E9' },

  billingCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  statusStripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  billingDesc: { fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1, marginRight: 8 },
  billingAmount: { fontSize: 15, fontWeight: '900', color: '#1E293B' },
  billingPatient: { fontSize: 12, color: '#0EA5E9', fontWeight: '600', marginBottom: 6 },
  billingMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillTxt: { fontSize: 11, fontWeight: '700' },
  billingMethod: { fontSize: 11, color: '#64748B' },
  billingDate: { fontSize: 11, color: '#94A3B8' },

  payBtn: { borderRadius: 10, overflow: 'hidden', flexShrink: 0 },
  payBtnGrad: { paddingHorizontal: 12, paddingVertical: 8 },
  payBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },

  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyTxt: { fontSize: 14, color: '#94A3B8' },

  fab: { position: 'absolute', bottom: 20, right: 20, borderRadius: 28, overflow: 'hidden', elevation: 6, shadowColor: '#0284C7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
  fabGrad: { paddingVertical: 14, paddingHorizontal: 24 },
  fabTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 14 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
  chipTxt: { fontSize: 13, color: '#64748B' },
});
