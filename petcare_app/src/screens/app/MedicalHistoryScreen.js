import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

const TYPES = {
  consulta:    { label: 'Consulta',     emoji: '🏥', color: '#3B82F6', bg: '#EFF6FF' },
  cirurgia:    { label: 'Cirurgia',     emoji: '⚕️', color: '#8B5CF6', bg: '#F5F3FF' },
  exame:       { label: 'Exame',        emoji: '🔬', color: '#F59E0B', bg: '#FFFBEB' },
  alergia:     { label: 'Alergia',      emoji: '⚠️', color: '#EF4444', bg: '#FFF1F2' },
  medicamento: { label: 'Medicamento',  emoji: '💊', color: '#EC4899', bg: '#FDF2F8' },
  outro:       { label: 'Outro',        emoji: '📋', color: '#64748B', bg: '#F8FAFC' },
};

function RecordCard({ record, onDelete, isVet }) {
  const type = TYPES[record.type] || TYPES.outro;
  return (
    <View style={[styles.card, { borderLeftColor: type.color }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: type.bg }]}>
          <Text style={styles.typeEmoji}>{type.emoji}</Text>
          <Text style={[styles.typeLabel, { color: type.color }]}>{type.label}</Text>
        </View>
        <Text style={styles.cardDate}>{record.date}</Text>
      </View>

      <Text style={styles.cardTitle}>{record.title}</Text>

      {record.description ? (
        <Text style={styles.cardDesc}>{record.description}</Text>
      ) : null}

      {record.diagnosis ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Diagnóstico:</Text>
          <Text style={styles.infoValue}>{record.diagnosis}</Text>
        </View>
      ) : null}

      {record.prescription ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Prescrição:</Text>
          <Text style={styles.infoValue}>{record.prescription}</Text>
        </View>
      ) : null}

      {record.next_appointment ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Próxima consulta:</Text>
          <Text style={[styles.infoValue, { color: '#0EA5E9' }]}>{record.next_appointment}</Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.cardVet}>
          {record.created_by_role === 'vet' ? '👨‍⚕️ Veterinário' : '👤 Tutor'}
          {record.veterinarian ? ` · ${record.veterinarian}` : ''}
        </Text>
        {!isVet && (
          <TouchableOpacity onPress={() => onDelete(record)}>
            <Text style={styles.deleteLink}>Remover</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function MedicalHistoryScreen({ route, navigation }) {
  const { petId, petName, isVet = false } = route.params;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('todos');

  const fetchData = async () => {
    const { data } = await supabase
      .from('medical_records')
      .select('*')
      .eq('pet_id', petId)
      .order('date', { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleDelete = (record) => {
    Alert.alert('Remover registro', 'Deseja remover este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          await supabase.from('medical_records').delete().eq('id', record.id);
          fetchData();
        },
      },
    ]);
  };

  const filtered = filter === 'todos' ? records : records.filter(r => r.type === filter);

  const filterChips = ['todos', ...Object.keys(TYPES)];

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
    >
      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
        {filterChips.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === 'todos' ? 'Todos' : `${TYPES[f].emoji} ${TYPES[f].label}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Botão adicionar */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddMedicalRecord', { petId, petName, isVet })}
      >
        <Text style={styles.addButtonText}>+ Adicionar registro</Text>
      </TouchableOpacity>

      {/* Lista */}
      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🏥</Text>
          <Text style={styles.emptyTitle}>Nenhum registro{filter !== 'todos' ? ` de ${TYPES[filter]?.label}` : ''}</Text>
          <Text style={styles.emptySub}>Adicione consultas, exames e outras ocorrências médicas</Text>
        </View>
      ) : (
        filtered.map(r => (
          <RecordCard key={r.id} record={r} onDelete={handleDelete} isVet={isVet} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  filtersScroll: { marginBottom: 14, marginHorizontal: -16, paddingHorizontal: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  addButton: {
    backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginBottom: 16,
  },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  typeEmoji: { fontSize: 14 },
  typeLabel: { fontSize: 13, fontWeight: '600' },
  cardDate: { fontSize: 13, color: '#94A3B8' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  cardDesc: { fontSize: 14, color: '#64748B', marginBottom: 8, lineHeight: 20 },
  infoRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  infoLabel: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  infoValue: { fontSize: 13, color: '#1E293B', flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  cardVet: { fontSize: 12, color: '#94A3B8' },
  deleteLink: { fontSize: 13, color: '#EF4444' },

  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});
