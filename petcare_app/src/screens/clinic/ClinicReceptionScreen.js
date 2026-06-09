import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Modal, ScrollView, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Débito', 'Crédito', 'Convênio'];

const STATUS_COLORS = {
  open:      { bg: '#FEF3C7', text: '#D97706', label: 'Aberto' },
  closed:    { bg: '#DCFCE7', text: '#16A34A', label: 'Fechado' },
  cancelled: { bg: '#FEE2E2', text: '#DC2626', label: 'Cancelado' },
};

export default function ClinicReceptionScreen({ navigation, route }) {
  const { user, vetProfile } = useAuth();
  const clinicId = route?.params?.clinicId || vetProfile?.clinic_id;

  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('open'); // 'open' | 'closed' | 'all'
  const [selected, setSelected] = useState(null);   // order being checked out
  const [items,    setItems]    = useState([]);       // items of selected order
  const [discount, setDiscount] = useState('');
  const [payment,  setPayment]  = useState('');
  const [closing,  setClosing]  = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('clinic_service_orders')
      .select('id, vet_id, pet_name, owner_name, total, status, notes, created_at, closed_at, payment_method, vet_profiles!vet_id(full_name)')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(60);

    if (filter !== 'all') q = q.eq('status', filter);

    const { data } = await q;
    setOrders(data || []);
    setLoading(false);
  }, [clinicId, filter]);

  useFocusEffect(useCallback(() => { loadOrders(); }, [loadOrders]));

  const openOrder = async (order) => {
    const { data } = await supabase
      .from('clinic_service_order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('item_type, name');
    setItems(data || []);
    setDiscount('');
    setPayment('');
    setSelected(order);
  };

  const handleClose = async () => {
    if (!payment) { Alert.alert('Atenção', 'Selecione a forma de pagamento.'); return; }
    setClosing(true);
    const discVal = parseFloat(discount.replace(',', '.')) || 0;
    const { data, error } = await supabase.rpc('close_service_order', {
      p_order_id:       selected.id,
      p_payment_method: payment,
      p_discount:       discVal,
    });
    setClosing(false);

    if (error || data?.error) {
      Alert.alert('Erro', error?.message || data?.error);
      return;
    }

    const paidTotal = Number(data.total);
    Alert.alert(
      '✅ Pagamento fechado!',
      `${selected.pet_name} · R$ ${paidTotal.toFixed(2).replace('.', ',')} · ${payment}`,
      [{ text: 'OK', onPress: () => { setSelected(null); loadOrders(); } }]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar atendimento',
      `Cancelar o atendimento de ${selected?.pet_name}?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            const { data } = await supabase.rpc('cancel_service_order', { p_order_id: selected.id });
            if (data?.error) { Alert.alert('Erro', data.error); return; }
            setSelected(null);
            loadOrders();
          },
        },
      ]
    );
  };

  const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

  const discountVal = parseFloat(discount.replace(',', '.')) || 0;
  const itemsTotal  = items.reduce((s, i) => s + Number(i.subtotal), 0);
  const finalTotal  = Math.max(0, itemsTotal - discountVal);

  const renderOrder = ({ item: o }) => {
    const st = STATUS_COLORS[o.status] || STATUS_COLORS.open;
    const time = new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

    return (
      <TouchableOpacity
        style={[styles.orderCard, o.status === 'open' && styles.orderCardOpen]}
        onPress={() => openOrder(o)}
        activeOpacity={0.8}
      >
        <View style={styles.orderCardLeft}>
          <View style={[styles.statusDot, { backgroundColor: st.text }]} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.orderPet}>{o.pet_name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.statusBadgeText, { color: st.text }]}>{st.label}</Text>
            </View>
          </View>
          {o.owner_name && <Text style={styles.orderOwner}>{o.owner_name}</Text>}
          <Text style={styles.orderMeta}>
            Dr. {o.vet_profiles?.full_name || 'Veterinário'} · {date} {time}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.orderTotal}>{fmt(o.total)}</Text>
          {o.payment_method && (
            <Text style={styles.orderPayment}>{o.payment_method}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#059669', '#10B981']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Recepção</Text>
          <Text style={styles.headerSub}>Fechar atendimentos</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>
            {orders.filter(o => o.status === 'open').length} abertos
          </Text>
        </View>
      </LinearGradient>

      {/* Filtros */}
      <View style={styles.filterRow}>
        {[['open','Abertos'],['closed','Fechados'],['all','Todos']].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterBtn, filter === key && styles.filterBtnActive]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.filterBtnText, filter === key && styles.filterBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <View style={styles.center}><ActivityIndicator size="large" color="#059669" /></View>
        : (
          <FlatList
            data={orders}
            keyExtractor={i => i.id}
            renderItem={renderOrder}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={(
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>
                  {filter === 'open' ? 'Nenhum atendimento aberto' : 'Nenhum registro'}
                </Text>
                <Text style={styles.emptyHint}>
                  {filter === 'open' ? 'Os atendimentos criados pelos vets aparecerão aqui' : ''}
                </Text>
              </View>
            )}
          />
        )
      }

      {/* Modal de checkout */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{selected?.pet_name}</Text>
              {selected?.owner_name && <Text style={styles.modalSub}>Tutor: {selected.owner_name}</Text>}
              <Text style={styles.modalMeta}>
                Dr. {selected?.vet_profiles?.full_name || 'Veterinário'} ·{' '}
                {selected ? new Date(selected.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 8 }}>
              <Text style={{ color: '#64748B', fontSize: 16, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>

            {/* Observações clínicas */}
            {selected?.notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>📝 Obs. do veterinário</Text>
                <Text style={styles.notesText}>{selected.notes}</Text>
              </View>
            )}

            {/* Itens */}
            <Text style={styles.itemsLabel}>ITENS DO ATENDIMENTO</Text>
            <View style={styles.itemsCard}>
              {items.length === 0
                ? <Text style={{ color: '#94A3B8', textAlign: 'center', padding: 12 }}>Sem itens</Text>
                : items.map(i => (
                  <View key={i.id} style={styles.itemRow}>
                    <View style={[styles.itemTypeDot, {
                      backgroundColor: i.item_type === 'service' ? '#EDE9FE'
                        : i.item_type === 'product' ? '#DCFCE7' : '#E0F2FE',
                    }]}>
                      <Text style={{ fontSize: 10 }}>
                        {i.item_type === 'service' ? '🩺' : i.item_type === 'product' ? '💊' : '✏️'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{i.name}</Text>
                      <Text style={styles.itemSub}>{fmt(i.unit_price)} × {i.quantity}</Text>
                    </View>
                    <Text style={styles.itemSubtotal}>{fmt(i.subtotal)}</Text>
                  </View>
                ))
              }
              <View style={styles.subtotalRow}>
                <Text style={{ fontSize: 13, color: '#64748B' }}>Subtotal</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B' }}>{fmt(itemsTotal)}</Text>
              </View>
            </View>

            {/* Só mostra checkout se estiver aberto */}
            {selected?.status === 'open' ? (
              <>
                {/* Desconto */}
                <Text style={styles.itemsLabel}>DESCONTO</Text>
                <View style={[styles.itemsCard, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                  <Text style={{ fontSize: 13, color: '#64748B' }}>R$</Text>
                  <TextInput
                    style={styles.discountInput}
                    placeholder="0,00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    value={discount}
                    onChangeText={setDiscount}
                  />
                </View>

                {/* Forma de pagamento */}
                <Text style={styles.itemsLabel}>FORMA DE PAGAMENTO</Text>
                <View style={styles.paymentRow}>
                  {PAYMENT_METHODS.map(pm => (
                    <TouchableOpacity
                      key={pm}
                      style={[styles.pmChip, payment === pm && styles.pmChipActive]}
                      onPress={() => setPayment(pm)}
                    >
                      <Text style={[styles.pmChipText, payment === pm && styles.pmChipTextActive]}>{pm}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Total final */}
                <View style={styles.finalTotalBox}>
                  <Text style={styles.finalTotalLabel}>Total a cobrar</Text>
                  <Text style={styles.finalTotalValue}>{fmt(finalTotal)}</Text>
                  {discountVal > 0 && (
                    <Text style={styles.discountNote}>Desconto de {fmt(discountVal)} aplicado</Text>
                  )}
                </View>

                {/* Botões */}
                <TouchableOpacity
                  style={[styles.closeBtn, (!payment || closing) && { opacity: 0.5 }]}
                  onPress={handleClose}
                  disabled={!payment || closing}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#059669', '#10B981']} style={styles.closeBtnGradient}>
                    {closing
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.closeBtnText}>Fechar pagamento ✓</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelOrderBtn} onPress={handleCancel}>
                  <Text style={styles.cancelOrderBtnText}>Cancelar atendimento</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={[styles.finalTotalBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                <Text style={[styles.finalTotalLabel, { color: '#16A34A' }]}>Atendimento fechado</Text>
                <Text style={[styles.finalTotalValue, { color: '#16A34A' }]}>{fmt(selected?.total)}</Text>
                {selected?.payment_method && (
                  <Text style={[styles.discountNote, { color: '#16A34A' }]}>{selected.payment_method}</Text>
                )}
              </View>
            )}

          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF4' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 52 },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  countBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  countBadgeText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  filterRow: { flexDirection: 'row', padding: 12, gap: 8 },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#E0FDF4', borderWidth: 1.5, borderColor: '#A7F3D0' },
  filterBtnActive: { backgroundColor: '#059669', borderColor: '#059669' },
  filterBtnText:   { fontSize: 13, fontWeight: '700', color: '#059669' },
  filterBtnTextActive: { color: '#fff' },

  orderCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10, gap: 10,
    borderWidth: 1.5, borderColor: '#D1FAE5',
  },
  orderCardOpen: { borderColor: '#059669' },
  orderCardLeft: { justifyContent: 'center', alignItems: 'center', width: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  orderPet:     { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  orderOwner:   { fontSize: 12, color: '#64748B', marginTop: 1 },
  orderMeta:    { fontSize: 11, color: '#94A3B8', marginTop: 3 },
  orderTotal:   { fontSize: 16, fontWeight: '900', color: '#059669' },
  orderPayment: { fontSize: 10, color: '#94A3B8', marginTop: 2 },

  statusBadge:     { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },

  emptyState: { paddingTop: 60, alignItems: 'center' },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#374151', marginBottom: 6 },
  emptyHint:  { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  modal:       { flex: 1, backgroundColor: '#F8FAFC', padding: 20, paddingTop: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, paddingTop: 16 },
  modalTitle:  { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  modalSub:    { fontSize: 13, color: '#64748B', marginTop: 2 },
  modalMeta:   { fontSize: 11, color: '#94A3B8', marginTop: 4 },

  notesBox: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' },
  notesLabel: { fontSize: 11, fontWeight: '800', color: '#D97706', marginBottom: 4 },
  notesText:  { fontSize: 13, color: '#92400E', lineHeight: 18 },

  itemsLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 8, marginTop: 12 },
  itemsCard:  { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E0F2FE', marginBottom: 4 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemTypeDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  itemName:    { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  itemSub:     { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  itemSubtotal:{ fontSize: 14, fontWeight: '800', color: '#0EA5E9', minWidth: 70, textAlign: 'right' },

  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4 },

  discountInput: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 16, fontWeight: '700', borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },

  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pmChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#A7F3D0' },
  pmChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  pmChipText:   { fontSize: 13, fontWeight: '700', color: '#059669' },
  pmChipTextActive: { color: '#fff' },

  finalTotalBox: {
    backgroundColor: '#F0FDF4', borderRadius: 16, padding: 20, alignItems: 'center',
    marginTop: 12, marginBottom: 8, borderWidth: 1.5, borderColor: '#A7F3D0',
  },
  finalTotalLabel: { fontSize: 13, fontWeight: '700', color: '#059669', marginBottom: 4 },
  finalTotalValue: { fontSize: 32, fontWeight: '900', color: '#059669' },
  discountNote:    { fontSize: 12, color: '#16A34A', marginTop: 4 },

  closeBtn:         { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  closeBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  closeBtnText:     { fontSize: 16, fontWeight: '900', color: '#fff' },

  cancelOrderBtn:     { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  cancelOrderBtnText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
});
