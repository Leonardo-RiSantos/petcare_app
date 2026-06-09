import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function ClinicVetListScreen({ navigation }) {
  const { user, vetProfile } = useAuth();
  const clinicId = vetProfile?.clinic_id;

  const [vets,    setVets]    = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clinic_members')
      .select('user_id, role, status, vet_profiles!user_id(id, full_name, specialty, clinic_name)')
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
      .in('role', ['vet', 'owner', 'admin']);
    setVets(data || []);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchVets(); }, [clinicId]));

  const handleVetPress = (vet) => {
    const isMe = vet.user_id === user?.id;

    if (isMe) {
      Alert.alert(
        'Acessar painel',
        `Acessando como ${vet.vet_profiles?.full_name || 'Veterinário'}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: () => navigation.navigate('VetDashboard', { vetId: vet.user_id }) },
        ]
      );
    } else {
      navigation.navigate('ClinicVetSchedule', { vetId: vet.user_id, vetName: vet.vet_profiles?.full_name, clinicId });
    }
  };

  const roleLabel = (role) => {
    if (role === 'owner')  return 'Proprietário';
    if (role === 'admin')  return 'Admin';
    return 'Veterinário';
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Veterinários</Text>
          <Text style={styles.headerSub}>Equipe clínica</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('ClinicTeam', { clinicId })}
        >
          <Text style={styles.addBtnText}>Gerenciar</Text>
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : vets.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>👥</Text>
          <Text style={styles.emptyText}>Nenhum veterinário na equipe ainda.</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('ClinicTeam', { clinicId })}
          >
            <Text style={styles.emptyBtnText}>Convidar veterinário</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {vets.map(vet => {
            const isMe = vet.user_id === user?.id;
            const vp = vet.vet_profiles;
            return (
              <TouchableOpacity
                key={vet.user_id}
                style={[styles.card, isMe && styles.cardMe]}
                onPress={() => handleVetPress(vet)}
                activeOpacity={0.8}
              >
                <View style={[styles.avatar, isMe && styles.avatarMe]}>
                  <Text style={styles.avatarText}>
                    {(vp?.full_name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.vetName}>{vp?.full_name || 'Veterinário'}</Text>
                    {isMe && (
                      <View style={styles.meBadge}>
                        <Text style={styles.meBadgeText}>Você</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.vetSpecialty}>
                    {vp?.specialty || 'Clínica Geral'} · {roleLabel(vet.role)}
                  </Text>
                </View>
                <View style={styles.accessBtn}>
                  <Text style={styles.accessBtnText}>
                    {isMe ? 'Meu painel' : 'Agenda'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              💡 Toque no seu nome para acessar seus pacientes. Toque em outro veterinário para ver a agenda dele.
            </Text>
          </View>
        </ScrollView>
      )}
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

  list: { padding: 16, gap: 12, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#EDE9FE',
  },
  cardMe: { borderColor: '#7C3AED', backgroundColor: '#FAFAF9' },

  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center',
  },
  avatarMe:   { backgroundColor: '#7C3AED' },
  avatarText: { fontSize: 20, fontWeight: '900', color: '#7C3AED' },

  vetName:      { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  vetSpecialty: { fontSize: 12, color: '#64748B', marginTop: 2 },

  meBadge:     { backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  meBadgeText: { fontSize: 10, fontWeight: '800', color: '#7C3AED' },

  accessBtn:     { backgroundColor: '#F5F3FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#DDD6FE' },
  accessBtnText: { fontSize: 11, fontWeight: '800', color: '#7C3AED' },

  emptyText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  emptyBtn:  { marginTop: 12, backgroundColor: '#7C3AED', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  noteBox: {
    backgroundColor: '#EDE9FE', borderRadius: 12, padding: 14, marginTop: 8,
  },
  noteText: { fontSize: 12, color: '#6D28D9', lineHeight: 18 },
});
