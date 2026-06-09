import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, Switch, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

const CATEGORIES = [
  { key: 'todos',     label: 'Todos'       },
  { key: 'consulta',  label: 'Consulta'    },
  { key: 'exame',     label: 'Exame'       },
  { key: 'cirurgia',  label: 'Cirurgia'    },
  { key: 'banho_tosa',label: 'Banho/Tosa'  },
  { key: 'vacina',    label: 'Vacina'      },
  { key: 'outro',     label: 'Outro'       },
];

const CAT_ICONS = {
  consulta:   '🩺',
  exame:      '🔬',
  cirurgia:   '⚕️',
  banho_tosa: '🛁',
  vacina:     '💉',
  outro:      '📋',
};

const EMPTY_FORM = { name: '', category: 'consulta', price: '', duration_min: '', active: true };

export default function ClinicServicesScreen({ navigation, route }) {
  const { clinicId, canEdit } = route.params || {};

  const [services,    setServices]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filterCat,   setFilterCat]   = useState('todos');
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState(null); // null = novo
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);

  const fetchServices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clinic_services')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('category')
      .order('name');
    setServices(data || []);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchServices(); }, [clinicId]));

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (svc) => {
    setEditing(svc);
    setForm({
      name:         svc.name,
      category:     svc.category || 'outro',
      price:        String(svc.price),
      duration_min: svc.duration_min ? String(svc.duration_min) : '',
      active:       svc.active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Campo obrigatório', 'Informe o nome do serviço.'); return; }
    const price = parseFloat(form.price.replace(',', '.'));
    if (isNaN(price) || price < 0) { Alert.alert('Valor inválido', 'Informe um preço válido.'); return; }

    setSaving(true);
    const payload = {
      clinic_id:    clinicId,
      name:         form.name.trim(),
      category:     form.category,
      price,
      duration_min: form.duration_min ? parseInt(form.duration_min) : null,
      active:       form.active,
    };

    const { error } = editing
      ? await supabase.from('clinic_services').update(payload).eq('id', editing.id)
      : await supabase.from('clinic_services').insert(payload);

    setSaving(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setModalOpen(false);
    fetchServices();
  };

  const toggleActive = async (svc) => {
    await supabase.from('clinic_services').update({ active: !svc.active }).eq('id', svc.id);
    setServices(prev => prev.map(s => s.id === svc.id ? { ...s, active: !s.active } : s));
  };

  const handleDelete = (svc) => {
    Alert.alert(
      'Excluir serviço',
      `Remover "${svc.name}" do catálogo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            await supabase.from('clinic_services').delete().eq('id', svc.id);
            fetchServices();
          },
        },
      ]
    );
  };

  const displayed = services.filter(s => filterCat === 'todos' || s.category === filterCat);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Serviços</Text>
          <Text style={styles.headerSub}>Catálogo de serviços e preços</Text>
        </View>
        {canEdit && (
          <TouchableOpacity onPress={openNew} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Novo</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Filtro de categoria */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.key}
            onPress={() => setFilterCat(c.key)}
            style={[styles.filterChip, filterCat === c.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterCat === c.key && styles.filterChipTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></View>
      ) : displayed.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>🩺</Text>
          <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '600' }}>
            {services.length === 0 ? 'Nenhum serviço cadastrado ainda' : 'Nenhum serviço nesta categoria'}
          </Text>
          {canEdit && services.length === 0 && (
            <TouchableOpacity onPress={openNew} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Adicionar primeiro serviço</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {displayed.map(svc => (
            <View key={svc.id} style={[styles.card, !svc.active && styles.cardInactive]}>
              <View style={styles.cardIcon}>
                <Text style={{ fontSize: 22 }}>{CAT_ICONS[svc.category] || '📋'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, !svc.active && { color: '#94A3B8' }]}>{svc.name}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 3 }}>
                  <Text style={styles.cardCat}>
                    {CATEGORIES.find(c => c.key === svc.category)?.label || svc.category}
                  </Text>
                  {svc.duration_min ? (
                    <Text style={styles.cardMeta}>⏱ {svc.duration_min} min</Text>
                  ) : null}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.cardPrice}>
                  R$ {Number(svc.price).toFixed(2).replace('.', ',')}
                </Text>
                {canEdit && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => toggleActive(svc)}>
                      <Text style={{ fontSize: 11, color: svc.active ? '#10B981' : '#94A3B8', fontWeight: '700' }}>
                        {svc.active ? 'Ativo' : 'Inativo'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openEdit(svc)}>
                      <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '700' }}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(svc)}>
                      <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Modal adicionar / editar */}
      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editing ? 'Editar serviço' : 'Novo serviço'}
            </Text>

            <Text style={styles.fieldLabel}>Nome do serviço *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              placeholder="Ex: Consulta clínica"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CATEGORIES.filter(c => c.key !== 'todos').map(c => (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setForm(f => ({ ...f, category: c.key }))}
                    style={[styles.catChip, form.category === c.key && styles.catChipActive]}
                  >
                    <Text style={[styles.catChipText, form.category === c.key && styles.catChipTextActive]}>
                      {CAT_ICONS[c.key]} {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Preço (R$) *</Text>
                <TextInput
                  style={styles.input}
                  value={form.price}
                  onChangeText={v => setForm(f => ({ ...f, price: v }))}
                  placeholder="0,00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Duração (min)</Text>
                <TextInput
                  style={styles.input}
                  value={form.duration_min}
                  onChangeText={v => setForm(f => ({ ...f, duration_min: v }))}
                  placeholder="30"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Serviço ativo</Text>
              <Switch
                value={form.active}
                onValueChange={v => setForm(f => ({ ...f, active: v }))}
                trackColor={{ true: '#7C3AED' }}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
              >
                <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.saveBtnGrad}>
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>Salvar</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, paddingTop: 52,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  addBtn:      { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText:  { color: '#fff', fontWeight: '800', fontSize: 13 },

  filterScroll:  { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: '#EDE9FE' },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: '#DDD6FE' },
  filterChipActive:     { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  filterChipText:       { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  filterChipTextActive: { color: '#fff' },

  list: { padding: 16, gap: 10, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#EDE9FE',
  },
  cardInactive: { opacity: 0.55 },
  cardIcon:     { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F5F3FF', justifyContent: 'center', alignItems: 'center' },
  cardName:     { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  cardCat:      { fontSize: 11, color: '#7C3AED', fontWeight: '600', backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  cardMeta:     { fontSize: 11, color: '#94A3B8' },
  cardPrice:    { fontSize: 15, fontWeight: '900', color: '#7C3AED' },

  emptyBtn:     { marginTop: 16, backgroundColor: '#7C3AED', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 17, fontWeight: '900', color: '#1E293B', marginBottom: 18 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: '#DDD6FE',
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#1E293B', marginBottom: 14,
  },

  catChip:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#DDD6FE' },
  catChipActive:   { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  catChipText:     { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  catChipTextActive: { color: '#fff' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },

  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn:     { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: '#DDD6FE', paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#64748B', fontWeight: '700', fontSize: 14 },
  saveBtn:       { flex: 2, borderRadius: 12, overflow: 'hidden' },
  saveBtnGrad:   { paddingVertical: 14, alignItems: 'center' },
  saveBtnText:   { color: '#fff', fontWeight: '900', fontSize: 14 },
});
