import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

function StatCard({ emoji, label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ emoji, label, value, onPress, danger }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <Text style={[styles.rowLabel, danger && styles.rowDanger]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Text style={styles.rowArrow}>›</Text> : null}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState({ full_name: '' });
  const [stats, setStats] = useState({ pets: 0, vaccines: 0, totalExpenses: 0 });
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    const [profileRes, petsRes, vaccinesRes, expensesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('pets').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('vaccines').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('expenses').select('amount').eq('user_id', user.id),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data);
      setNameInput(profileRes.data.full_name || '');
    }

    const total = (expensesRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
    setStats({
      pets: petsRes.count ?? 0,
      vaccines: vaccinesRes.count ?? 0,
      totalExpenses: total,
    });

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const saveName = async () => {
    if (!nameInput.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: nameInput.trim(),
    });
    setSavingName(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      setProfile(prev => ({ ...prev, full_name: nameInput.trim() }));
      setEditingName(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  };

  const initials = (profile.full_name || user?.email || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const formatCurrency = (v) =>
    `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Seu nome"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveName} disabled={savingName}>
              {savingName
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>Salvar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingName(false)}>
              <Text style={styles.cancelBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingName(true)} style={styles.nameRow}>
            <Text style={styles.name}>
              {profile.full_name || 'Adicionar nome'}
            </Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard emoji="🐾" label="Pets" value={stats.pets} />
        <StatCard emoji="💉" label="Vacinas" value={stats.vaccines} />
        <StatCard emoji="💰" label="Total gasto" value={formatCurrency(stats.totalExpenses)} />
      </View>

      {/* Conta */}
      <Section title="Conta">
        <Row emoji="📧" label="Email" value={user?.email} />
        <Row
          emoji="👤"
          label="Nome"
          value={profile.full_name || '—'}
          onPress={() => setEditingName(true)}
        />
      </Section>

      {/* App */}
      <Section title="App">
        <Row emoji="🐱" label="Fred — Assistente IA" value="Ativo" />
        <Row emoji="📱" label="Versão" value="1.0.0" />
      </Section>

      {/* Sair */}
      <Section title="Sessão">
        <Row emoji="🚪" label="Sair da conta" onPress={handleSignOut} danger />
      </Section>

      <Text style={styles.footer}>PetCare+ · Feito com 🐾</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#0EA5E9',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
  editIcon: { fontSize: 16 },
  email: { fontSize: 14, color: '#94A3B8' },

  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  nameInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: '#BAE6FD', color: '#1E293B',
  },
  saveBtn: {
    backgroundColor: '#0EA5E9', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  cancelBtnText: { color: '#64748B', fontSize: 16 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statEmoji: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginBottom: 8, paddingHorizontal: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, overflow: 'hidden',
  },

  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  rowEmoji: { fontSize: 20, marginRight: 12, width: 28, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: 15, color: '#1E293B' },
  rowDanger: { color: '#EF4444' },
  rowValue: { fontSize: 14, color: '#94A3B8', maxWidth: 160, textAlign: 'right' },
  rowArrow: { fontSize: 20, color: '#CBD5E1', marginLeft: 8 },

  footer: { textAlign: 'center', color: '#CBD5E1', fontSize: 12, marginTop: 12 },
});
