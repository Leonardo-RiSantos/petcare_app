import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const SPECIES_EMOJI = {
  Cachorro: '🐶', Gato: '🐱', Ave: '🐦',
  Coelho: '🐰', Hamster: '🐹', Réptil: '🦎', Outro: '🐾',
};

export default function VetDashboardScreen({ navigation }) {
  const { user, vetProfile } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);

  const fetchPatients = async () => {
    const { data: links } = await supabase
      .from('pet_vet_links')
      .select('*, pets(*)')
      .eq('vet_id', user.id)
      .eq('status', 'active');

    if (links) {
      const patientsWithHistory = await Promise.all(
        links.map(async (link) => {
          const { data: lastRecord } = await supabase
            .from('medical_records')
            .select('date, title, type')
            .eq('pet_id', link.pet_id)
            .order('date', { ascending: false })
            .limit(1)
            .single();
          return { ...link, lastRecord };
        })
      );
      setPatients(patientsWithHistory);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchPatients(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchPatients(); };

  const handleLinkByCode = async () => {
    if (!code.trim()) { Alert.alert('Atenção', 'Digite o código de convite.'); return; }

    setLinking(true);
    const { data: invite, error } = await supabase
      .from('vet_invite_codes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !invite) {
      Alert.alert('Código inválido', 'Código não encontrado, já utilizado ou expirado.');
      setLinking(false);
      return;
    }

    // Cria vínculo
    const { error: linkError } = await supabase.from('pet_vet_links').upsert({
      pet_id: invite.pet_id,
      vet_id: user.id,
      tutor_id: invite.tutor_id,
      status: 'active',
    }, { onConflict: 'pet_id,vet_id' });

    if (!linkError) {
      // Marca código como usado
      await supabase.from('vet_invite_codes').update({ used: true }).eq('id', invite.id);
      setCode('');
      setShowLinkModal(false);
      Alert.alert('Paciente vinculado!', 'O pet foi adicionado à sua lista de pacientes.');
      fetchPatients();
    } else {
      Alert.alert('Erro', linkError.message);
    }
    setLinking(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#10B981" /></View>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
    >
      {/* Header vet */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Dr(a). {vetProfile?.clinic_name || 'Veterinário'}</Text>
          <Text style={styles.crm}>CRM {vetProfile?.crm}{vetProfile?.specialty ? ` · ${vetProfile.specialty}` : ''}</Text>
        </View>
        <View style={styles.vetBadge}>
          <Text style={styles.vetBadgeText}>👨‍⚕️ Vet</Text>
        </View>
      </View>

      {/* Botão vincular paciente */}
      <TouchableOpacity style={styles.linkButton} onPress={() => setShowLinkModal(true)}>
        <Text style={styles.linkButtonText}>🔗 Vincular novo paciente por código</Text>
      </TouchableOpacity>

      {/* Lista de pacientes */}
      <Text style={styles.sectionTitle}>
        Meus Pacientes ({patients.length})
      </Text>

      {patients.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🐾</Text>
          <Text style={styles.emptyTitle}>Nenhum paciente vinculado</Text>
          <Text style={styles.emptySub}>Peça ao tutor para gerar um código de convite no app e insira aqui</Text>
        </View>
      ) : (
        patients.map(link => {
          const pet = link.pets;
          return (
            <TouchableOpacity
              key={link.id}
              style={styles.patientCard}
              onPress={() => navigation.navigate('VetPatient', { petId: pet.id, petName: pet.name })}
            >
              <View style={styles.patientAvatar}>
                <Text style={{ fontSize: 30 }}>{SPECIES_EMOJI[pet.species] || '🐾'}</Text>
              </View>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{pet.name}</Text>
                <Text style={styles.patientBreed}>
                  {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
                  {pet.weight_kg ? ` · ${pet.weight_kg}kg` : ''}
                </Text>
                {link.lastRecord ? (
                  <Text style={styles.lastVisit}>
                    Última visita: {link.lastRecord.date} · {link.lastRecord.title}
                  </Text>
                ) : (
                  <Text style={styles.lastVisit}>Sem consultas registradas</Text>
                )}
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          );
        })
      )}

      {/* Modal vincular */}
      <Modal visible={showLinkModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Vincular paciente</Text>
            <Text style={styles.modalDesc}>Digite o código gerado pelo tutor no app PetCare+</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="Ex: ABC123"
              placeholderTextColor="#9CA3AF"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity style={styles.linkConfirmBtn} onPress={handleLinkByCode} disabled={linking}>
              {linking ? <ActivityIndicator color="#fff" /> : <Text style={styles.linkConfirmText}>Vincular</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowLinkModal(false); setCode(''); }}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF4' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  crm: { fontSize: 13, color: '#64748B', marginTop: 2 },
  vetBadge: { backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  vetBadgeText: { color: '#16A34A', fontWeight: '700', fontSize: 13 },
  linkButton: {
    backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginBottom: 20,
  },
  linkButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 12 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  patientCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  patientAvatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#ECFDF5',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  patientBreed: { fontSize: 13, color: '#64748B', marginTop: 2 },
  lastVisit: { fontSize: 12, color: '#10B981', marginTop: 4 },
  arrow: { fontSize: 22, color: '#CBD5E1' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  modalDesc: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  codeInput: {
    backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 28, fontWeight: '700', borderWidth: 2, borderColor: '#10B981',
    color: '#1E293B', textAlign: 'center', letterSpacing: 8, marginBottom: 16,
  },
  linkConfirmBtn: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  linkConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: '#64748B', fontSize: 15 },
});
