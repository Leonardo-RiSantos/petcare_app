import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ScrollView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = [
  { key: 'all',       label: 'Todos' },
  { key: 'consulta',  label: 'Consulta' },
  { key: 'exame',     label: 'Exame' },
  { key: 'vacina',    label: 'Vacina' },
  { key: 'cirurgia',  label: 'Cirurgia' },
  { key: 'banho_tosa',label: 'Banho & Tosa' },
  { key: 'outro',     label: 'Outro' },
];

const PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Débito', 'Crédito', 'Convênio'];

export default function ClinicOrderScreen({ navigation, route }) {
  const { clinicId } = route.params || {};
  const { user } = useAuth();

  const [petName,    setPetName]    = useState('');
  const [ownerName,  setOwnerName]  = useState('');
  const [notes,      setNotes]      = useState('');
  const [items,      setItems]      = useState([]);
  const [services,   setServices]   = useState([]);
  const [products,   setProducts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [activeTab,  setActiveTab]  = useState('services');
  const [catFilter,  setCatFilter]  = useState('all');
  const [prodSearch, setProdSearch] = useState('');

  // Manual item
  const [manualName,  setManualName]  = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualQty,   setManualQty]   = useState('1');

  // PetCare pet search
  const [petSearch,    setPetSearch]    = useState('');
  const [linkedPet,    setLinkedPet]    = useState(null);
  const [petResults,   setPetResults]   = useState([]);
  const [searchingPet, setSearchingPet] = useState(false);
  const [showPetModal, setShowPetModal] = useState(false);

  useEffect(() => { loadCatalog(); }, []);

  const loadCatalog = async () => {
    setLoading(true);
    const [svcRes, prodRes] = await Promise.all([
      supabase.from('clinic_services').select('*').eq('clinic_id', clinicId).eq('active', true).order('name'),
      supabase.from('clinic_products').select('id, name, category, price, stock_qty, unit').eq('clinic_id', clinicId).eq('active', true).order('name'),
    ]);
    setServices(svcRes.data || []);
    setProducts(prodRes.data || []);
    setLoading(false);
  };

  const addItem = (type, item) => {
    const key = `${type}::${item.id}`;
    const existing = items.find(i => i.key === key);
    if (existing) {
      setItems(prev => prev.map(i =>
        i.key === key ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unit_price } : i
      ));
    } else {
      setItems(prev => [...prev, {
        key,
        item_type:  type,
        product_id: type === 'product' ? item.id : null,
        service_id: type === 'service' ? item.id : null,
        name:       item.name,
        unit_price: Number(item.price),
        quantity:   1,
        subtotal:   Number(item.price),
      }]);
    }
  };

  const adjustQty = (key, delta) => {
    setItems(prev => prev.map(i => {
      if (i.key !== key) return i;
      const newQty = Math.max(0, i.quantity + delta);
      return newQty === 0 ? null : { ...i, quantity: newQty, subtotal: newQty * i.unit_price };
    }).filter(Boolean));
  };

  const addManualItem = () => {
    const price = parseFloat(manualPrice.replace(',', '.'));
    const qty   = parseFloat(manualQty.replace(',', '.')) || 1;
    if (!manualName.trim() || isNaN(price) || price <= 0) {
      Alert.alert('Atenção', 'Preencha o nome e o preço do item.');
      return;
    }
    const key = `manual::${Date.now()}`;
    setItems(prev => [...prev, {
      key, item_type: 'manual', product_id: null, service_id: null,
      name: manualName.trim(), unit_price: price, quantity: qty, subtotal: price * qty,
    }]);
    setManualName(''); setManualPrice(''); setManualQty('1');
  };

  const searchPetCare = async () => {
    if (!petSearch.trim()) return;
    setSearchingPet(true);
    const { data } = await supabase
      .from('pets')
      .select('id, name, species, breed, profiles!user_id(full_name)')
      .ilike('name', `%${petSearch.trim()}%`)
      .limit(10);
    setPetResults(data || []);
    setSearchingPet(false);
  };

  const total = items.reduce((s, i) => s + i.subtotal, 0);

  const handleSubmit = async () => {
    if (!petName.trim()) { Alert.alert('Atenção', 'Informe o nome do pet.'); return; }
    if (items.length === 0) { Alert.alert('Atenção', 'Adicione pelo menos um item ao atendimento.'); return; }
    setSaving(true);
    try {
      const { data: order, error: oErr } = await supabase
        .from('clinic_service_orders')
        .insert({
          clinic_id:  clinicId,
          vet_id:     user.id,
          pet_name:   petName.trim(),
          owner_name: ownerName.trim() || null,
          pet_id:     linkedPet?.id || null,
          notes:      notes.trim()   || null,
          total,
        })
        .select('id').single();
      if (oErr) throw oErr;

      const { error: iErr } = await supabase
        .from('clinic_service_order_items')
        .insert(items.map(i => ({
          order_id:   order.id,
          item_type:  i.item_type,
          product_id: i.product_id,
          service_id: i.service_id,
          name:       i.name,
          unit_price: i.unit_price,
          quantity:   i.quantity,
          subtotal:   i.subtotal,
        })));
      if (iErr) throw iErr;

      Alert.alert(
        '✅ Atendimento enviado!',
        `R$ ${total.toFixed(2).replace('.', ',')} · A recepção receberá para fechar o pagamento.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Erro', err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredServices = services.filter(s =>
    catFilter === 'all' || s.category === catFilter
  );
  const filteredProducts = products.filter(p =>
    !prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase())
  );

  const fmt = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Novo Atendimento</Text>
          <Text style={styles.headerSub}>Vet → Recepção</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{fmt(total)}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Dados do paciente */}
        <Text style={styles.sectionLabel}>PACIENTE</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Nome do pet *"
            placeholderTextColor="#9CA3AF"
            value={petName}
            onChangeText={setPetName}
          />
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            placeholder="Nome do tutor/responsável"
            placeholderTextColor="#9CA3AF"
            value={ownerName}
            onChangeText={setOwnerName}
          />

          {/* Vincular pet PetCare */}
          {linkedPet ? (
            <View style={styles.linkedPetRow}>
              <Text style={styles.linkedPetText}>🐾 Vinculado: {linkedPet.name}</Text>
              <TouchableOpacity onPress={() => { setLinkedPet(null); }} style={{ padding: 4 }}>
                <Text style={{ color: '#EF4444', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.linkPetBtn}
              onPress={() => setShowPetModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.linkPetBtnText}>🔍 Vincular histórico PetCare</Text>
            </TouchableOpacity>
          )}
        </View>

        <TextInput
          style={[styles.input, { marginHorizontal: 0, marginBottom: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#EDE9FE', paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 }]}
          placeholder="Observações clínicas (opcional)"
          placeholderTextColor="#9CA3AF"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
        />

        {/* Tabs de seleção */}
        <View style={styles.tabRow}>
          {[['services','🩺 Serviços'],['products','💊 Produtos'],['manual','✏️ Manual']].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, activeTab === key && styles.tabActive]}
              onPress={() => setActiveTab(key)}
            >
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Serviços */}
        {activeTab === 'services' && (
          <View style={styles.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.catChip, catFilter === c.key && styles.catChipActive]}
                    onPress={() => setCatFilter(c.key)}
                  >
                    <Text style={[styles.catChipText, catFilter === c.key && styles.catChipTextActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {filteredServices.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>Nenhum serviço cadastrado nessa categoria</Text>
                <Text style={styles.emptyHint}>Adicione em Estoque → Serviços</Text>
              </View>
            ) : (
              filteredServices.map(s => (
                <TouchableOpacity key={s.id} style={styles.catalogRow} onPress={() => addItem('service', s)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catalogName}>{s.name}</Text>
                    {s.category && <Text style={styles.catalogSub}>{s.category.replace('_', ' & ')}</Text>}
                  </View>
                  <Text style={styles.catalogPrice}>{fmt(s.price)}</Text>
                  <View style={styles.addBtn}><Text style={styles.addBtnText}>+</Text></View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Produtos */}
        {activeTab === 'products' && (
          <View style={styles.card}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar produto..."
              placeholderTextColor="#9CA3AF"
              value={prodSearch}
              onChangeText={setProdSearch}
            />
            {filteredProducts.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>Nenhum produto encontrado</Text>
              </View>
            ) : (
              filteredProducts.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.catalogRow, p.stock_qty <= 0 && { opacity: 0.45 }]}
                  onPress={() => {
                    if (p.stock_qty <= 0) { Alert.alert('Sem estoque', `${p.name} está sem estoque.`); return; }
                    addItem('product', p);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catalogName}>{p.name}</Text>
                    <Text style={styles.catalogSub}>
                      Estoque: {p.stock_qty} {p.unit}
                    </Text>
                  </View>
                  <Text style={styles.catalogPrice}>{fmt(p.price)}</Text>
                  <View style={[styles.addBtn, p.stock_qty <= 0 && { backgroundColor: '#F1F5F9' }]}>
                    <Text style={[styles.addBtnText, p.stock_qty <= 0 && { color: '#94A3B8' }]}>+</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Manual */}
        {activeTab === 'manual' && (
          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="Descrição do item *"
              placeholderTextColor="#9CA3AF"
              value={manualName}
              onChangeText={setManualName}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Preço (R$) *"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={manualPrice}
                onChangeText={setManualPrice}
              />
              <TextInput
                style={[styles.input, { width: 80 }]}
                placeholder="Qtd"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={manualQty}
                onChangeText={setManualQty}
              />
            </View>
            <TouchableOpacity style={styles.manualAddBtn} onPress={addManualItem} activeOpacity={0.8}>
              <Text style={styles.manualAddBtnText}>Adicionar item</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Itens adicionados */}
        {items.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ITENS DO ATENDIMENTO</Text>
            <View style={styles.card}>
              {items.map((item) => (
                <View key={item.key} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemSub}>{fmt(item.unit_price)} × {item.quantity}</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity onPress={() => adjustQty(item.key, -1)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                    <TouchableOpacity onPress={() => adjustQty(item.key, 1)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemSubtotal}>{fmt(item.subtotal)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{fmt(total)}</Text>
              </View>
            </View>
          </>
        )}

        {/* Botão enviar */}
        <TouchableOpacity
          style={[styles.submitBtn, (saving || items.length === 0) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={saving || items.length === 0}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.submitGradient}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitText}>Enviar para Recepção →</Text>}
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>

      {/* Modal busca pet PetCare */}
      <Modal visible={showPetModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Buscar pet PetCare</Text>
            <TouchableOpacity onPress={() => setShowPetModal(false)}>
              <Text style={{ fontSize: 18, color: '#7C3AED', fontWeight: '700' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modalHint}>
            Busque pelo nome do pet para vincular o histórico PetCare ao atendimento.
          </Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.searchInput, { flex: 1 }]}
              placeholder="Nome do pet..."
              placeholderTextColor="#9CA3AF"
              value={petSearch}
              onChangeText={setPetSearch}
              returnKeyType="search"
              onSubmitEditing={searchPetCare}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={searchPetCare} disabled={searchingPet}>
              {searchingPet ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Buscar</Text>}
            </TouchableOpacity>
          </View>
          <FlatList
            data={petResults}
            keyExtractor={i => i.id}
            ListEmptyComponent={petSearch.length > 0 && !searchingPet ? (
              <Text style={styles.emptyText}>Nenhum pet encontrado</Text>
            ) : null}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.petResultRow}
                onPress={() => { setLinkedPet(item); setShowPetModal(false); setPetName(prev => prev || item.name); }}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.petResultName}>{item.name}</Text>
                  <Text style={styles.petResultSub}>
                    {item.species || ''}{item.breed ? ` · ${item.breed}` : ''} · Tutor: {item.profiles?.full_name || '—'}
                  </Text>
                </View>
                <Text style={{ color: '#7C3AED', fontWeight: '800' }}>Vincular →</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 52 },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  totalBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  totalBadgeText: { color: '#fff', fontWeight: '900', fontSize: 15 },

  content: { padding: 16, paddingBottom: 48 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#7C3AED', letterSpacing: 1, marginBottom: 8, marginTop: 16 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EDE9FE' },

  input: {
    backgroundColor: '#F8F6FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, borderWidth: 1.5, borderColor: '#EDE9FE', color: '#1E293B',
  },

  linkedPetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EDE9FE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10,
  },
  linkedPetText: { fontSize: 13, fontWeight: '700', color: '#6D28D9' },
  linkPetBtn: {
    marginTop: 10, borderWidth: 1.5, borderColor: '#DDD6FE', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', borderStyle: 'dashed',
  },
  linkPetBtnText: { color: '#7C3AED', fontWeight: '700', fontSize: 13 },

  tabRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  tab:     { flex: 1, backgroundColor: '#F5F3FF', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: '#EDE9FE' },
  tabActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  tabText:   { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  tabTextActive: { color: '#fff' },

  catChip:     { backgroundColor: '#F5F3FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: '#EDE9FE' },
  catChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  catChipText:   { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  catChipTextActive: { color: '#fff' },

  searchInput: {
    backgroundColor: '#F8F6FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, borderWidth: 1.5, borderColor: '#EDE9FE', color: '#1E293B', marginBottom: 10,
  },

  catalogRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F8F6FF', gap: 8,
  },
  catalogName:  { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  catalogSub:   { fontSize: 11, color: '#94A3B8', marginTop: 1, textTransform: 'capitalize' },
  catalogPrice: { fontSize: 13, fontWeight: '800', color: '#7C3AED', marginRight: 8 },
  addBtn:       { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' },
  addBtnText:   { fontSize: 18, fontWeight: '700', color: '#7C3AED', lineHeight: 22 },

  emptyRow:  { paddingVertical: 16, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  emptyHint: { fontSize: 11, color: '#BAC0CA', marginTop: 4 },

  manualAddBtn: { marginTop: 12, backgroundColor: '#EDE9FE', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  manualAddBtnText: { color: '#7C3AED', fontWeight: '800', fontSize: 14 },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F8F6FF' },
  itemName:    { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  itemSub:     { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  itemSubtotal:{ fontSize: 13, fontWeight: '900', color: '#7C3AED', minWidth: 70, textAlign: 'right' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn:      { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText:  { fontSize: 16, fontWeight: '700', color: '#7C3AED', lineHeight: 20 },
  qtyValue:    { fontSize: 14, fontWeight: '800', color: '#1E293B', minWidth: 20, textAlign: 'center' },

  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  totalValue: { fontSize: 20, fontWeight: '900', color: '#7C3AED' },

  submitBtn: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitText: { fontSize: 16, fontWeight: '900', color: '#fff' },

  modal:       { flex: 1, backgroundColor: '#F5F3FF', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingTop: 16 },
  modalTitle:  { fontSize: 18, fontWeight: '900', color: '#1E293B' },
  modalHint:   { fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 18 },

  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  searchBtn: { backgroundColor: '#7C3AED', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },

  petResultRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EDE9FE',
  },
  petResultName: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  petResultSub:  { fontSize: 11, color: '#94A3B8', marginTop: 2, textTransform: 'capitalize' },
});
