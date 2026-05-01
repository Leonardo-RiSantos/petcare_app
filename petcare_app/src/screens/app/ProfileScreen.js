import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl, Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const ICONS = {
  email:   require('../../../assets/icon_email.png'),
  profile: require('../../../assets/icon_profile.png'),
  fred:    require('../../../assets/icon_fred.png'),
  app:     require('../../../assets/icon_app.png'),
  logout:  require('../../../assets/icon_logout.png'),
};

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ icon, label, value, onPress, danger }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Image source={icon} style={[styles.rowIcon, danger && { tintColor: '#EF4444' }]} resizeMode="contain" />
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
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Deseja sair da sua conta?');
      if (confirmed) signOut();
    } else {
      Alert.alert('Sair', 'Deseja sair da sua conta?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: signOut },
      ]);
    }
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
      {/* Hero com avatar */}
      <LinearGradient
        colors={['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.bubble, { width: 130, height: 130, top: -35, right: -25 }]} />
        <View style={[styles.bubble, { width: 70, height: 70, bottom: -15, left: 35 }]} />

        {/* Avatar */}
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
              placeholderTextColor="rgba(255,255,255,0.6)"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveName} disabled={savingName}>
              {savingName
                ? <ActivityIndicator size="small" color="#0EA5E9" />
                : <Text style={styles.saveBtnText}>Salvar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingName(false)}>
              <Text style={styles.cancelBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingName(true)} style={styles.nameRow}>
            <Text style={styles.name}>{profile.full_name || 'Adicionar nome'}</Text>
            <Image source={ICONS.profile} style={styles.editIcon} resizeMode="contain" />
          </TouchableOpacity>
        )}

        <Text style={styles.email}>{user?.email}</Text>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.statIconWrap}>
            <Text style={styles.statEmoji}>🐾</Text>
          </LinearGradient>
          <Text style={styles.statValue}>{stats.pets}</Text>
          <Text style={styles.statLabel}>Pets</Text>
        </View>
        <View style={styles.statCard}>
          <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.statIconWrap}>
            <Text style={styles.statEmoji}>💉</Text>
          </LinearGradient>
          <Text style={styles.statValue}>{stats.vaccines}</Text>
          <Text style={styles.statLabel}>Vacinas</Text>
        </View>
        <View style={styles.statCard}>
          <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.statIconWrap}>
            <Text style={styles.statEmoji}>💰</Text>
          </LinearGradient>
          <Text style={[styles.statValue, { fontSize: 13 }]}>{formatCurrency(stats.totalExpenses)}</Text>
          <Text style={styles.statLabel}>Total gasto</Text>
        </View>
      </View>

      {/* Seções */}
      <View style={styles.sections}>
        <Section title="Conta">
          <Row icon={ICONS.email}   label="Email" value={user?.email} />
          <Row icon={ICONS.profile} label="Nome"  value={profile.full_name || '—'} onPress={() => setEditingName(true)} />
        </Section>

        <Section title="App">
          <Row icon={ICONS.fred} label="Fred — Assistente IA" value="Ativo" />
          <Row icon={ICONS.app}  label="Versão" value="1.0.0" />
        </Section>

        <Section title="Sessão">
          <Row icon={ICONS.logout} label="Sair da conta" onPress={handleSignOut} danger />
        </Section>
      </View>

      <Text style={styles.footer}>PetCare+ · Feito com 🐾</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    paddingTop: 36, paddingBottom: 32, paddingHorizontal: 24,
    alignItems: 'center', overflow: 'hidden',
  },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' },

  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: { fontSize: 34, fontWeight: '700', color: '#fff' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  name: { fontSize: 22, fontWeight: '700', color: '#fff' },
  editIcon: { width: 20, height: 20, opacity: 0.6 },
  email: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, width: '100%' },
  nameInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16,
    color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  saveBtn: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
  },
  saveBtnText: { color: '#0EA5E9', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  cancelBtnText: { color: '#fff', fontSize: 16 },

  statsRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20,
    marginTop: 20, marginBottom: 24,
  },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 14, alignItems: 'center',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#EFF6FF',
  },
  statIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },

  sections: { paddingHorizontal: 20 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8', marginBottom: 8,
    paddingHorizontal: 4, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#EFF6FF',
  },

  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  rowIcon: { width: 26, height: 26, marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 15, color: '#1E293B' },
  rowDanger: { color: '#EF4444' },
  rowValue: { fontSize: 13, color: '#94A3B8', maxWidth: 160, textAlign: 'right' },
  rowArrow: { fontSize: 20, color: '#BAE6FD', marginLeft: 8 },

  footer: { textAlign: 'center', color: '#BAE6FD', fontSize: 12, marginTop: 12 },
});
