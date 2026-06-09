import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const PAYMENT_METHODS = [
  { key: 'pix',            label: 'PIX' },
  { key: 'dinheiro',       label: 'Dinheiro' },
  { key: 'cartão_débito',  label: 'Débito' },
  { key: 'cartão_crédito', label: 'Crédito' },
  { key: 'outro',          label: 'Outro' },
];

export default function ClinicSaleScreen({ navigation, route }) {
  const { clinicId } = route.params;
  const { user } = useAuth();

  const [products,     setProducts]     = useState([]);
  const [cart,         setCart]         = useState([]); // { product, qty }
  const [customerName, setCustomerName] = useState('');
  const [patientName,  setPatientName]  = useState('');
  const [payMethod,    setPayMethod]    = useState('pix');
  const [discount,     setDiscount]     = useState('0');
  const [notes,        setNotes]        = useState('');
  const [search,       setSearch]       = useState('');
  const [loadingProds, setLoadingProds] = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [lastTotal,    setLastTotal]    = useState(0);

  const fetchProducts = useCallback(async () => {
    setLoadingProds(true);
    const { data } = await supabase
      .from('clinic_products')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('active', true)
      .order('name');
    setProducts(data || []);
    setLoadingProds(false);
  }, [clinicId]);

  useState(() => { fetchProducts(); }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        return updated;
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateCartQty = (productId, qty) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.product.id !== productId));
    } else {
      setCart(prev => prev.map(i => i.product.id === productId ? { ...i, qty } : i));
    }
  };

  const subtotal  = cart.reduce((s, i) => s + (i.product.price * i.qty), 0);
  const discountV = parseFloat(String(discount).replace(',', '.')) || 0;
  const total     = Math.max(0, subtotal - discountV);

  const handleFinalize = async () => {
    if (cart.length === 0) { Alert.alert('Carrinho vazio', 'Adicione ao menos um item.'); return; }
    setSaving(true);
    try {
      // Insere a venda
      const { data: sale, error: saleErr } = await supabase
        .from('clinic_sales')
        .insert({
          clinic_id:      clinicId,
          seller_id:      user.id,
          customer_name:  customerName.trim() || null,
          patient_name:   patientName.trim()  || null,
          total,
          discount:       discountV,
          payment_method: payMethod,
          notes:          notes.trim() || null,
        })
        .select('id')
        .single();

      if (saleErr) throw saleErr;

      // Insere os itens (trigger deduz estoque automaticamente)
      const items = cart.map(i => ({
        sale_id:    sale.id,
        product_id: i.product.id,
        name:       i.product.name,
        unit_price: i.product.price,
        quantity:   i.qty,
        subtotal:   i.product.price * i.qty,
      }));

      const { error: itemsErr } = await supabase.from('clinic_sale_items').insert(items);
      if (itemsErr) throw itemsErr;

      setLastTotal(total);
      setCart([]);
      setCustomerName('');
      setPatientName('');
      setDiscount('0');
      setNotes('');
      setSuccessModal(true);
      fetchProducts(); // atualiza estoque

    } catch (err) {
      Alert.alert('Erro ao finalizar venda', err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Venda</Text>
        {cart.length > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cart.reduce((s, i) => s + i.qty, 0)}</Text>
          </View>
        )}
      </LinearGradient>

      <View style={styles.body}>
        {/* Coluna produtos */}
        <View style={styles.productsCol}>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar..."
            placeholderTextColor="#94A3B8"
          />
          {loadingProds ? (
            <ActivityIndicator color="#7C3AED" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.productItem} onPress={() => addToCart(item)} activeOpacity={0.75}>
                  <View style={styles.prodDot}>
                    <Text style={styles.prodDotText}>{(item.category || 'O')[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.prodPrice}>R$ {Number(item.price).toFixed(2).replace('.', ',')}</Text>
                  </View>
                  <View style={[styles.stockDot, { backgroundColor: item.stock_qty > 0 ? '#DCFCE7' : '#FEE2E2' }]}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: item.stock_qty > 0 ? '#16A34A' : '#DC2626' }}>
                      {item.stock_qty}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Coluna carrinho / resumo */}
        <ScrollView style={styles.cartCol} showsVerticalScrollIndicator={false}>

          <Text style={styles.sectionLabel}>Carrinho</Text>
          {cart.length === 0 ? (
            <Text style={styles.emptyCart}>Toque em um produto para adicionar</Text>
          ) : (
            cart.map(item => (
              <View key={item.product.id} style={styles.cartItem}>
                <Text style={styles.cartItemName} numberOfLines={1}>{item.product.name}</Text>
                <View style={styles.qtyRow}>
                  <TouchableOpacity onPress={() => updateCartQty(item.product.id, item.qty - 1)} style={styles.qtyBtn}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.qty}</Text>
                  <TouchableOpacity onPress={() => updateCartQty(item.product.id, item.qty + 1)} style={styles.qtyBtn}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                  <Text style={styles.cartItemTotal}>
                    R$ {(item.product.price * item.qty).toFixed(2).replace('.', ',')}
                  </Text>
                </View>
              </View>
            ))
          )}

          <View style={styles.divider} />

          {/* Dados do cliente */}
          <Text style={styles.sectionLabel}>Cliente (opcional)</Text>
          <TextInput style={styles.smallInput} value={customerName} onChangeText={setCustomerName} placeholder="Nome do cliente" placeholderTextColor="#94A3B8" />
          <TextInput style={styles.smallInput} value={patientName}  onChangeText={setPatientName}  placeholder="Nome do pet" placeholderTextColor="#94A3B8" />

          {/* Desconto */}
          <Text style={styles.sectionLabel}>Desconto (R$)</Text>
          <TextInput style={styles.smallInput} value={discount} onChangeText={setDiscount} keyboardType="numeric" placeholder="0,00" placeholderTextColor="#94A3B8" />

          {/* Pagamento */}
          <Text style={styles.sectionLabel}>Pagamento</Text>
          <View style={styles.payRow}>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m.key}
                onPress={() => setPayMethod(m.key)}
                style={[styles.payChip, payMethod === m.key && styles.payChipActive]}
              >
                <Text style={[styles.payChipText, payMethod === m.key && styles.payChipTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Totais */}
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>R$ {subtotal.toFixed(2).replace('.', ',')}</Text>
            </View>
            {discountV > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Desconto</Text>
                <Text style={[styles.totalValue, { color: '#DC2626' }]}>− R$ {discountV.toFixed(2).replace('.', ',')}</Text>
              </View>
            )}
            <View style={[styles.totalRow, { marginTop: 6 }]}>
              <Text style={styles.totalLabelBig}>TOTAL</Text>
              <Text style={styles.totalValueBig}>R$ {total.toFixed(2).replace('.', ',')}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleFinalize} disabled={saving || cart.length === 0} activeOpacity={0.85}>
            <LinearGradient
              colors={cart.length > 0 ? ['#7C3AED', '#A78BFA'] : ['#CBD5E1', '#CBD5E1']}
              style={styles.finalizeBtn}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.finalizeBtnText}>Finalizar venda · R$ {total.toFixed(2).replace('.', ',')}</Text>}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </View>

      {/* Modal de sucesso */}
      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successBox}>
            <Text style={{ fontSize: 56 }}>✅</Text>
            <Text style={styles.successTitle}>Venda finalizada!</Text>
            <Text style={styles.successAmount}>R$ {lastTotal.toFixed(2).replace('.', ',')}</Text>
            <Text style={styles.successSub}>{payMethod.replace('_', ' ')}</Text>
            <TouchableOpacity onPress={() => setSuccessModal(false)}>
              <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.successBtn}>
                <Text style={styles.successBtnText}>Nova venda</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 52 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff', flex: 1 },
  cartBadge: { backgroundColor: '#FBBF24', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, minWidth: 24, alignItems: 'center' },
  cartBadgeText: { fontSize: 12, fontWeight: '900', color: '#1E293B' },

  body: { flex: 1, flexDirection: 'row' },

  productsCol: { width: '42%', borderRightWidth: 1, borderRightColor: '#EDE9FE', padding: 10 },
  search: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6FE',
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: '#1E293B', marginBottom: 8,
  },
  productItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 10, padding: 8, marginBottom: 6,
    borderWidth: 1, borderColor: '#EDE9FE',
  },
  prodDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' },
  prodDotText: { fontSize: 11, fontWeight: '900', color: '#7C3AED' },
  prodName:    { fontSize: 11, fontWeight: '700', color: '#1E293B' },
  prodPrice:   { fontSize: 11, color: '#7C3AED', fontWeight: '800', marginTop: 2 },
  stockDot:    { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 3, minWidth: 24, alignItems: 'center' },

  cartCol: { flex: 1, padding: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.8, marginBottom: 8, marginTop: 12 },
  emptyCart:    { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 8, marginBottom: 8 },
  cartItem:     { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#EDE9FE' },
  cartItemName: { fontSize: 12, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  qtyRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn:       { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText:   { fontSize: 16, fontWeight: '700', color: '#7C3AED' },
  qtyValue:     { fontSize: 13, fontWeight: '800', color: '#1E293B', minWidth: 20, textAlign: 'center' },
  cartItemTotal:{ fontSize: 12, fontWeight: '800', color: '#7C3AED', marginLeft: 'auto' },

  divider: { height: 1, backgroundColor: '#EDE9FE', marginVertical: 8 },
  smallInput: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6FE',
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: '#1E293B', marginBottom: 8,
  },

  payRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  payChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' },
  payChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  payChipText:   { fontSize: 11, fontWeight: '700', color: '#64748B' },
  payChipTextActive: { color: '#fff' },

  totalsBox:     { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EDE9FE' },
  totalRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel:    { fontSize: 12, color: '#64748B' },
  totalValue:    { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  totalLabelBig: { fontSize: 14, fontWeight: '900', color: '#1E293B' },
  totalValueBig: { fontSize: 16, fontWeight: '900', color: '#7C3AED' },

  finalizeBtn:     { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  finalizeBtnText: { fontSize: 13, fontWeight: '900', color: '#fff' },

  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  successBox:     { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', width: '80%', gap: 8 },
  successTitle:   { fontSize: 22, fontWeight: '900', color: '#1E293B' },
  successAmount:  { fontSize: 28, fontWeight: '900', color: '#7C3AED' },
  successSub:     { fontSize: 13, color: '#64748B', textTransform: 'capitalize' },
  successBtn:     { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, marginTop: 8 },
  successBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
