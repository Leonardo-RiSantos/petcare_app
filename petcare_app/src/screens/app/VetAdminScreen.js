import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

const STATUS_CONFIG = {
  pending:  { label: 'Aguardando', color: '#D97706', bg: '#FFFBEB' },
  approved: { label: 'Aprovado',   color: '#16A34A', bg: '#DCFCE7' },
  rejected: { label: 'Recusado',   color: '#DC2626', bg: '#FEE2E2' },
};

export default function VetAdminScreen({ navigation }) {
  const [vets, setVets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [acting, setActing] = useState(null);

  const fetchVets = async () => {
    setLoading(true);
    let q = supabase
      .from('vet_profiles')
      .select('id, full_name, crm, estado, specialty, clinic_name, status, validated_at, created_at')
      .order('created_at', { ascending: false });

    if (filter !== 'all') q = q.eq('status', filter);

    const { data } = await q;
    setVets(data || []);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchVets(); }, [filter]));

  const handleApprove = async (vet) => {
    setActing(vet.id);
    const { error } = await supabase.rpc('approve_vet', { p_vet_id: vet.id });
    setActing(null);
    if (error) { Alert.alert('Erro', error.message); return; }
    fetchVets();
  };

  const handleReject = (vet) => {
    Alert.alert(
      'Recusar veterinário',
      `Tem certeza que deseja recusar o cadastro de ${vet.full_name || 'este veterinário'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Recusar', style: 'destructive',
          onPress: async () => {
            setActing(vet.id);
            const { error } = await supabase.rpc('reject_vet', { p_vet_id: vet.id });
            setActing(null);
            if (error) { Alert.alert('Erro', error.message); return; }
            fetchVets();
          },
        },
      ]
    );
  };

  const pendingCount = filter === 'all' ? vets.filter(v => v.status === 'pending').length : (filter === 'pending' ? vets.length : 0);

  const renderItem = ({ item }) => {
    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const isActing = acting === item.id;
    return (
      <View style={styles.card}>
        {/* Header do card */}
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vetName}>{item.full_name || 'Nome não informado'}</Text>
            <Text style={styles.vetCrm}>CRMV {item.crm}/{item.estado}{item.specialty ? ` · ${item.specialty}` : ''}</Text>
            {item.clinic_name ? <Text style={styles.vetClinic}>{item.clinic_name}</Text> : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusTxt, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>

        {/* Data de cadastro */}
        <Text style={styles.cardDate}>
          Cadastrado em {new Date(item.created_at).toLocaleDateString('pt-BR')}
          {item.validated_at ? ` · Atualizado em ${new Date(item.validated_at).toLocaleDateString('pt-BR')}` : ''}
        </Text>

        {/* Ações (só para pendentes) */}
        {item.status === 'pending' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => handleApprove(item)}
              disabled={isActing}
              activeOpacity={0.82}
            >
              {isActing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.approveTxt}>✓ Aprovar</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => handleReject(item)}
              disabled={isActing}
              activeOpacity={0.82}
            >
              <Text style={styles.rejectTxt}>✕ Recusar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#0284C7', '#0EA5E9']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Aprovação de Veterinários</Text>
          {pendingCount > 0 && (
            <Text style={styles.headerSub}>{pendingCount} cadastro{pendingCount > 1 ? 's' : ''} aguardando</Text>
          )}
        </View>
      </LinearGradient>

      {/* Filtros */}
      <View style={styles.filterRow}>
        {[
          { key: 'pending',  label: 'Pendentes' },
          { key: 'approved', label: 'Aprovados' },
          { key: 'rejected', label: 'Recusados' },
          { key: 'all',      label: 'Todos' },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterTxt, filter === f.key && styles.filterTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      ) : vets.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🩺</Text>
          <Text style={styles.emptyTxt}>Nenhum veterinário {filter === 'pending' ? 'aguardando aprovação' : filter === 'approved' ? 'aprovado' : filter === 'rejected' ? 'recusado' : 'cadastrado'}</Text>
        </View>
      ) : (
        <FlatList
          data={vets}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 52 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0' },
  filterBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#0EA5E9' },
  filterTxt: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterTxtActive: { color: '#0EA5E9', fontWeight: '800' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E0F2FE' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  vetName: { fontSize: 15, fontWeight: '900', color: '#1E293B', marginBottom: 2 },
  vetCrm:  { fontSize: 13, color: '#0EA5E9', fontWeight: '700' },
  vetClinic: { fontSize: 12, color: '#64748B', marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  statusTxt: { fontSize: 11, fontWeight: '800' },
  cardDate: { fontSize: 11, color: '#94A3B8', marginBottom: 12 },

  actions: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  approveTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  rejectBtn:  { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  rejectTxt:  { color: '#DC2626', fontWeight: '800', fontSize: 14 },

  emptyTxt: { fontSize: 15, fontWeight: '700', color: '#94A3B8', textAlign: 'center' },
});
