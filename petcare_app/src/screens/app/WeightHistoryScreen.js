import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import WeightChart from '../../components/WeightChart';

function TrendBadge({ records }) {
  if (records.length < 2) return null;
  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  const first = Number(sorted[0].weight_kg);
  const last = Number(sorted[sorted.length - 1].weight_kg);
  const diff = last - first;
  const pct = ((Math.abs(diff) / first) * 100).toFixed(1);

  if (Math.abs(diff) < 0.05) {
    return <View style={[styles.trendBadge, styles.trendStable]}><Text style={styles.trendText}>→ Estável</Text></View>;
  }
  if (diff > 0) {
    return <View style={[styles.trendBadge, styles.trendUp]}><Text style={styles.trendText}>↑ +{pct}% total</Text></View>;
  }
  return <View style={[styles.trendBadge, styles.trendDown]}><Text style={styles.trendText}>↓ -{pct}% total</Text></View>;
}

function WeightDiff({ current, previous }) {
  if (!previous) return null;
  const diff = Number(current) - Number(previous);
  if (Math.abs(diff) < 0.05) return <Text style={styles.diffStable}>→ estável</Text>;
  const sign = diff > 0 ? '+' : '';
  return (
    <Text style={diff > 0 ? styles.diffUp : styles.diffDown}>
      {sign}{diff.toFixed(2)} kg
    </Text>
  );
}

export default function WeightHistoryScreen({ route, navigation }) {
  const { petId, petName } = route.params;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    const { data } = await supabase
      .from('weight_records')
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
    Alert.alert('Remover registro', 'Deseja remover este registro de peso?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          await supabase.from('weight_records').delete().eq('id', record.id);
          fetchData();
        },
      },
    ]);
  };

  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = sorted[sorted.length - 1];

  const stats = records.length >= 2 ? (() => {
    const weights = sorted.map(r => Number(r.weight_kg));
    return {
      min: Math.min(...weights),
      max: Math.max(...weights),
      avg: (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(2),
    };
  })() : null;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
    >
      {/* Header com peso atual e tendência */}
      <View style={styles.heroCard}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroLabel}>Peso atual</Text>
          <Text style={styles.heroWeight}>
            {latest ? `${Number(latest.weight_kg).toFixed(2)} kg` : '—'}
          </Text>
          <TrendBadge records={records} />
        </View>
        {stats && (
          <View style={styles.heroStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Mínimo</Text>
              <Text style={styles.statValue}>{stats.min} kg</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Máximo</Text>
              <Text style={styles.statValue}>{stats.max} kg</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Média</Text>
              <Text style={styles.statValue}>{stats.avg} kg</Text>
            </View>
          </View>
        )}
      </View>

      {/* Gráfico */}
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Evolução do peso</Text>
        <WeightChart records={sorted} />
      </View>

      {/* Botão adicionar */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddWeight', {
          petId,
          petName,
          currentWeight: latest?.weight_kg,
        })}
      >
        <Text style={styles.addButtonText}>+ Registrar peso</Text>
      </TouchableOpacity>

      {/* Histórico */}
      <Text style={styles.sectionTitle}>Histórico</Text>
      {records.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>⚖️</Text>
          <Text style={styles.emptyText}>Nenhum registro ainda</Text>
          <Text style={styles.emptySubtext}>Registre o peso regularmente para acompanhar a evolução</Text>
        </View>
      ) : (
        records.map((r, i) => {
          const prevRecord = records[i + 1];
          return (
            <TouchableOpacity
              key={r.id}
              style={styles.recordItem}
              onLongPress={() => handleDelete(r)}
              activeOpacity={0.7}
            >
              <View style={styles.recordLeft}>
                <Text style={styles.recordWeight}>{Number(r.weight_kg).toFixed(2)} kg</Text>
                <Text style={styles.recordDate}>{r.date}</Text>
                {r.notes ? <Text style={styles.recordNotes}>{r.notes}</Text> : null}
              </View>
              <WeightDiff current={r.weight_kg} previous={prevRecord?.weight_kg} />
            </TouchableOpacity>
          );
        })
      )}
      {records.length > 0 && (
        <Text style={styles.hint}>Pressione e segure um registro para removê-lo</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  heroCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  heroLeft: { flex: 1 },
  heroLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '500', marginBottom: 4 },
  heroWeight: { fontSize: 36, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  trendBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  trendUp: { backgroundColor: '#FEF9C3' },
  trendDown: { backgroundColor: '#DCFCE7' },
  trendStable: { backgroundColor: '#F1F5F9' },
  trendText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  heroStats: { gap: 12, alignItems: 'flex-end' },
  statItem: { alignItems: 'flex-end' },
  statLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
  statValue: { fontSize: 14, fontWeight: '700', color: '#1E293B' },

  chartCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    overflow: 'hidden',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 8 },

  addButton: {
    backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginBottom: 20,
  },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 12 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#1E293B', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  recordItem: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  recordLeft: { flex: 1 },
  recordWeight: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  recordDate: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  recordNotes: { fontSize: 12, color: '#64748B', marginTop: 4, fontStyle: 'italic' },
  diffUp: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  diffDown: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  diffStable: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  hint: { fontSize: 11, color: '#CBD5E1', textAlign: 'center', marginTop: 8 },
});
