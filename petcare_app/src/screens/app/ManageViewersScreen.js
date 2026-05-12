import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../hooks/usePlan';

const ICON_PROFILE = require('../../../assets/icon_profile.png');
const ICON_TRASH   = require('../../../assets/icon_trash.png');
const ICON_CHECK   = require('../../../assets/icon_check.png');

export default function ManageViewersScreen() {
  const { user } = useAuth();
  const { maxViewers } = usePlan();
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchViewers = async () => {
    const { data } = await supabase
      .from('pet_viewers')
      .select('id, viewer_id, status, created_at, profiles!viewer_id(full_name)')
      .eq('owner_id', user.id)
      .neq('status', 'removed')
      .order('created_at');
    if (data) setViewers(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchViewers(); }, []));

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Digite um e-mail.'); return; }

    const activeCount = viewers.filter(v => v.status === 'active').length;
    const pendingCount = viewers.filter(v => v.status === 'pending').length;
    if (activeCount + pendingCount >= maxViewers) {
      setError(`Limite de ${maxViewers} pessoas atingido. Remova alguém para convidar outro.`);
      return;
    }

    setSearching(true);
    setError('');
    setSuccess('');

    try {
      const { data: found, error: rpcErr } = await supabase
        .rpc('find_user_by_email', { user_email: trimmed });

      if (rpcErr || !found?.length) {
        setError('Usuário não encontrado. A pessoa precisa ter uma conta no PetCare+.');
        return;
      }

      const targetId = found[0].id;
      const targetName = found[0].full_name || trimmed;

      if (targetId === user.id) {
        setError('Você não pode se convidar.'); return;
      }

      const alreadyExists = viewers.find(v => v.viewer_id === targetId);
      if (alreadyExists) {
        setError('Esta pessoa já foi convidada.'); return;
      }

      const { error: insertErr } = await supabase
        .from('pet_viewers')
        .insert({ owner_id: user.id, viewer_id: targetId, status: 'pending' });

      if (insertErr) throw insertErr;

      setSuccess(`Convite enviado para ${targetName}!`);
      setEmail('');
      fetchViewers();
    } catch (e) {
      setError(e.message || 'Erro ao enviar convite.');
    } finally {
      setSearching(false);
    }
  };

  const handleRemove = async (viewerId) => {
    await supabase
      .from('pet_viewers')
      .update({ status: 'removed' })
      .eq('id', viewerId);
    fetchViewers();
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>
  );

  const activeViewers  = viewers.filter(v => v.status === 'active');
  const pendingViewers = viewers.filter(v => v.status === 'pending');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Compartilhar acesso</Text>
        <Text style={styles.infoSub}>
          Pessoas convidadas poderão ver os dados dos seus pets no app, mas{' '}
          <Text style={{ fontWeight: '700', color: '#1E293B' }}>não poderão adicionar, editar ou excluir</Text> nada.
        </Text>
        <View style={styles.slotRow}>
          {Array.from({ length: maxViewers }).map((_, i) => {
            const v = viewers.filter(v => v.status !== 'removed')[i];
            return (
              <View key={i} style={[styles.slot, v && styles.slotFilled]}>
                <Image source={ICON_PROFILE} style={{ width: 20, height: 20, opacity: v ? 1 : 0.3 }} resizeMode="contain" />
                <Text style={[styles.slotText, !v && { color: '#CBD5E1' }]}>
                  {v ? (v.profiles?.full_name || 'Convidado') : 'Vaga livre'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Convidar */}
      <View style={styles.inviteCard}>
        <Text style={styles.inviteLabel}>Convidar por e-mail</Text>
        <Text style={styles.inviteHint}>A pessoa precisa ter uma conta no PetCare+</Text>
        <View style={styles.inviteRow}>
          <TextInput
            style={styles.inviteInput}
            placeholder="email@exemplo.com"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={v => { setEmail(v); setError(''); setSuccess(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.inviteBtn} onPress={handleInvite} disabled={searching}>
            <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.inviteBtnGrad}>
              {searching
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.inviteBtnText}>Convidar</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? (
          <View style={styles.successRow}>
            <Image source={ICON_CHECK} style={{ width: 14, height: 14, marginRight: 6 }} resizeMode="contain" />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}
      </View>

      {/* Ativos */}
      {activeViewers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Com acesso ativo</Text>
          {activeViewers.map(v => (
            <View key={v.id} style={styles.viewerCard}>
              <View style={styles.viewerAvatar}>
                <Image source={ICON_PROFILE} style={{ width: 22, height: 22 }} resizeMode="contain" />
              </View>
              <View style={styles.viewerInfo}>
                <Text style={styles.viewerName}>{v.profiles?.full_name || 'Usuário'}</Text>
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>Ativo</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(v.id)}>
                <Image source={ICON_TRASH} style={{ width: 20, height: 20, tintColor: '#EF4444' }} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Pendentes */}
      {pendingViewers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Convite pendente</Text>
          {pendingViewers.map(v => (
            <View key={v.id} style={[styles.viewerCard, styles.viewerCardPending]}>
              <View style={[styles.viewerAvatar, { backgroundColor: '#FEF9C3' }]}>
                <Image source={ICON_PROFILE} style={{ width: 22, height: 22, opacity: 0.5 }} resizeMode="contain" />
              </View>
              <View style={styles.viewerInfo}>
                <Text style={styles.viewerName}>{v.profiles?.full_name || 'Convidado'}</Text>
                <Text style={styles.pendingText}>Aguardando aceite</Text>
              </View>
              <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(v.id)}>
                <Image source={ICON_TRASH} style={{ width: 20, height: 20, tintColor: '#94A3B8' }} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {viewers.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Nenhuma pessoa convidada ainda</Text>
          <Text style={styles.emptySub}>Use o campo acima para convidar alguém</Text>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  infoCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  infoTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  infoSub: { fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 16 },
  slotRow: { flexDirection: 'row', gap: 10 },
  slot: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed',
  },
  slotFilled: { backgroundColor: '#EFF6FF', borderColor: '#BAE6FD', borderStyle: 'solid' },
  slotText: { fontSize: 12, fontWeight: '600', color: '#0EA5E9', flex: 1 },

  inviteCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  inviteLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 3 },
  inviteHint: { fontSize: 12, color: '#94A3B8', marginBottom: 12 },
  inviteRow: { flexDirection: 'row', gap: 10 },
  inviteInput: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },
  inviteBtn: { borderRadius: 12, overflow: 'hidden' },
  inviteBtnGrad: { paddingHorizontal: 18, paddingVertical: 13, justifyContent: 'center' },
  inviteBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 8 },
  successRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  successText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },

  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 4,
  },
  viewerCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: '#EFF6FF',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  viewerCardPending: { borderColor: '#FEF3C7' },
  viewerAvatar: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  viewerInfo: { flex: 1 },
  viewerName: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  activeText: { fontSize: 11, color: '#10B981', fontWeight: '600' },
  pendingText: { fontSize: 11, color: '#D97706', marginTop: 2, fontWeight: '600' },
  removeBtn: { padding: 8 },

  emptyCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 28, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E0F2FE', borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#94A3B8', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#CBD5E1' },
});
