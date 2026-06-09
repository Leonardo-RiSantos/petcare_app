import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

const CATEGORIES = ['Medicamento', 'Ração', 'Acessório', 'Serviço', 'Higiene', 'Outro'];
const UNITS      = ['un', 'kg', 'g', 'ml', 'L', 'cx', 'fr'];

const EMPTY_FORM = {
  name: '', description: '', category: 'Outro', unit: 'un',
  price: '', cost_price: '', stock_qty: '0', stock_min: '0', barcode: '',
};

export default function ClinicProductsScreen({ navigation, route }) {
  const { clinicId, canEdit = true } = route.params || {};

  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null); // produto sendo editado
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clinic_products')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('active', true)
      .order('name');
    setProducts(data || []);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchProducts(); }, []));

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name:       product.name,
      description:product.description || '',
      category:   product.category    || 'Outro',
      unit:       product.unit        || 'un',
      price:      String(product.price),
      cost_price: product.cost_price ? String(product.cost_price) : '',
      stock_qty:  String(product.stock_qty),
      stock_min:  String(product.stock_min || 0),
      barcode:    product.barcode || '',
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Campo obrigatório', 'Informe o nome do produto.'); return; }
    const price = parseFloat(form.price.replace(',', '.'));
    if (isNaN(price) || price < 0) { Alert.alert('Preço inválido', 'Informe um preço válido.'); return; }

    setSaving(true);
    try {
      const payload = {
        clinic_id:   clinicId,
        name:        form.name.trim(),
        description: form.description.trim() || null,
        category:    form.category,
        unit:        form.unit,
        price,
        cost_price:  form.cost_price ? parseFloat(form.cost_price.replace(',','.')) : null,
        stock_qty:   parseFloat(form.stock_qty) || 0,
        stock_min:   parseFloat(form.stock_min) || 0,
        barcode:     form.barcode.trim() || null,
        updated_at:  new Date().toISOString(),
      };

      if (editing) {
        const { error } = await supabase.from('clinic_products').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clinic_products').insert(payload);
        if (error) throw error;
      }

      setModal(false);
      fetchProducts();
    } catch (err) {
      Alert.alert('Erro', err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (product) => {
    Alert.alert(
      'Desativar produto',
      `Deseja desativar "${product.name}"? Ele não aparecerá mais nas vendas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar', style: 'destructive',
          onPress: async () => {
            await supabase.from('clinic_products').update({ active: false }).eq('id', product.id);
            fetchProducts();
          },
        },
      ]
    );
  };

  const stockColor = (qty, min) => {
    if (qty <= 0) return '#DC2626';
    if (min && qty <= min) return '#D97706';
    return '#16A34A';
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => canEdit && openEdit(item)}
      activeOpacity={canEdit ? 0.75 : 1}
    >
      <View style={styles.cardLeft}>
        <View style={styles.categoryDot}>
          <Text style={styles.categoryDotText}>{(item.category || 'O')[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productCategory}>{item.category} · {item.unit}</Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.price}>R$ {Number(item.price).toFixed(2).replace('.', ',')}</Text>
        <Text style={[styles.stock, { color: stockColor(item.stock_qty, item.stock_min) }]}>
          {item.stock_qty} {item.unit}
        </Text>
      </View>
      {canEdit && (
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Produtos & Estoque</Text>
          <Text style={styles.headerSub}>{products.length} produto{products.length !== 1 ? 's' : ''} cadastrado{products.length !== 1 ? 's' : ''}</Text>
        </View>
        {canEdit && (
          <TouchableOpacity onPress={openNew} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Novo</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Busca */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar produto ou categoria..."
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Alerta de estoque baixo */}
      {products.some(p => p.stock_qty <= (p.stock_min || 0) && p.stock_min > 0) && (
        <View style={styles.alertBar}>
          <Text style={styles.alertText}>
            ⚠️ {products.filter(p => p.stock_qty <= (p.stock_min || 0) && p.stock_min > 0).length} produto(s) com estoque baixo
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📦</Text>
              <Text style={styles.emptyText}>
                {search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
              </Text>
            </View>
          }
        />
      )}

      {/* Modal novo/editar produto */}
      <Modal visible={modal} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.modalBox} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{editing ? 'Editar Produto' : 'Novo Produto'}</Text>

            <Text style={styles.fieldLabel}>Nome *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(f => ({...f, name: v}))} placeholder="Nome do produto" placeholderTextColor="#94A3B8" />

            <Text style={styles.fieldLabel}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c} onPress={() => setForm(f => ({...f, category: c}))}
                    style={[styles.chip, form.category === c && styles.chipActive]}>
                    <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Preço de venda *</Text>
                <TextInput style={styles.input} value={form.price} onChangeText={v => setForm(f => ({...f, price: v}))} placeholder="0,00" placeholderTextColor="#94A3B8" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Preço de custo</Text>
                <TextInput style={styles.input} value={form.cost_price} onChangeText={v => setForm(f => ({...f, cost_price: v}))} placeholder="0,00" placeholderTextColor="#94A3B8" keyboardType="numeric" />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Estoque atual</Text>
                <TextInput style={styles.input} value={form.stock_qty} onChangeText={v => setForm(f => ({...f, stock_qty: v}))} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Estoque mínimo</Text>
                <TextInput style={styles.input} value={form.stock_min} onChangeText={v => setForm(f => ({...f, stock_min: v}))} keyboardType="numeric" />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Unidade</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {UNITS.map(u => (
                  <TouchableOpacity key={u} onPress={() => setForm(f => ({...f, unit: u}))}
                    style={[styles.chip, form.unit === u && styles.chipActive]}>
                    <Text style={[styles.chipText, form.unit === u && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Código de barras</Text>
            <TextInput style={styles.input} value={form.barcode} onChangeText={v => setForm(f => ({...f, barcode: v}))} placeholder="Opcional" placeholderTextColor="#94A3B8" keyboardType="numeric" />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flex: 1 }}>
                <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.saveModalBtn}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveModalBtnText}>Salvar</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 52 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  addBtn:      { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText:  { color: '#fff', fontSize: 13, fontWeight: '800' },

  searchWrap:  { margin: 16, marginBottom: 8 },
  searchInput: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#DDD6FE',
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#1E293B',
  },

  alertBar:  { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FDE68A' },
  alertText: { fontSize: 12, fontWeight: '700', color: '#92400E' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#EDE9FE',
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardRight: { alignItems: 'flex-end' },
  categoryDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center',
  },
  categoryDotText: { fontSize: 14, fontWeight: '900', color: '#7C3AED' },
  productName:     { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  productCategory: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  price:           { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  stock:           { fontSize: 11, fontWeight: '700', marginTop: 2 },
  deleteBtn:       { padding: 8 },
  deleteBtnText:   { fontSize: 14, color: '#DC2626', fontWeight: '700' },
  emptyText:       { fontSize: 14, color: '#94A3B8', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:     {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '90%',
  },
  modalTitle:   { fontSize: 18, fontWeight: '900', color: '#1E293B', marginBottom: 20 },
  fieldLabel:   { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input:        {
    backgroundColor: '#F5F3FF', borderRadius: 12, borderWidth: 1.5, borderColor: '#DDD6FE',
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#1E293B', marginBottom: 14,
  },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' },
  chipActive:   { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText:     { fontSize: 12, fontWeight: '700', color: '#64748B' },
  chipTextActive: { color: '#fff' },
  cancelBtn:    { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtnText:{ fontSize: 14, fontWeight: '700', color: '#64748B' },
  saveModalBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveModalBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
