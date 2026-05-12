import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Image, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../utils/logger';

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
  Peixe:    require('../../../assets/pet_peixe.png'),
};

export default function VetAddPatientScreen({ navigation }) {
  const { user } = useAuth();
  const [petId, setPetId] = useState('');
  const [searching, setSearching] = useState(false);
  const [petFound, setPetFound] = useState(null);
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [erro, setErro] = useState('');

  const handleSearch = async () => {
    const id = petId.trim();
    if (!id) { setErro('Cole ou digite o ID do pet.'); return; }
    setErro('');
    setPetFound(null);
    setSearching(true);

    try {
      let pet = null;

      // Usa RPC com SECURITY DEFINER — contorna RLS para busca inicial
      const { data: rpcResult, error: rpcErr } = await supabase
        .rpc('find_pet_by_code', { short_code: id.toLowerCase() });

      if (rpcErr) {
        logger.error('[find_pet_by_code]', rpcErr);
        // Fallback: tenta busca direta (funciona se RLS permitir)
        const { data } = await supabase
          .from('pets')
          .select('id, name, species, breed, weight_kg, photo_url')
          .eq('id', id)
          .maybeSingle();
        pet = data;
      } else {
        pet = rpcResult?.[0] ?? null;
      }

      if (!pet) {
        setErro('Pet não encontrado. Verifique o código e tente novamente.');
      } else {
        // Verifica se já está vinculado
        const { data: existing } = await supabase
          .from('pet_vet_links')
          .select('id, status')
          .eq('pet_id', pet.id)
          .eq('vet_id', user.id)
          .maybeSingle();

        if (existing?.status === 'active') {
          setErro('Você já tem acesso a este paciente.');
        } else {
          setPetFound(pet);
        }
      }
    } catch (e) {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async () => {
    if (!petFound) return;
    setLinking(true);
    try {
      // tutor_id já vem no petFound via RPC (evita query separada bloqueada por RLS)
      const tutorId = petFound.tutor_id;
      if (!tutorId) throw new Error('Não foi possível identificar o tutor. Tente novamente.');

      const { error } = await supabase.from('pet_vet_links').upsert({
        pet_id:   petFound.id,
        vet_id:   user.id,
        tutor_id: tutorId,
        status:   'active',
      }, { onConflict: 'pet_id,vet_id' });

      if (error) throw error;

      // Mostra tela de sucesso inline (Alert.alert não funciona bem na web)
      setLinked(true);
    } catch (e) {
      setErro(e?.message || 'Erro ao vincular paciente.');
    } finally {
      setLinking(false);
    }
  };

  // Tela de sucesso
  if (linked && petFound) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={styles.successCard}>
          {petFound.photo_url ? (
            <Image source={{ uri: petFound.photo_url }} style={styles.successPhoto} />
          ) : (
            <LinearGradient colors={['#DBEAFE', '#EFF6FF']} style={styles.successAvatar}>
              {SPECIES_IMAGES[petFound.species]
                ? <Image source={SPECIES_IMAGES[petFound.species]} style={{ width: 44, height: 44 }} resizeMode="contain" />
                : <Text style={{ fontSize: 40 }}>🐾</Text>}
            </LinearGradient>
          )}
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successTitle}>Paciente adicionado!</Text>
          <Text style={styles.successSub}>
            <Text style={styles.successPetName}>{petFound.name}</Text>
            {' '}foi vinculado com sucesso à sua lista de pacientes.
          </Text>
          <TouchableOpacity style={styles.successBtnWrap} onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={['#0EA5E9', '#38BDF8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.successBtn}
            >
              <Text style={styles.successBtnText}>Ver meus pacientes →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Instrução */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Como funciona?</Text>
        {[
          { icon: '1️⃣', text: 'Peça ao tutor para abrir o app e acessar o perfil do pet' },
          { icon: '2️⃣', text: 'O tutor compartilha o ID do pet com você' },
          { icon: '3️⃣', text: 'Cole o ID abaixo e clique em Buscar' },
        ].map((item, i) => (
          <View key={i} style={styles.infoRow}>
            <Text style={styles.infoIcon}>{item.icon}</Text>
            <Text style={styles.infoText}>{item.text}</Text>
          </View>
        ))}
      </View>

      {/* Campo ID */}
      <Text style={styles.label}>Código do Pet</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: BE185BB5 (código de 8 letras)"
        placeholderTextColor="#9CA3AF"
        value={petId}
        onChangeText={v => { setPetId(v.trim()); setErro(''); setPetFound(null); }}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={36}
      />

      {erro ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠ {erro}</Text>
        </View>
      ) : null}

      {/* Botão buscar */}
      <TouchableOpacity style={styles.searchBtnWrap} onPress={handleSearch} disabled={searching}>
        <LinearGradient
          colors={['#0EA5E9', '#38BDF8']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.searchBtn}
        >
          {searching
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.searchBtnText}>Buscar Pet</Text>}
        </LinearGradient>
      </TouchableOpacity>

      {/* Preview do pet encontrado */}
      {petFound && (
        <View style={styles.petCard}>
          <View style={styles.petCardHeader}>
            <Text style={styles.petCardFoundLabel}>Pet encontrado!</Text>
          </View>

          <View style={styles.petCardBody}>
            {petFound.photo_url ? (
              <Image source={{ uri: petFound.photo_url }} style={styles.petPhoto} />
            ) : (
              <LinearGradient colors={['#DBEAFE', '#EFF6FF']} style={styles.petAvatar}>
                {SPECIES_IMAGES[petFound.species]
                  ? <Image source={SPECIES_IMAGES[petFound.species]} style={{ width: 36, height: 36 }} resizeMode="contain" />
                  : <Text style={{ fontSize: 32 }}>🐾</Text>}
              </LinearGradient>
            )}

            <View style={styles.petInfo}>
              <Text style={styles.petName}>{petFound.name}</Text>
              <Text style={styles.petBreed}>
                {petFound.species}{petFound.breed ? ` · ${petFound.breed}` : ''}
              </Text>
              {petFound.weight_kg ? (
                <Text style={styles.petWeight}>⚖️ {petFound.weight_kg} kg</Text>
              ) : null}
            </View>
          </View>

          <TouchableOpacity style={styles.linkBtnWrap} onPress={handleLink} disabled={linking}>
            <LinearGradient
              colors={['#0EA5E9', '#38BDF8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.linkBtn}
            >
              {linking
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.linkBtnText}>Adicionar como paciente</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 50 },

  infoCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 24,
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  infoTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  infoIcon: { fontSize: 16, width: 26 },
  infoText: { fontSize: 13, color: '#64748B', flex: 1, lineHeight: 20 },

  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 14, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
    marginBottom: 12,
  },
  errorBox: { backgroundColor: '#FFF1F2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FECDD3', marginBottom: 12 },
  errorText: { color: '#EF4444', fontSize: 13 },

  searchBtnWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  searchBtn: { paddingVertical: 16, alignItems: 'center' },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  petCard: {
    backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#BAE6FD',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  petCardHeader: { backgroundColor: '#EFF6FF', paddingHorizontal: 18, paddingVertical: 10 },
  petCardFoundLabel: { fontSize: 13, fontWeight: '700', color: '#0EA5E9' },
  petCardBody: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  petPhoto: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#BFDBFE' },
  petAvatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  petInfo: { flex: 1 },
  petName: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  petBreed: { fontSize: 13, color: '#64748B', marginTop: 2 },
  petWeight: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  linkBtnWrap: { marginHorizontal: 18, marginBottom: 18, borderRadius: 14, overflow: 'hidden' },
  linkBtn: { paddingVertical: 15, alignItems: 'center' },
  linkBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Sucesso
  successCard: {
    backgroundColor: '#fff', borderRadius: 28, padding: 32, alignItems: 'center', width: '100%',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
    borderWidth: 1, borderColor: '#E0F2FE',
  },
  successPhoto:  { width: 90, height: 90, borderRadius: 45, marginBottom: 4, borderWidth: 3, borderColor: '#BFDBFE' },
  successAvatar: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  successEmoji:  { fontSize: 40, marginBottom: 10 },
  successTitle:  { fontSize: 22, fontWeight: '900', color: '#1E293B', marginBottom: 8 },
  successSub:    { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  successPetName: { color: '#0EA5E9', fontWeight: '800' },
  successBtnWrap: { borderRadius: 16, overflow: 'hidden', width: '100%' },
  successBtn:    { paddingVertical: 16, alignItems: 'center' },
  successBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
