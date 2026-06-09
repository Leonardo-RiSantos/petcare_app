import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const ROLE_CONFIG = {
  owner:        { label: 'Proprietário', color: '#7C3AED', bg: '#EDE9FE' },
  admin:        { label: 'Administrador', color: '#0284C7', bg: '#E0F2FE' },
  vet:          { label: 'Veterinário',  color: '#16A34A', bg: '#DCFCE7' },
  receptionist: { label: 'Recepcionista', color: '#D97706', bg: '#FEF3C7' },
  seller:       { label: 'Vendedor',     color: '#DC2626', bg: '#FEE2E2' },
};

const STATUS_CONFIG = {
  active:  { label: 'Ativo',    color: '#16A34A' },
  pending: { label: 'Pendente', color: '#D97706' },
  removed: { label: 'Removido', color: '#94A3B8' },
};

export default function ClinicTeamScreen({ navigation, route }) {
  const { clinicId } = route.params;
  const { user } = useAuth();

  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [myRole,  setMyRole]    = useState(null);
  const [modal,   setModal]     = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invRole,  setInvRole]  = useState('vet');
  const [inviting, setInviting] = useState(false);

  const fetchMembers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clinic_members')
      .select(`
        id, role, status, created_at,
        profiles:user_id ( id, full_name, avatar_url )
      `)
      .eq('clinic_id', clinicId)
      .neq('status', 'removed')
      .order('created_at');

    setMembers(data || []);
    const me = (data || []).find(m => m.profiles?.id === user?.id);
    setMyRole(me?.role || null);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchMembers(); }, []));

  const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin';

  const handleInvite = async () => {
    if (!invEmail.trim()) { Alert.alert('Campo obrigatório', 'Informe o email.'); return; }
    setInviting(true);
    try {
      const { data, error } = await supabase.rpc('invite_clinic_member', {
        p_clinic_id: clinicId,
        p_email:     invEmail.trim().toLowerCase(),
        p_role:      invRole,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      Alert.alert('Convite enviado!', `${invEmail} receberá o convite ao abrir o app.`);
      setModal(false);
      setInvEmail('');
      fetchMembers();
    } catch (err) {
      Alert.alert('Erro', err.message || String(err));
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = (member) => {
    if (member.role === 'owner') { Alert.alert('Ação inválida', 'O proprietário não pode ser removido.'); return; }
    Alert.alert(
      'Remover membro',
      `Deseja remover ${member.profiles?.full_name || 'este membro'} da clínica?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: async () => {
            await supabase
              .from('clinic_members')
              .update({ status: 'removed' })
              .eq('id', member.id);
            fetchMembers();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const rc = ROLE_CONFIG[item.role]   || ROLE_CONFIG.vet;
    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
    const name = item.profiles?.full_name || 'Sem nome';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const canRemove = isOwnerOrAdmin && item.profiles?.id !== user?.id && item.role !== 'owner';

    return (
      <View style={styles.card}>
        <View style={[styles.avatar, { backgroundColor: rc.bg }]}>
          <Text style={[styles.avatarText, { color: rc.color }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>{name}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.roleTag, { backgroundColor: rc.bg }]}>
              <Text style={[styles.roleTagText, { color: rc.color }]}>{rc.label}</Text>
            </View>
            <Text style={[styles.statusText, { color: sc.color }]}>· {sc.label}</Text>
          </View>
        </View>
        {canRemove && (
          <TouchableOpacity onPress={() => handleRemove(item)} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Equipe da Clínica</Text>
          <Text style={styles.headerSub}>{members.filter(m => m.status === 'active').length} membros ativos</Text>
        </View>
        {isOwnerOrAdmin && (
          <TouchableOpacity onPress={() => setModal(true)} style={styles.inviteBtn}>
            <Text style={styles.inviteBtnText}>+ Convidar</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>👥</Text>
              <Text style={styles.emptyText}>Nenhum membro ainda</Text>
            </View>
          }
        />
      )}

      {/* Modal de convite */}
      <Modal visible={modal} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Convidar Membro</Text>

            <Text style={styles.label}>Email do usuário</Text>
            <TextInput
              style={styles.input}
              value={invEmail}
              onChangeText={setInvEmail}
              placeholder="email@exemplo.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Cargo</Text>
            <View style={styles.roleGrid}>
              {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'owner').map(([key, cfg]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setInvRole(key)}
                  style={[styles.roleOption, invRole === key && { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                >
                  <Text style={[styles.roleOptionText, invRole === key && { color: cfg.color }]}>{cfg.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => { setModal(false); setInvEmail(''); }} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleInvite} disabled={inviting} style={{ flex: 1 }}>
                <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.confirmBtn}>
                  {inviting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.confirmBtnText}>Enviar convite</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
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
  inviteBtn:   { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  inviteBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#EDE9FE',
  },
  avatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '900' },
  memberName: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  tagRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleTag:    { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  roleTagText:{ fontSize: 11, fontWeight: '700' },
  statusText: { fontSize: 11, color: '#94A3B8' },
  removeBtn:  { padding: 8 },
  removeBtnText: { fontSize: 16, color: '#DC2626', fontWeight: '700' },
  emptyText:  { fontSize: 14, color: '#94A3B8', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginBottom: 20 },
  label:      { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input:      {
    backgroundColor: '#F5F3FF', borderRadius: 12, borderWidth: 1.5, borderColor: '#DDD6FE',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1E293B', marginBottom: 16,
  },
  roleGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  roleOption:  {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF',
  },
  roleOptionText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  modalActions:   { flexDirection: 'row', gap: 12 },
  cancelBtn:  {
    flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
  },
  cancelBtnText:  { fontSize: 14, fontWeight: '700', color: '#64748B' },
  confirmBtn:     { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
