import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, TextInput, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
  Peixe:    require('../../../assets/pet_peixe.png'),
};

const ICON_MEDICAL  = require('../../../assets/icon_medical.png');
const ICON_EXPENSES = require('../../../assets/icon_expenses.png');
const ICON_PROFILE  = require('../../../assets/icon_profile.png');
const ICON_LATE     = require('../../../assets/icon_late.png');

const STATUS_LABELS = {
  scheduled: 'Agendado', confirmed: 'Confirmado',
  completed: 'Realizado', cancelled: 'Cancelado', no_show: 'Faltou',
};
const TYPE_COLORS = {
  consulta: '#0EA5E9', retorno: '#10B981', cirurgia: '#8B5CF6',
  exame: '#F59E0B', vacinacao: '#16A34A', outro: '#64748B',
};

export default function VetDashboardScreen({ navigation }) {
  const { user, vetProfile } = useAuth();
  const [linkedPets,        setLinkedPets]        = useState([]);
  const [unlinkedPatients,  setUnlinkedPatients]  = useState([]);
  const [todayAppts,        setTodayAppts]        = useState([]);
  const [pendingBilling,    setPendingBilling]    = useState(0);
  const [monthRevenue,      setMonthRevenue]      = useState(0);
  const [loading,           setLoading]           = useState(true);
  const [refreshing,        setRefreshing]        = useState(false);
  const [search,            setSearch]            = useState('');
  const [showCodeModal,     setShowCodeModal]     = useState(false);
  const [petCode,           setPetCode]           = useState('');
  const [codeLoading,       setCodeLoading]       = useState(false);
  const [codeError,         setCodeError]         = useState('');
  const [codeSuccess,       setCodeSuccess]       = useState('');

  const fetchData = async () => {
    const todayISO    = new Date().toISOString().slice(0, 10);
    const firstMonth  = `${todayISO.slice(0, 7)}-01`;

    const [linkedRes, unlinkedRes, apptRes, billingRes] = await Promise.all([
      supabase.from('pet_vet_links')
        .select('pet_id, pets(id, name, species, breed, birth_date, photo_url, weight_kg)')
        .eq('vet_id', user.id),
      supabase.from('vet_unlinked_patients')
        .select('id, name, species, breed, owner_name, weight_kg, photo_url')
        .eq('vet_id', user.id)
        .order('name'),
      supabase.from('vet_schedule')
        .select('id, patient_name, scheduled_time, type, status')
        .eq('vet_id', user.id)
        .eq('scheduled_date', todayISO)
        .order('scheduled_time'),
      supabase.from('vet_billing')
        .select('amount, status')
        .eq('vet_id', user.id)
        .gte('created_at', firstMonth),
    ]);

    if (linkedRes.data)   setLinkedPets(linkedRes.data.map(l => l.pets).filter(Boolean));
    if (unlinkedRes.data) setUnlinkedPatients(unlinkedRes.data);
    if (apptRes.data)     setTodayAppts(apptRes.data);

    if (billingRes.data) {
      setPendingBilling(billingRes.data.filter(b => b.status === 'pending').reduce((s, b) => s + (b.amount || 0), 0));
      setMonthRevenue(billingRes.data.filter(b => b.status === 'paid').reduce((s, b) => s + (b.amount || 0), 0));
    }

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const firstName    = vetProfile?.full_name?.split(' ').slice(0, 2).join(' ') || 'Doutor(a)';
  const totalPatients = linkedPets.length + unlinkedPatients.length;

  const filteredLinked = useMemo(() => {
    if (!search.trim()) return linkedPets;
    const q = search.toLowerCase();
    return linkedPets.filter(p => p.name?.toLowerCase().includes(q) || p.species?.toLowerCase().includes(q));
  }, [linkedPets, search]);

  const filteredUnlinked = useMemo(() => {
    if (!search.trim()) return unlinkedPatients;
    const q = search.toLowerCase();
    return unlinkedPatients.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.owner_name?.toLowerCase().includes(q) ||
      p.species?.toLowerCase().includes(q)
    );
  }, [unlinkedPatients, search]);

  const handleLinkByCode = async () => {
    const code = petCode.trim().toUpperCase();
    if (!code) return;
    setCodeError('');
    setCodeSuccess('');
    setCodeLoading(true);

    // RPC com SECURITY DEFINER: bypassa RLS, busca por texto do UUID
    const { data: results, error: rpcError } = await supabase
      .rpc('find_pet_by_link_code', { code });

    if (rpcError || !results || results.length === 0) {
      setCodeLoading(false);
      setCodeError('Pet não encontrado. Verifique o código e tente novamente.');
      return;
    }
    const pet = results[0];

    // Verifica se já está vinculado
    const { data: existing } = await supabase
      .from('pet_vet_links')
      .select('id, status')
      .eq('pet_id', pet.id)
      .eq('vet_id', user.id)
      .maybeSingle();

    if (existing && existing.status === 'active') {
      setCodeLoading(false);
      setCodeError(`${pet.name} já está vinculado à sua clínica.`);
      return;
    }

    let linkError;
    if (existing) {
      ({ error: linkError } = await supabase
        .from('pet_vet_links')
        .update({ status: 'active', linked_at: new Date().toISOString() })
        .eq('id', existing.id));
    } else {
      ({ error: linkError } = await supabase
        .from('pet_vet_links')
        .insert({ pet_id: pet.id, vet_id: user.id, status: 'active' }));
    }

    setCodeLoading(false);
    if (linkError) {
      setCodeError('Erro ao vincular: ' + linkError.message);
      return;
    }
    setCodeSuccess(`${pet.name} vinculado com sucesso!`);
    setPetCode('');
    fetchData();
    setTimeout(() => {
      setShowCodeModal(false);
      setCodeSuccess('');
    }, 1800);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
    >
      {/* Hero */}
      <LinearGradient colors={['#0F3460', '#0284C7', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={[styles.bubble, { width: 200, height: 200, top: -60, right: -50 }]} />
        <View style={[styles.bubble, { width: 100, height: 100, bottom: -30, left: 20 }]} />
        <Text style={styles.heroTitle}>Olá, Dr(a). {firstName}!</Text>
        <Text style={styles.heroSub}>
          {vetProfile?.specialty ? `${vetProfile.specialty} · ` : ''}
          {vetProfile?.clinic_name || 'PetCare+ Vet'}
        </Text>
        {vetProfile?.crm && (
          <Text style={styles.heroCrm}>CRM {vetProfile.crm}/{vetProfile.estado}</Text>
        )}
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
          <Image source={ICON_PROFILE}  style={styles.statIcon} resizeMode="contain" />
          <Text style={[styles.statValue, { color: '#0EA5E9' }]}>{totalPatients}</Text>
          <Text style={styles.statLabel}>Pacientes</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#F5F3FF' }]}>
          <Image source={ICON_LATE}     style={styles.statIcon} resizeMode="contain" />
          <Text style={[styles.statValue, { color: '#7C3AED' }]}>{todayAppts.length}</Text>
          <Text style={styles.statLabel}>Hoje</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#F0FFF4' }]}>
          <Image source={ICON_EXPENSES} style={styles.statIcon} resizeMode="contain" />
          <Text style={[styles.statValue, { color: '#16A34A' }]}>R${monthRevenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Recebido</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FFFBEB' }]}>
          <Image source={ICON_MEDICAL}  style={styles.statIcon} resizeMode="contain" />
          <Text style={[styles.statValue, { color: '#D97706' }]}>R${pendingBilling.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Pendente</Text>
        </View>
      </View>

      {/* Busca */}
      <View style={styles.searchWrap}>
        <Image source={ICON_PROFILE} style={{ width: 16, height: 16, marginRight: 8, opacity: 0.4 }} resizeMode="contain" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar paciente, tutor ou espécie..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Text style={{ fontSize: 16, color: '#94A3B8', padding: 4 }}>✕</Text></TouchableOpacity> : null}
      </View>

      {/* Agenda de hoje */}
      {todayAppts.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Agenda de hoje</Text>
            <TouchableOpacity onPress={() => navigation.navigate('VetCalendar')}>
              <Text style={styles.sectionLink}>Ver tudo →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }}>
            {todayAppts.map(a => {
              const color = TYPE_COLORS[a.type] || TYPE_COLORS.outro;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={styles.apptPill}
                  onPress={() => navigation.navigate('VetCalendar')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.apptTimeLine, { backgroundColor: color }]} />
                  <View style={{ flex: 1, paddingLeft: 8 }}>
                    <Text style={styles.apptTime}>{a.scheduled_time?.slice(0, 5) || '—'}</Text>
                    <Text style={styles.apptPatient}>{a.patient_name || 'Paciente'}</Text>
                    <Text style={[styles.apptType, { color }]}>{a.type}</Text>
                  </View>
                  <View style={[styles.apptStatus, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.apptStatusTxt, { color }]}>{STATUS_LABELS[a.status] || a.status}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Pacientes vinculados */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pacientes do PetCare+</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.countBadge}><Text style={styles.countBadgeTxt}>{filteredLinked.length}</Text></View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { setPetCode(''); setShowCodeModal(true); }}
          >
            <LinearGradient colors={['#7C3AED', '#A78BFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGrad}>
              <Text style={styles.addBtnTxt}>+ Vincular código</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {filteredLinked.length === 0 ? (
        <View style={styles.emptyCard}>
          <Image source={ICON_MEDICAL} style={{ width: 36, height: 36, opacity: 0.25, marginBottom: 8 }} resizeMode="contain" />
          <Text style={styles.emptyText}>{search ? 'Nenhum resultado' : 'Nenhum pet vinculado ainda'}</Text>
          <Text style={styles.emptySub}>Tutores compartilham o código do pet para vincular</Text>
        </View>
      ) : filteredLinked.map(pet => (
        <TouchableOpacity
          key={pet.id}
          style={styles.patientCard}
          onPress={() => navigation.navigate('VetPatient', { petId: pet.id })}
          activeOpacity={0.82}
        >
          {pet.photo_url
            ? <Image source={{ uri: pet.photo_url }} style={styles.petAvatar} />
            : <LinearGradient colors={['#DBEAFE', '#EFF6FF']} style={styles.petAvatarDefault}>
                {SPECIES_IMAGES[pet.species]
                  ? <Image source={SPECIES_IMAGES[pet.species]} style={{ width: 30, height: 30 }} resizeMode="contain" />
                  : <Text style={{ fontSize: 22 }}>🐾</Text>}
              </LinearGradient>}
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{pet.name}</Text>
            <Text style={styles.patientSub}>{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}{pet.weight_kg ? ` · ${pet.weight_kg}kg` : ''}</Text>
          </View>
          <View style={styles.linkedBadge}><Text style={styles.linkedTxt}>Vinculado</Text></View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}

      {/* Pacientes avulsos */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pacientes da Clínica</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('VetAddUnlinkedPatient', {})}
        >
          <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGrad}>
            <Text style={styles.addBtnTxt}>+ Novo</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {filteredUnlinked.length === 0 ? (
        <TouchableOpacity
          style={[styles.emptyCard, { borderStyle: 'dashed', borderColor: '#BAE6FD' }]}
          onPress={() => navigation.navigate('VetAddUnlinkedPatient', {})}
          activeOpacity={0.8}
        >
          <Image source={ICON_PROFILE} style={{ width: 36, height: 36, opacity: 0.25, marginBottom: 8 }} resizeMode="contain" />
          <Text style={styles.emptyText}>{search ? 'Nenhum resultado' : 'Nenhum paciente cadastrado'}</Text>
          <Text style={styles.emptySub}>Toque para cadastrar um paciente da clínica</Text>
        </TouchableOpacity>
      ) : filteredUnlinked.map(p => (
        <TouchableOpacity
          key={p.id}
          style={styles.patientCard}
          onPress={() => navigation.navigate('VetUnlinkedPatient', { patientId: p.id })}
          activeOpacity={0.82}
        >
          <LinearGradient colors={['#F5F3FF', '#EDE9FE']} style={styles.petAvatarDefault}>
            {SPECIES_IMAGES[p.species]
              ? <Image source={SPECIES_IMAGES[p.species]} style={{ width: 30, height: 30 }} resizeMode="contain" />
              : <Text style={{ fontSize: 22 }}>🐾</Text>}
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{p.name}</Text>
            <Text style={styles.patientSub}>
              {p.species}{p.breed ? ` · ${p.breed}` : ''}{p.owner_name ? ` · ${p.owner_name}` : ''}
            </Text>
          </View>
          <View style={[styles.linkedBadge, { backgroundColor: '#EDE9FE' }]}>
            <Text style={[styles.linkedTxt, { color: '#7C3AED' }]}>Clínica</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}

      <View style={{ height: 20 }} />
    </ScrollView>

    {/* Modal vincular por código */}
    <Modal visible={showCodeModal} transparent animationType="slide" onRequestClose={() => { setShowCodeModal(false); setCodeError(''); setCodeSuccess(''); }}>
      {/* Overlay: View simples sem TouchableOpacity para não interceptar eventos dos filhos */}
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 48 }}>

          {/* Header com botão fechar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ flex: 1, fontSize: 19, fontWeight: '800', color: '#1E293B' }}>Vincular pet por código</Text>
            <TouchableOpacity onPress={() => { setShowCodeModal(false); setCodeError(''); setCodeSuccess(''); }} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Text style={{ fontSize: 20, color: '#94A3B8', fontWeight: '300' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 18 }}>
            O tutor encontra o código na tela de detalhes do pet no PetCare+. Cole ou digite os primeiros caracteres abaixo.
          </Text>

          {/* Feedback — erro */}
          {codeError ? (
            <View style={{ backgroundColor: '#FFF1F2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' }}>
              <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>✕ {codeError}</Text>
            </View>
          ) : null}

          {/* Feedback — sucesso */}
          {codeSuccess ? (
            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#BBF7D0' }}>
              <Text style={{ color: '#16A34A', fontSize: 14, fontWeight: '800' }}>✓ {codeSuccess}</Text>
            </View>
          ) : null}

          <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1.5, borderColor: codeError ? '#FECACA' : '#E0F2FE', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 20 }}>
            <Text style={{ fontSize: 15, color: '#94A3B8', marginRight: 8 }}>#</Text>
            <TextInput
              style={{ flex: 1, fontSize: 20, fontWeight: '800', color: '#1E293B', paddingVertical: 16, letterSpacing: 2 }}
              value={petCode}
              onChangeText={v => { setPetCode(v.toUpperCase()); setCodeError(''); setCodeSuccess(''); }}
              placeholder="Ex: A3F1B2C4"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
            />
            {petCode.length > 0 && (
              <TouchableOpacity onPress={() => { setPetCode(''); setCodeError(''); }} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                <Text style={{ fontSize: 16, color: '#94A3B8' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={{ borderRadius: 16, overflow: 'hidden' }}
            onPress={handleLinkByCode}
            disabled={codeLoading || !petCode.trim()}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#7C3AED', '#A78BFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center', opacity: petCode.trim() ? 1 : 0.45 }}>
              {codeLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Vincular paciente</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setShowCodeModal(false); setCodeError(''); setCodeSuccess(''); }} style={{ alignItems: 'center', marginTop: 14 }}>
            <Text style={{ color: '#94A3B8', fontWeight: '600' }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: { paddingTop: 22, paddingBottom: 28, paddingHorizontal: 24, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 4 },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
  heroCrm:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 16, marginBottom: 6 },
  statCard: { flex: 1, borderRadius: 14, padding: 10, alignItems: 'center', gap: 3 },
  statIcon: { width: 18, height: 18, marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', letterSpacing: 0.3 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#1E293B' },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginTop: 20, marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  sectionLink:  { fontSize: 13, color: '#0EA5E9', fontWeight: '700' },
  countBadge:   { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  countBadgeTxt:{ fontSize: 12, fontWeight: '800', color: '#0EA5E9' },

  addBtn: { borderRadius: 20, overflow: 'hidden' },
  addBtnGrad: { paddingHorizontal: 14, paddingVertical: 7 },
  addBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  patientCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 18, padding: 14, gap: 12,
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  petAvatar:        { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#BFDBFE' },
  petAvatarDefault: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  patientName: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  patientSub:  { fontSize: 12, color: '#64748B' },
  linkedBadge: { backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  linkedTxt:   { fontSize: 10, fontWeight: '700', color: '#16A34A' },
  arrow:       { fontSize: 20, color: '#BAE6FD' },

  apptPill: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 0, width: 200,
    borderWidth: 1, borderColor: '#E0F2FE', overflow: 'hidden',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  apptTimeLine: { width: 4, height: 60, borderRadius: 2, marginRight: 4 },
  apptTime:     { fontSize: 14, fontWeight: '900', color: '#1E293B' },
  apptPatient:  { fontSize: 12, color: '#374151', fontWeight: '600', marginTop: 1 },
  apptType:     { fontSize: 11, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  apptStatus:   { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 'auto' },
  apptStatusTxt:{ fontSize: 10, fontWeight: '700' },

  emptyCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 28, alignItems: 'center',
    marginHorizontal: 16, borderWidth: 1, borderColor: '#E0F2FE',
  },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#94A3B8', marginBottom: 4 },
  emptySub:  { fontSize: 12, color: '#BAE6FD', textAlign: 'center' },
});
