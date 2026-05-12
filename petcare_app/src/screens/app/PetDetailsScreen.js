import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  ActivityIndicator, Alert, RefreshControl, Image, TextInput, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { uploadImage, pickImage } from '../../utils/uploadImage';
import { usePlan } from '../../hooks/usePlan';
import UpgradeModal from '../../components/UpgradeModal';
import DatePickerInput from '../../components/DatePickerInput';
import { generateExpenseReportHTML, generateHealthReportHTML, exportReport } from '../../utils/generateReport';
import { Share } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import WeightChart from '../../components/WeightChart';

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
  Peixe:    require('../../../assets/pet_peixe.png'),
};

const SUGGESTED_VACCINES = {
  Cachorro: [
    { name: 'V8/V10 (Polivalente)', desc: 'Proteção contra cinomose, parvovirose, hepatite, leptospirose e outras doenças' },
    { name: 'Antirrábica', desc: 'Proteção contra a raiva — obrigatória por lei' },
    { name: 'Giárdia', desc: 'Previne a giardíase, doença intestinal comum' },
    { name: 'Gripe Canina (Tosse dos Canis)', desc: 'Proteção contra bordetella e parainfluenza' },
    { name: 'Leishmaniose', desc: 'Prevenção de leishmaniose visceral canina' },
    { name: 'Lyme', desc: 'Proteção contra borreliose transmitida por carrapatos' },
  ],
  Gato: [
    { name: 'Tríplice Felina', desc: 'Proteção contra rinotraqueíte, calicivirose e panleucopenia' },
    { name: 'Quádrupla Felina', desc: 'Tríplice + clamidiose felina' },
    { name: 'Antirrábica', desc: 'Proteção contra a raiva — obrigatória por lei' },
    { name: 'Leucemia Felina (FeLV)', desc: 'Previne a leucemia viral felina' },
  ],
};

const formatDate = (d) => {
  if (!d) return '—';
  const s = String(d).split('T')[0];
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};
const fmtDateInput = (text) => {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};
const toStorage = (ddmmyyyy) => {
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const dbToDDMMYYYY = (yyyymmdd) => {
  if (!yyyymmdd) return '';
  const [y, m, d] = String(yyyymmdd).split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

const AGE_THRESHOLDS = {
  Cachorro: { filhote: 12, adolescente: 24 },
  Gato:     { filhote: 12, adolescente: 36 },
  Ave:      { filhote: 6,  adolescente: 18 },
  Coelho:   { filhote: 6,  adolescente: 12 },
  Hamster:  { filhote: 2,  adolescente: 6  },
  Réptil:   { filhote: 12, adolescente: 24 },
  Peixe:    { filhote: 6,  adolescente: 12  },
};

function getAgeStage(birthDate, species) {
  if (!birthDate) return null;
  const months = Math.floor((Date.now() - new Date(birthDate)) / (1000 * 60 * 60 * 24 * 30.44));
  const t = AGE_THRESHOLDS[species] || { filhote: 12, adolescente: 24 };
  if (months < t.filhote)      return { label: 'Filhote',    color: '#16A34A', bg: '#DCFCE7' };
  if (months < t.adolescente)  return { label: 'Adolescente', color: '#D97706', bg: '#FEF9C3' };
  return                              { label: 'Adulto',     color: '#0EA5E9', bg: '#E0F2FE' };
}

function calcAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}

function VaccineStatusBadge({ status }) {
  const config = {
    'Em dia':   { bg: '#DCFCE7', color: '#16A34A' },
    'Vencendo': { bg: '#FEF9C3', color: '#B45309' },
    'Atrasada': { bg: '#FEE2E2', color: '#DC2626' },
    'Pendente': { bg: '#EFF6FF', color: '#0369A1' },
  };
  const c = config[status] || config['Pendente'];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.color }]}>{status}</Text>
    </View>
  );
}

function VaccineCard({ vaccine, registered, onRegister }) {
  const today = new Date();
  let status = 'Pendente';
  if (registered) {
    if (!registered.next_dose_date) status = 'Em dia';
    else {
      const next = new Date(registered.next_dose_date);
      const days = Math.floor((next - today) / (1000 * 60 * 60 * 24));
      if (days < 0) status = 'Atrasada';
      else if (days <= 30) status = 'Vencendo';
      else status = 'Em dia';
    }
  }
  const dotColor = { 'Em dia': '#10B981', 'Vencendo': '#F59E0B', 'Atrasada': '#EF4444', 'Pendente': '#BAE6FD' };
  const isPending = !registered;

  return (
    <View style={[styles.vaccineCard, isPending && styles.vaccineCardPending]}>
      <View style={[styles.vaccineDot, { backgroundColor: dotColor[status] }]} />
      <View style={styles.vaccineCardContent}>
        <View style={styles.vaccineCardHeader}>
          <Text style={styles.vaccineCardName}>{vaccine.name}</Text>
          <VaccineStatusBadge status={status} />
        </View>
        <Text style={styles.vaccineCardDesc}>{vaccine.desc}</Text>
        {registered ? (
          <View style={styles.vaccineAppliedInfo}>
            <Text style={styles.vaccineAppliedDate}>
              ✅ Aplicada em {formatDate(registered.applied_date)}
            </Text>
            {registered.next_dose_date && (
              <Text style={[styles.vaccineNextDate, new Date(registered.next_dose_date) < today && styles.vaccineNextDateLate]}>
                📅 Próxima: {formatDate(registered.next_dose_date)}
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.registerBtn} onPress={() => onRegister(vaccine.name)}>
            <LinearGradient
              colors={['#0EA5E9', '#38BDF8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.registerBtnGrad}
            >
              <Text style={styles.registerBtnText}>Registrar vacina</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const TIMELINE_ICONS = {
  vaccine: require('../../../assets/icon_medical.png'),
  expense: require('../../../assets/icon_expenses.png'),
  weight:  null,
  medical: require('../../../assets/icon_medical.png'),
};

function TimelineItem({ item }) {
  const icon = TIMELINE_ICONS[item.type];
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDotWrap}>
        <View style={styles.timelineDot} />
        <View style={styles.timelineLine} />
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineDate}>{item.displayDate}</Text>
        <View style={styles.timelineCard}>
          <Image
            source={icon || require('../../../assets/icon_weight.png')}
            style={{ width: 28, height: 28 }}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.timelineTitle}>{item.title}</Text>
            {item.subtitle ? <Text style={styles.timelineSubtitle}>{item.subtitle}</Text> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function PetDetailsScreen({ route, navigation }) {
  const { petId } = route.params;
  const { user } = useAuth();
  const { canUseVets } = usePlan();
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('health'); // 'health' | 'expenses'
  const [exportGenerating, setExportGenerating] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const [exportStart, setExportStart] = useState(firstOfMonth);
  const [exportEnd,   setExportEnd]   = useState(today);
  const [pet, setPet] = useState(null);
  const [tutorName, setTutorName] = useState('');
  const [vaccines, setVaccines] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [weightRecords, setWeightRecords] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('vacinas');

  // Saúde do pet
  const [editingHealth, setEditingHealth] = useState(false);
  const [healthForm, setHealthForm] = useState({ health_notes: '', medications: '' });
  const [savingHealth, setSavingHealth] = useState(false);

  // Edição das infos do pet
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    name: '', breed: '', birth_date: '', coat_color: '',
    sex: '', neutered: false, weight_kg: '',
  });
  const [savingInfo, setSavingInfo] = useState(false);

  // Confirmação de exclusão (web-compatible — sem Alert.alert)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Feedback de cópia do código (web-compatible — sem Alert.alert)
  const [copiedCode, setCopiedCode] = useState(false);

  // Foto do pet
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Veterinários com acesso
  const [vetLinks, setVetLinks] = useState([]);
  // Sub-aba dentro de "vets"
  const [vetSubTab, setVetSubTab] = useState('registros');
  // Agendamentos + perfis dos vets dos agendamentos
  const [appointments, setAppointments] = useState([]);
  const [vetScheduleAppts, setVetScheduleAppts] = useState([]);
  const [apptVetProfiles, setApptVetProfiles] = useState({});
  // Modais web-compatible
  const [removeVetLink, setRemoveVetLink] = useState(null);
  const [selectedAppt, setSelectedAppt] = useState(null);
  // Modal solicitação de consulta
  const [showApptRequest, setShowApptRequest] = useState(false);
  const [apptRequestVet, setApptRequestVet] = useState(null);
  const [apptRequestForm, setApptRequestForm] = useState({ type: 'consulta', date: '', time: '', message: '' });
  const [apptRequestSaving, setApptRequestSaving] = useState(false);

  const fetchData = async () => {
    const [petRes, vacRes, expRes, wRes, medRes, profileRes, linksRes, apptRes, schedRes] = await Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase.from('vaccines').select('*').eq('pet_id', petId).order('applied_date', { ascending: false }),
      supabase.from('expenses').select('*').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('weight_records').select('*').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('medical_records').select('*').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('pet_vet_links').select('id, vet_id, linked_at').eq('pet_id', petId).eq('status', 'active'),
      supabase.from('appointments').select('*').eq('pet_id', petId).order('scheduled_date', { ascending: true }),
      supabase.from('vet_schedule').select('*').eq('pet_id', petId).order('scheduled_date', { ascending: true }),
    ]);
    if (petRes.data) {
      setPet(petRes.data);
      setHealthForm({ health_notes: petRes.data.health_notes || '', medications: petRes.data.medications || '' });
    }
    if (vacRes.data) setVaccines(vacRes.data);
    if (expRes.data) setExpenses(expRes.data);
    if (wRes.data) setWeightRecords(wRes.data);
    if (medRes.data) setMedicalRecords(medRes.data);
    if (profileRes.data) setTutorName(profileRes.data.full_name || '');
    const appts = apptRes.data || [];
    setAppointments(appts);
    if (schedRes.data) setVetScheduleAppts(schedRes.data);

    // Coleta todos os vet_ids únicos (de links + agendamentos)
    const linkIds = linksRes.data?.map(l => l.vet_id) || [];
    const apptIds = appts.map(a => a.vet_id);
    const allVetIds = [...new Set([...linkIds, ...apptIds])];

    let vetProfs = [];
    if (allVetIds.length > 0) {
      const { data } = await supabase
        .from('vet_profiles')
        .select('id, full_name, crm, estado, specialty, clinic_name, clinic_address, chat_enabled')
        .in('id', allVetIds);
      vetProfs = data || [];
    }

    // Mapa id → profile para agendamentos
    const profMap = {};
    vetProfs.forEach(p => { profMap[p.id] = p; });
    setApptVetProfiles(profMap);

    // Merge dos links com profiles
    if (linksRes.data && linksRes.data.length > 0) {
      const merged = linksRes.data.map(l => ({
        ...l,
        vet_profiles: profMap[l.vet_id] || null,
      }));
      setVetLinks(merged);
    } else {
      setVetLinks([]);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const handleRemoveVet = (link) => setRemoveVetLink(link);

  const confirmRemoveVet = async () => {
    if (!removeVetLink) return;
    await supabase.from('pet_vet_links').update({ status: 'removed' }).eq('id', removeVetLink.id);
    setVetLinks(prev => prev.filter(l => l.id !== removeVetLink.id));
    setRemoveVetLink(null);
  };

  const openApptRequest = (link) => {
    setApptRequestVet(link);
    const today2 = new Date().toISOString().slice(0, 10);
    const [y, m, d] = today2.split('-');
    setApptRequestForm({ type: 'consulta', date: `${d}/${m}/${y}`, time: '', message: '' });
    setShowApptRequest(true);
  };

  const submitApptRequest = async () => {
    if (!apptRequestVet) return;
    const dateMatch = apptRequestForm.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dateMatch) { Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.'); return; }
    const isoDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    setApptRequestSaving(true);
    const { error } = await supabase.from('vet_schedule').insert({
      vet_id: apptRequestVet.vet_id,
      pet_id: petId,
      patient_name: pet?.name || null,
      scheduled_date: isoDate,
      scheduled_time: apptRequestForm.time || null,
      type: apptRequestForm.type,
      status: 'pending_approval',
      requested_by_user_id: user.id,
      request_message: apptRequestForm.message || null,
    });
    setApptRequestSaving(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setShowApptRequest(false);
    fetchData();
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleExport = async () => {
    setExportGenerating(true);
    try {
      let html;
      const ownerName = tutorName || '';
      if (exportType === 'health') {
        const vetRecords = medicalRecords.filter(r => r.created_by_role === 'vet');
        const tutorRecords = medicalRecords.filter(r => r.created_by_role !== 'vet');
        html = generateHealthReportHTML({
          pet, vaccines, weights: weightRecords,
          medicalRecords: tutorRecords, vetRecords, ownerName,
        });
        await exportReport(html, `saude_${pet.name}.pdf`);
      } else {
        // Busca gastos do período selecionado
        const { data: expData } = await supabase
          .from('expenses')
          .select('id, amount, date, category, description')
          .eq('pet_id', petId)
          .gte('date', exportStart)
          .lte('date', exportEnd)
          .order('date', { ascending: false });
        html = generateExpenseReportHTML({
          pet, expenses: expData || [],
          startDate: exportStart, endDate: exportEnd, ownerName,
        });
        await exportReport(html, `gastos_${pet.name}.pdf`);
      }
      setShowExportModal(false);
    } catch (e) {
      console.warn('Erro ao exportar:', e);
    } finally {
      setExportGenerating(false);
    }
  };

  const handleDelete = () => setShowDeleteConfirm(true);

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    await supabase.from('pets').delete().eq('id', petId);
    navigation.goBack();
  };

  const openInfoEdit = () => {
    setInfoForm({
      name:       pet.name        ?? '',
      breed:      pet.breed       ?? '',
      birth_date: pet.birth_date  ? dbToDDMMYYYY(pet.birth_date) : '',
      coat_color: pet.coat_color  ?? '',
      sex:        pet.sex         ?? '',
      neutered:   pet.neutered    ?? false,
      weight_kg:  pet.weight_kg   ? String(pet.weight_kg) : '',
    });
    setEditingInfo(true);
  };

  const saveInfo = async () => {
    if (!infoForm.name.trim()) return;
    setSavingInfo(true);

    const birthStorage = infoForm.birth_date ? toStorage(infoForm.birth_date) : null;
    if (infoForm.birth_date && !birthStorage) {
      Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.');
      setSavingInfo(false);
      return;
    }

    const weight = infoForm.weight_kg ? parseFloat(infoForm.weight_kg.replace(',', '.')) : null;

    const { error } = await supabase.from('pets').update({
      name:       infoForm.name.trim(),
      breed:      infoForm.breed.trim()      || null,
      birth_date: birthStorage,
      coat_color: infoForm.coat_color.trim() || null,
      sex:        infoForm.sex               || null,
      neutered:   infoForm.neutered,
      weight_kg:  !isNaN(weight) ? weight    : null,
    }).eq('id', petId);

    setSavingInfo(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setPet(prev => ({
      ...prev,
      name:       infoForm.name.trim(),
      breed:      infoForm.breed.trim()      || null,
      birth_date: birthStorage,
      coat_color: infoForm.coat_color.trim() || null,
      sex:        infoForm.sex               || null,
      neutered:   infoForm.neutered,
      weight_kg:  !isNaN(weight) ? weight    : null,
    }));
    setEditingInfo(false);
  };

  const handleRegisterVaccine = (vaccineName) => {
    navigation.navigate('AddVaccine', { petId, petName: pet.name, petSpecies: pet.species, prefillName: vaccineName });
  };

  const handlePhotoUpload = async () => {
    const uri = await pickImage();
    if (!uri) return;

    setUploadingPhoto(true);
    try {
      const url = await uploadImage(uri, 'pet-photos', `pets/${user.id}/${petId}`);
      await supabase.from('pets').update({ photo_url: url }).eq('id', petId);
      setPet(prev => ({ ...prev, photo_url: url }));
    } catch (e) {
      Alert.alert('Erro ao enviar foto', e.message || 'Verifique se o bucket pet-photos existe no Supabase Storage.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openHealthEdit = () => {
    setHealthForm({ health_notes: pet.health_notes || '', medications: pet.medications || '' });
    setEditingHealth(true);
  };

  const saveHealth = async () => {
    setSavingHealth(true);
    const { error } = await supabase.from('pets').update({
      health_notes: healthForm.health_notes.trim() || null,
      medications: healthForm.medications.trim() || null,
    }).eq('id', petId);
    setSavingHealth(false);
    if (!error) {
      setPet(prev => ({ ...prev, health_notes: healthForm.health_notes.trim() || null, medications: healthForm.medications.trim() || null }));
      setEditingHealth(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  if (!pet) return null;

  const isOwner = pet.user_id === user.id; // false quando é viewer de outro usuário
  const age = calcAge(pet.birth_date);
  const ageStage = getAgeStage(pet.birth_date, pet.species);
  const speciesImg = SPECIES_IMAGES[pet.species];
  const suggested = SUGGESTED_VACCINES[pet.species] || [];
  const now = new Date();

  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, e) => s + Number(e.amount), 0);

  const pendingCount = suggested.filter(s => !vaccines.find(v => v.name.toLowerCase().includes(s.name.split(' ')[0].toLowerCase()))).length;
  const nextVaccine = vaccines.find(v => v.next_dose_date && new Date(v.next_dose_date) > now);
  const latestWeight = weightRecords[0];

  const timeline = [
    ...vaccines.map(v => ({ type: 'vaccine', date: v.applied_date, displayDate: formatDate(v.applied_date), title: v.name, subtitle: `Aplicada${v.veterinarian ? ` — ${v.veterinarian}` : ''}` })),
    ...expenses.slice(0, 5).map(e => ({ type: 'expense', date: e.date, displayDate: formatDate(e.date), title: e.description || e.category, subtitle: `R$ ${Number(e.amount).toFixed(2)}` })),
    ...weightRecords.slice(0, 5).map(w => ({ type: 'weight', date: w.date, displayDate: formatDate(w.date), title: `Peso: ${w.weight_kg} kg`, subtitle: w.notes })),
    ...medicalRecords.slice(0, 5).map(m => ({ type: 'medical', date: m.date, displayDate: formatDate(m.date), title: m.title, subtitle: m.type })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <View style={styles.container}>
      <UpgradeModal visible={upgradeModal} onClose={() => setUpgradeModal(false)} feature="vets" />

      {/* Viewer badge */}
      {!isOwner && (
        <View style={styles.viewerBanner}>
          <Text style={styles.viewerBannerText}>Você está visualizando como convidado — somente leitura</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pet.name}</Text>
        <View style={styles.headerActions}>
          {isOwner && (
            <TouchableOpacity style={styles.headerBtn} onPress={async () => {
              const token = pet?.share_token;
              if (!token) return;
              const url = `https://petcare-plus-nu.vercel.app/pet/${token}`;
              try {
                if (Platform.OS === 'web') {
                  await navigator.clipboard.writeText(url);
                  alert('Link copiado! Qualquer pessoa com o link pode ver o prontuário.');
                } else {
                  await Share.share({ message: `Prontuário de ${pet.name}: ${url}`, url });
                }
              } catch (_) {}
            }}>
              <Image source={require('../../../assets/icon_doc.png')} style={{ width: 26, height: 26 }} resizeMode="contain" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('PetQR', { petId })}>
            <Image source={require('../../../assets/icon_doc.png')} style={{ width: 22, height: 22, opacity: 0.6 }} resizeMode="contain" />
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity style={styles.headerBtn} onPress={handleDelete}>
              <Image source={require('../../../assets/icon_trash.png')} style={{ width: 26, height: 26 }} resizeMode="contain" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
      >
        {/* Card principal */}
        <View style={styles.petCard}>
          {/* Topo: foto + nome + fase */}
          <View style={styles.petTop}>
            <TouchableOpacity onPress={handlePhotoUpload} style={styles.petAvatarBtn} activeOpacity={0.85}>
              {pet.photo_url ? (
                <Image source={{ uri: pet.photo_url }} style={styles.petPhoto} />
              ) : (
                <LinearGradient colors={['#DBEAFE', '#EFF6FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.petAvatarWrap}>
                  {speciesImg
                    ? <Image source={speciesImg} style={{ width: 44, height: 44 }} resizeMode="contain" />
                    : <Text style={styles.petEmoji}>🐾</Text>}
                </LinearGradient>
              )}
              <View style={styles.photoOverlay}>
                {uploadingPhoto
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.photoOverlayText}>📷</Text>}
              </View>
            </TouchableOpacity>

            <View style={styles.petMeta}>
              <View style={styles.petNameRow}>
                <Text style={styles.petName}>{pet.name}</Text>
                {isOwner && (
                  <TouchableOpacity onPress={openInfoEdit} style={styles.editInfoBtn} hitSlop={{top:6,bottom:6,left:6,right:6}}>
                    <Text style={styles.editInfoIcon}>✏️</Text>
                  </TouchableOpacity>
                )}
              </View>
              {ageStage && (
                <View style={[styles.ageTagBadge, { backgroundColor: ageStage.bg }]}>
                  <Text style={[styles.ageTagText, { color: ageStage.color }]}>{ageStage.label}</Text>
                </View>
              )}
              {tutorName ? (
                <View style={styles.petTutorRow}>
                  <Image source={require('../../../assets/icon_profile.png')} style={{ width: 12, height: 12, marginRight: 4 }} resizeMode="contain" />
                  <Text style={styles.petTutorText}>Tutor: {tutorName}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Grade de informações rotuladas */}
          <View style={styles.infoGrid}>
            {pet.species && (
              <View style={styles.infoCell}>
                <Text style={styles.infoCellLabel}>ESPÉCIE</Text>
                <Text style={styles.infoCellValue}>{pet.species}</Text>
              </View>
            )}
            {pet.breed && (
              <View style={styles.infoCell}>
                <Text style={styles.infoCellLabel}>RAÇA</Text>
                <Text style={styles.infoCellValue}>{pet.breed}</Text>
              </View>
            )}
            {pet.sex && (
              <View style={styles.infoCell}>
                <Text style={styles.infoCellLabel}>SEXO</Text>
                <Text style={styles.infoCellValue}>{pet.sex}</Text>
              </View>
            )}
            {pet.birth_date && (
              <View style={styles.infoCell}>
                <Text style={styles.infoCellLabel}>NASCIMENTO</Text>
                <Text style={styles.infoCellValue}>{formatDate(pet.birth_date)}</Text>
              </View>
            )}
            {age && (
              <View style={styles.infoCell}>
                <Text style={styles.infoCellLabel}>IDADE</Text>
                <Text style={styles.infoCellValue}>{age}</Text>
              </View>
            )}
            {pet.coat_color && (
              <View style={styles.infoCell}>
                <Text style={styles.infoCellLabel}>PELAGEM</Text>
                <Text style={styles.infoCellValue}>{pet.coat_color}</Text>
              </View>
            )}
            {pet.neutered && (
              <View style={styles.infoCell}>
                <Text style={styles.infoCellLabel}>CASTRADO</Text>
                <Text style={[styles.infoCellValue, { color: '#16A34A' }]}>Sim ✓</Text>
              </View>
            )}
          </View>

          {/* Ações: RG Digital + Código vet */}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.qrActionBtn}
              onPress={() => navigation.navigate('PetQR', { petId })}
              activeOpacity={0.8}
            >
              <Image source={require('../../../assets/icon_doc.png')} style={{ width: 15, height: 15 }} resizeMode="contain" />
              <Text style={styles.qrActionText}>RG Digital</Text>
            </TouchableOpacity>

            {isOwner && canUseVets && (
              <TouchableOpacity
                style={[styles.codeBadge, copiedCode && styles.codeBadgeCopied]}
                onPress={() => {
                  require('expo-clipboard').setStringAsync(petId.split('-')[0].toUpperCase());
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                activeOpacity={0.75}
              >
                <Text style={styles.codeValue}># {petId.split('-')[0].toUpperCase()}</Text>
                <Text style={[styles.codeCopy, copiedCode && styles.codeCopiedText]}>
                  {copiedCode ? '· copiado ✓' : '· copiar código'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <View style={[styles.statIconBubble, { backgroundColor: '#FEF9C3' }]}>
                <Image source={require('../../../assets/icon_medical.png')} style={{ width: 16, height: 16 }} resizeMode="contain" />
              </View>
              <Text style={styles.statValue}>{pendingCount}</Text>
              <Text style={styles.statLabel}>Vacinas</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <View style={[styles.statIconBubble, { backgroundColor: '#DCFCE7' }]}>
                <Image source={require('../../../assets/icon_check.png')} style={{ width: 16, height: 16 }} resizeMode="contain" />
              </View>
              <Text style={[styles.statValue, styles.statValueSm]} numberOfLines={1}>
                {nextVaccine?.name?.split(' ')[0] || '—'}
              </Text>
              <Text style={styles.statLabel}>Próxima</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <View style={[styles.statIconBubble, { backgroundColor: '#E0F2FE' }]}>
                <Image source={require('../../../assets/icon_expenses.png')} style={{ width: 16, height: 16 }} resizeMode="contain" />
              </View>
              <Text style={styles.statValue}>R${monthExpenses.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Mês</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <View style={[styles.statIconBubble, { backgroundColor: '#F5F3FF' }]}>
                <Image source={require('../../../assets/icon_weight.png')} style={{ width: 16, height: 16 }} resizeMode="contain" />
              </View>
              <Text style={styles.statValue}>{latestWeight ? `${latestWeight.weight_kg}kg` : '—'}</Text>
              <Text style={styles.statLabel}>Peso</Text>
            </View>
          </View>

          {/* Saúde do pet */}
          {(pet.health_notes || pet.medications) ? (
            <View style={styles.healthSection}>
              {pet.health_notes && (
                <View style={styles.healthRow}>
                  <Text style={styles.healthIcon}>🌿</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.healthLabel}>Saúde</Text>
                    <Text style={styles.healthValue}>{pet.health_notes}</Text>
                  </View>
                </View>
              )}
              {pet.medications && (
                <View style={styles.healthRow}>
                  <Image source={require('../../../assets/icon_medicine.png')} style={styles.healthIcon} resizeMode="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.healthLabel}>Medicamentos</Text>
                    <Text style={styles.healthValue}>{pet.medications}</Text>
                  </View>
                </View>
              )}
              <TouchableOpacity onPress={openHealthEdit} style={styles.healthEditLink}>
                <Text style={styles.healthEditText}>✏️ Editar informações de saúde</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.healthAddBtn} onPress={openHealthEdit}>
              <Text style={styles.healthAddText}>🌿 Adicionar notas de saúde e medicamentos</Text>
            </TouchableOpacity>
          )}

          {/* Tabs */}
          <View style={styles.tabBar}>
            {[
              { key: 'vacinas',    label: 'Vacinas'   },
              { key: 'evolução',   label: 'Evolução'  },
              { key: 'histórico',  label: 'Histórico' },
              { key: 'vets',       label: 'Vets', premium: true },
            ].map(tab => {
              const isVetsLocked = tab.premium && !canUseVets;
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabBtn, isActive && !isVetsLocked && styles.tabBtnActive]}
                  onPress={() => {
                    if (isVetsLocked) { setUpgradeModal(true); return; }
                    setActiveTab(tab.key);
                  }}
                  activeOpacity={0.75}
                >
                  {isVetsLocked ? (
                    /* Aba Vets bloqueada — visual dourado premium */
                    <LinearGradient
                      colors={['#F59E0B', '#FBBF24']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.tabBtnPill}
                    >
                      <Image source={require('../../../assets/icon_crown.png')} style={{ width: 13, height: 13, marginRight: 4 }} resizeMode="contain" />
                      <Text style={styles.tabBtnTextActive}>Vets</Text>
                    </LinearGradient>
                  ) : isActive ? (
                    <LinearGradient
                      colors={['#0EA5E9', '#38BDF8']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.tabBtnPill}
                    >
                      <Text style={styles.tabBtnTextActive}>{tab.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.tabBtnPillInactive}>
                      <Text style={styles.tabBtnText}>{tab.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Tab: Vacinas */}
        {activeTab === 'vacinas' && (
          <View style={styles.tabContent}>
            <View style={styles.tabContentHeader}>
              <Text style={styles.tabContentTitle}>Carteira de Vacinação</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AddVaccine', { petId, petName: pet.name, petSpecies: pet.species })}>
                <Text style={styles.tabContentAdd}>+ Adicionar</Text>
              </TouchableOpacity>
            </View>
            {suggested.map(sv => {
              const registered = vaccines.find(v => v.name.toLowerCase().includes(sv.name.split(' ')[0].toLowerCase()));
              return (
                <VaccineCard key={sv.name} vaccine={sv} registered={registered} onRegister={handleRegisterVaccine} />
              );
            })}
            {vaccines.filter(v => !suggested.find(s => v.name.toLowerCase().includes(s.name.split(' ')[0].toLowerCase()))).map(v => (
              <VaccineCard
                key={v.id}
                vaccine={{ name: v.name, desc: v.notes || '' }}
                registered={v}
                onRegister={handleRegisterVaccine}
              />
            ))}
          </View>
        )}

        {/* Tab: Evolução de Peso */}
        {activeTab === 'evolução' && (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentTitle}>Evolução de Peso</Text>
            <View style={styles.chartCard}>
              <WeightChart records={[...weightRecords].sort((a, b) => new Date(a.date) - new Date(b.date))} />
            </View>
            <TouchableOpacity
              style={styles.addWeightBtnWrap}
              onPress={() => navigation.navigate('AddWeight', { petId, petName: pet.name, currentWeight: latestWeight?.weight_kg })}
            >
              <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addWeightBtnGrad}>
                <Text style={styles.addWeightBtnText}>+ Registrar peso</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('WeightHistory', { petId, petName: pet.name })}>
              <Text style={styles.viewHistoryLink}>Ver histórico completo →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab: Histórico */}
        {activeTab === 'histórico' && (
          <View style={styles.tabContent}>
            {/* Botões de exportação */}
            <View style={styles.exportRow}>
              <TouchableOpacity
                style={styles.exportBtn}
                onPress={() => { setExportType('health'); setShowExportModal(true); }}
                activeOpacity={0.8}
              >
                <Image source={require('../../../assets/icon_medical.png')} style={{ width: 14, height: 14 }} resizeMode="contain" />
                <Text style={styles.exportBtnText}>Relatório de saúde</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportBtn}
                onPress={() => { setExportType('expenses'); setShowExportModal(true); }}
                activeOpacity={0.8}
              >
                <Image source={require('../../../assets/icon_expenses.png')} style={{ width: 14, height: 14 }} resizeMode="contain" />
                <Text style={styles.exportBtnText}>Relatório de gastos</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.tabContentTitle}>Linha do Tempo</Text>
            {timeline.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyText}>Nenhum registro ainda</Text>
              </View>
            ) : (
              timeline.map((item, i) => <TimelineItem key={i} item={item} />)
            )}
          </View>
        )}

        {/* Tab: Veterinários */}
        {activeTab === 'vets' && (() => {
          const vetRecords = medicalRecords.filter(r => r.created_by_role === 'vet');
          const todayDate = new Date(new Date().toDateString());
          // Merge old appointments + vet_schedule entries
          const allAppts = [
            ...appointments,
            ...vetScheduleAppts.filter(s => !appointments.find(a => a.id === s.id)),
          ].sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
          const upcomingAppts = allAppts.filter(a => new Date(a.scheduled_date) >= todayDate || a.status === 'pending_approval');
          const pastAppts = allAppts.filter(a => new Date(a.scheduled_date) < todayDate && a.status !== 'pending_approval');

          const typeConfig = {
            consulta:    { label: 'Consulta',    icon: require('../../../assets/icon_medical.png'),  color: '#F43F5E', bg: '#FFE4E6' },
            cirurgia:    { label: 'Cirurgia',     icon: require('../../../assets/icon_medical.png'),  color: '#8B5CF6', bg: '#EDE9FE' },
            exame:       { label: 'Exame',        icon: require('../../../assets/icon_medical.png'),  color: '#F59E0B', bg: '#FEF3C7' },
            medicamento: { label: 'Medicamento',  icon: require('../../../assets/icon_medicine.png'), color: '#EC4899', bg: '#FCE7F3' },
            alergia:     { label: 'Alergia',      icon: require('../../../assets/icon_warning.png'),  color: '#EF4444', bg: '#FFE4E6' },
            outro:       { label: 'Outro',        icon: require('../../../assets/icon_medical.png'),  color: '#64748B', bg: '#F1F5F9' },
          };
          const apptTypes = {
            consulta: { label: 'Consulta', color: '#0EA5E9', bg: '#EFF6FF' },
            retorno:  { label: 'Retorno',  color: '#10B981', bg: '#DCFCE7' },
            cirurgia: { label: 'Cirurgia', color: '#8B5CF6', bg: '#EDE9FE' },
            exame:    { label: 'Exame',    color: '#F59E0B', bg: '#FEF3C7' },
            outro:    { label: 'Outro',    color: '#64748B', bg: '#F1F5F9' },
          };

          return (
            <View style={styles.tabContent}>

              {/* ── Veterinários vinculados ── */}
              <View style={styles.vetSectionHeader}>
                <Image source={require('../../../assets/icon_medical.png')} style={{ width: 16, height: 16 }} resizeMode="contain" />
                <Text style={styles.vetSectionTitle}>Veterinários vinculados</Text>
                {vetLinks.length > 0 && (
                  <View style={styles.vetSectionBadge}>
                    <Text style={styles.vetSectionBadgeText}>{vetLinks.length}</Text>
                  </View>
                )}
              </View>

              {vetLinks.length > 0 ? (
                <View style={styles.vetLinksMini}>
                  {vetLinks.map(link => {
                    const vet = link.vet_profiles;
                    return (
                      <View key={link.id} style={styles.vetLinkMiniCard}>
                        <View style={styles.vetLinkMiniIcon}>
                          <Image source={require('../../../assets/icon_medical.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.vetLinkMiniName}>{vet?.full_name || 'Veterinário'}</Text>
                          <Text style={styles.vetLinkMiniCrm}>CRM {vet?.crm}/{vet?.estado}{vet?.specialty ? ` · ${vet.specialty}` : ''}</Text>
                        </View>
                        {vet?.chat_enabled && (
                          <TouchableOpacity
                            style={{ backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 }}
                            onPress={() => navigation.navigate('TutorChat', { petId, petName: pet.name, vetId: link.vet_id, vetName: vet.full_name })}
                            hitSlop={{top:4,bottom:4,left:4,right:4}}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#D97706' }}>💬 Chat</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => handleRemoveVet(link)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                          <Image source={require('../../../assets/icon_trash.png')} style={{ width: 18, height: 18, tintColor: '#EF4444' }} resizeMode="contain" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.vetLinksEmpty}>
                  <Text style={styles.vetLinksEmptyText}>
                    Nenhum veterinário vinculado · Compartilhe o código{' '}
                    <Text style={{ color: '#0EA5E9', fontWeight: '700' }}>{petId.split('-')[0].toUpperCase()}</Text>
                  </Text>
                </View>
              )}

              {/* ── Sub-abas: Registros / Agendamentos ── */}
              <View style={styles.vetSubTabBar}>
                {[
                  { key: 'registros',    label: 'Registros',    count: vetRecords.length },
                  { key: 'agendamentos', label: 'Agendamentos', count: allAppts.length, dot: upcomingAppts.length > 0 },
                ].map(st => (
                  <TouchableOpacity
                    key={st.key}
                    style={[styles.vetSubTab, vetSubTab === st.key && styles.vetSubTabActive]}
                    onPress={() => setVetSubTab(st.key)}
                    activeOpacity={0.8}
                  >
                    {vetSubTab === st.key ? (
                      <LinearGradient
                        colors={['#0EA5E9', '#38BDF8']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.vetSubTabPill}
                      >
                        <Text style={styles.vetSubTabTextActive}>
                          {st.label}{st.count > 0 ? ` (${st.count})` : ''}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.vetSubTabPillInactive}>
                        <Text style={styles.vetSubTabText}>
                          {st.label}{st.count > 0 ? ` (${st.count})` : ''}
                        </Text>
                        {st.dot && <View style={styles.vetSubTabDot} />}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Conteúdo: Registros ── */}
              {vetSubTab === 'registros' && (
                vetRecords.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Image source={require('../../../assets/icon_medical.png')} style={{ width: 44, height: 44, marginBottom: 10, opacity: 0.35 }} resizeMode="contain" />
                    <Text style={styles.emptyText}>Nenhum registro veterinário ainda</Text>
                    <Text style={styles.emptySubText}>
                      Consultas, prescrições e exames{'\n'}registrados pelo veterinário aparecerão aqui
                    </Text>
                  </View>
                ) : (
                  vetRecords.map(r => {
                    const cfg = typeConfig[r.type] || typeConfig.outro;
                    return (
                      <View key={r.id} style={styles.vetRecordCard}>
                        <View style={styles.vetRecordTop}>
                          <View style={[styles.vetRecordIconWrap, { backgroundColor: cfg.bg }]}>
                            <Image source={cfg.icon} style={{ width: 20, height: 20 }} resizeMode="contain" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.vetRecordTitle}>{r.title}</Text>
                            <Text style={styles.vetRecordMeta}>
                              {cfg.label}
                              {r.veterinarian ? ` · Dr(a). ${r.veterinarian}` : ''}
                              {' · '}{formatDate(r.date)}
                            </Text>
                          </View>
                          <View style={[styles.vetRecordTypeBadge, { backgroundColor: cfg.bg }]}>
                            <Text style={[styles.vetRecordTypeText, { color: cfg.color }]}>{cfg.label}</Text>
                          </View>
                        </View>
                        {r.description && <Text style={styles.vetRecordField}>{r.description}</Text>}
                        {r.diagnosis && (
                          <View style={styles.vetRecordDetail}>
                            <Text style={styles.vetRecordDetailLabel}>Diagnóstico</Text>
                            <Text style={styles.vetRecordDetailValue}>{r.diagnosis}</Text>
                          </View>
                        )}
                        {r.prescription && (
                          <View style={[styles.vetRecordDetail, { backgroundColor: '#FCE7F3', borderColor: '#FBCFE8' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                            <Image source={require('../../../assets/icon_medicine.png')} style={{ width: 13, height: 13 }} resizeMode="contain" />
                            <Text style={[styles.vetRecordDetailLabel, { color: '#BE185D', marginBottom: 0 }]}>Prescrição</Text>
                          </View>
                            <Text style={styles.vetRecordDetailValue}>{r.prescription}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                )
              )}

              {/* ── Conteúdo: Agendamentos ── */}
              {vetSubTab === 'agendamentos' && (
                <>
                  {/* Botão Solicitar Consulta (só se tiver vet vinculado) */}
                  {vetLinks.length > 0 && (
                    <View style={{ marginBottom: 14 }}>
                      {vetLinks.map(link => (
                        <TouchableOpacity
                          key={link.id}
                          style={styles.apptRequestBtn}
                          onPress={() => openApptRequest(link)}
                          activeOpacity={0.82}
                        >
                          <LinearGradient colors={['#0284C7', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.apptRequestBtnGrad}>
                            <Image source={require('../../../assets/icon_late.png')} style={{ width: 16, height: 16, marginRight: 8 }} resizeMode="contain" />
                            <Text style={styles.apptRequestBtnTxt}>
                              Solicitar consulta{link.vet_profiles?.full_name ? ` — Dr(a). ${link.vet_profiles.full_name.split(' ')[0]}` : ''}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {upcomingAppts.length > 0 && (
                    <>
                      <Text style={styles.apptSectionLabel}>Próximos / Pendentes</Text>
                      {upcomingAppts.map(a => {
                        const cfg = apptTypes[a.type] || apptTypes.outro;
                        const [y, m, d] = (a.scheduled_date || '').split('-');
                        const vetProf = apptVetProfiles[a.vet_id];
                        const isPending = a.status === 'pending_approval';
                        return (
                          <TouchableOpacity
                            key={a.id}
                            style={[styles.apptCard, isPending && { borderColor: '#F59E0B', borderWidth: 1.5 }]}
                            onPress={() => setSelectedAppt({ ...a, vet: vetProf })}
                            activeOpacity={0.8}
                          >
                            <View style={styles.apptCardTop}>
                              <View style={[styles.apptTypeBadge, { backgroundColor: cfg.bg }]}>
                                <Text style={[styles.apptTypeText, { color: cfg.color }]}>{cfg.label}</Text>
                              </View>
                              {isPending ? (
                                <View style={{ backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FDE68A' }}>
                                  <Text style={{ fontSize: 11, color: '#B45309', fontWeight: '700' }}>Aguardando confirmação</Text>
                                </View>
                              ) : (
                                <Text style={styles.apptDateText}>
                                  📅 {d}/{m}/{y}{a.scheduled_time ? ` às ${a.scheduled_time.slice(0, 5)}` : ''}
                                </Text>
                              )}
                              <Text style={styles.apptArrow}>›</Text>
                            </View>
                            {isPending && <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>📅 {d}/{m}/{y}{a.scheduled_time ? ` às ${a.scheduled_time.slice(0, 5)}` : ''}</Text>}
                            {vetProf?.full_name && <Text style={styles.apptVetName}>Dr(a). {vetProf.full_name}</Text>}
                            {vetProf?.clinic_name && <Text style={styles.apptClinic}>{vetProf.clinic_name}</Text>}
                            {a.notes && <Text style={styles.apptNotes} numberOfLines={2}>{a.notes}</Text>}
                            {a.request_message && <Text style={[styles.apptNotes, { color: '#B45309' }]} numberOfLines={2}>Mensagem: {a.request_message}</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}

                  {pastAppts.length > 0 && (
                    <>
                      <Text style={[styles.apptSectionLabel, { color: '#94A3B8', marginTop: upcomingAppts.length > 0 ? 18 : 8 }]}>Anteriores</Text>
                      {pastAppts.map(a => {
                        const cfg = apptTypes[a.type] || apptTypes.outro;
                        const [y, m, d] = (a.scheduled_date || '').split('-');
                        const vetProf = apptVetProfiles[a.vet_id];
                        return (
                          <TouchableOpacity
                            key={a.id}
                            style={[styles.apptCard, { opacity: 0.6 }]}
                            onPress={() => setSelectedAppt({ ...a, vet: vetProf })}
                            activeOpacity={0.8}
                          >
                            <View style={styles.apptCardTop}>
                              <View style={[styles.apptTypeBadge, { backgroundColor: cfg.bg }]}>
                                <Text style={[styles.apptTypeText, { color: cfg.color }]}>{cfg.label}</Text>
                              </View>
                              <Text style={styles.apptDateText}>📅 {d}/{m}/{y}{a.scheduled_time ? ` às ${a.scheduled_time.slice(0, 5)}` : ''}</Text>
                              <Text style={styles.apptArrow}>›</Text>
                            </View>
                            {vetProf?.full_name && <Text style={styles.apptVetName}>Dr(a). {vetProf.full_name}</Text>}
                            {vetProf?.clinic_name && <Text style={styles.apptClinic}>{vetProf.clinic_name}</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}

                  {allAppts.length === 0 && (
                    <View style={styles.emptyCard}>
                      <Text style={{ fontSize: 36, marginBottom: 10 }}>📅</Text>
                      <Text style={styles.emptyText}>Nenhum agendamento ainda</Text>
                      <Text style={styles.emptySubText}>
                        {vetLinks.length > 0
                          ? 'Solicite uma consulta acima ou aguarde o veterinário agendar'
                          : 'Quando o veterinário agendar uma consulta ou procedimento, aparecerá aqui'}
                      </Text>
                    </View>
                  )}
                </>
              )}

            </View>
          );
        })()}
      </ScrollView>

      {/* ── Modal editar info do pet ── */}
      <Modal visible={editingInfo} transparent animationType="slide" onRequestClose={() => setEditingInfo(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setEditingInfo(false)} />
          <View style={[styles.modalCard, { borderRadius: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' }]}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>✏️ Editar informações</Text>
              <TouchableOpacity onPress={() => setEditingInfo(false)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                <Text style={{ fontSize: 18, color: '#94A3B8' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
              {/* Nome */}
              <Text style={styles.modalLabel}>Nome *</Text>
              <TextInput style={styles.modalInput} value={infoForm.name} onChangeText={v => setInfoForm(p => ({...p, name: v}))} placeholder="Nome do pet" placeholderTextColor="#9CA3AF" />

              {/* Raça */}
              <Text style={styles.modalLabel}>Raça</Text>
              <TextInput style={styles.modalInput} value={infoForm.breed} onChangeText={v => setInfoForm(p => ({...p, breed: v}))} placeholder="Ex: Labrador, SRD..." placeholderTextColor="#9CA3AF" />

              {/* Nascimento */}
              <Text style={styles.modalLabel}>Data de nascimento</Text>
              <DatePickerInput
                value={infoForm.birth_date}
                onChangeText={v => setInfoForm(p => ({ ...p, birth_date: v }))}
                label="Data de nascimento"
                isBirthDate
              />

              {/* Pelagem */}
              <Text style={styles.modalLabel}>Cor / Pelagem</Text>
              <TextInput style={styles.modalInput} value={infoForm.coat_color} onChangeText={v => setInfoForm(p => ({...p, coat_color: v}))} placeholder="Ex: Caramelo, Preto e branco..." placeholderTextColor="#9CA3AF" />

              {/* Sexo */}
              <Text style={styles.modalLabel}>Sexo</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {['Macho', 'Fêmea'].map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.modalInput, { flex: 1, alignItems: 'center', paddingVertical: 12, borderColor: infoForm.sex === s ? '#0EA5E9' : '#E0F2FE', backgroundColor: infoForm.sex === s ? '#EFF6FF' : '#F8FAFC' }]}
                    onPress={() => setInfoForm(p => ({...p, sex: p.sex === s ? '' : s}))}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: infoForm.sex === s ? '#0EA5E9' : '#64748B' }}>{s === 'Macho' ? '♂ Macho' : '♀ Fêmea'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Castrado */}
              <TouchableOpacity
                style={[styles.modalInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, borderColor: infoForm.neutered ? '#0EA5E9' : '#E0F2FE', backgroundColor: infoForm.neutered ? '#EFF6FF' : '#F8FAFC' }]}
                onPress={() => setInfoForm(p => ({...p, neutered: !p.neutered}))}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E293B' }}>✂️ Castrado(a)</Text>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: infoForm.neutered ? '#0EA5E9' : '#CBD5E1', backgroundColor: infoForm.neutered ? '#0EA5E9' : '#fff', justifyContent: 'center', alignItems: 'center' }}>
                  {infoForm.neutered && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                </View>
              </TouchableOpacity>

              {/* Peso */}
              <Text style={styles.modalLabel}>Peso (kg)</Text>
              <TextInput style={styles.modalInput} value={infoForm.weight_kg} onChangeText={v => setInfoForm(p => ({...p, weight_kg: v}))} placeholder="Ex: 8,5" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />

              <View style={[styles.modalBtns, { marginTop: 20 }]}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingInfo(false)}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveBtnWrap} onPress={saveInfo} disabled={savingInfo}>
                  <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.modalSaveBtn}>
                    {savingInfo ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSaveText}>Salvar</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal confirmar exclusão ── */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' }}>
            <Image source={require('../../../assets/icon_trash.png')} style={{ width: 52, height: 52, marginBottom: 12, tintColor: '#EF4444' }} resizeMode="contain" />
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 8 }}>Remover {pet?.name}?</Text>
            <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Todo o histórico de vacinas, gastos e registros médicos será permanentemente removido.
            </Text>
            <TouchableOpacity
              style={{ width: '100%', backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 }}
              onPress={handleDeleteConfirm}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Sim, remover pet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: '100%', backgroundColor: '#F1F5F9', borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
              onPress={() => setShowDeleteConfirm(false)}
            >
              <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '700' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de edição de saúde */}
      <Modal visible={editingHealth} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🌿 Saúde e bem-estar</Text>
            <Text style={styles.modalSubtitle}>Essas informações ajudam o veterinário a cuidar melhor do {pet.name} 💙</Text>

            <Text style={styles.modalLabel}>Condições de saúde</Text>
            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={3}
              placeholder="Alergias, condições especiais, cuidados importantes..."
              placeholderTextColor="#9CA3AF"
              value={healthForm.health_notes}
              onChangeText={v => setHealthForm(prev => ({ ...prev, health_notes: v }))}
            />

            <Text style={styles.modalLabel}>Medicamentos em uso</Text>
            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={3}
              placeholder="Nome do medicamento, dosagem, frequência..."
              placeholderTextColor="#9CA3AF"
              value={healthForm.medications}
              onChangeText={v => setHealthForm(prev => ({ ...prev, medications: v }))}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingHealth(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtnWrap} onPress={saveHealth} disabled={savingHealth}>
                <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modalSaveBtn}>
                  {savingHealth
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.modalSaveText}>Salvar</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal confirmar remoção de veterinário ── */}
      {/* ── Modal de exportação PDF ── */}
      <Modal visible={showExportModal} transparent animationType="slide" onRequestClose={() => setShowExportModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowExportModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40 }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20 }} />

              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 6 }}>
                {exportType === 'health' ? 'Relatório de Saúde' : 'Relatório de Gastos'}
              </Text>
              <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 18 }}>
                {exportType === 'health'
                  ? 'Exporta vacinas, peso, histórico médico e registros veterinários. Ideal para apresentar em consultas.'
                  : 'Exporta todos os gastos do pet no período escolhido, com totais por categoria.'}
              </Text>

              {/* Seletor de tipo */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                {[{ key: 'health', label: 'Saúde' }, { key: 'expenses', label: 'Gastos' }].map(t => (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setExportType(t.key)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                      backgroundColor: exportType === t.key ? '#0EA5E9' : '#F1F5F9',
                    }}
                  >
                    <Text style={{ fontWeight: '700', fontSize: 14, color: exportType === t.key ? '#fff' : '#64748B' }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Período (só para gastos) */}
              {exportType === 'expenses' && (
                <View style={{ gap: 12, marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151' }}>Período</Text>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>De</Text>
                      <DatePickerInput value={exportStart.split('-').reverse().join('/')} onChangeText={v => { const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (m) setExportStart(`${m[3]}-${m[2]}-${m[1]}`); }} label="Data inicial" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Até</Text>
                      <DatePickerInput value={exportEnd.split('-').reverse().join('/')} onChangeText={v => { const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (m) setExportEnd(`${m[3]}-${m[2]}-${m[1]}`); }} label="Data final" />
                    </View>
                  </View>
                </View>
              )}

              <TouchableOpacity
                onPress={handleExport}
                disabled={exportGenerating}
                style={{ borderRadius: 16, overflow: 'hidden' }}
              >
                <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center' }}>
                  {exportGenerating
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Gerar e exportar PDF</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowExportModal(false)} style={{ alignItems: 'center', marginTop: 12 }}>
                <Text style={{ color: '#94A3B8', fontWeight: '600', fontSize: 14 }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!removeVetLink} transparent animationType="fade" onRequestClose={() => setRemoveVetLink(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' }}>
            <Image source={require('../../../assets/icon_medical.png')} style={{ width: 52, height: 52, marginBottom: 14, opacity: 0.5 }} resizeMode="contain" />
            <Text style={{ fontSize: 19, fontWeight: '800', color: '#1E293B', marginBottom: 8, textAlign: 'center' }}>
              Remover acesso?
            </Text>
            <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Dr(a). <Text style={{ fontWeight: '700', color: '#1E293B' }}>{removeVetLink?.vet_profiles?.full_name || 'Veterinário'}</Text>
              {' '}perderá acesso ao histórico de{' '}
              <Text style={{ fontWeight: '700', color: '#1E293B' }}>{pet?.name}</Text>.
            </Text>
            <TouchableOpacity
              style={{ width: '100%', backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 }}
              onPress={confirmRemoveVet}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Sim, desconectar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: '100%', backgroundColor: '#F1F5F9', borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
              onPress={() => setRemoveVetLink(null)}
            >
              <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '700' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal detalhe do agendamento ── */}
      <Modal visible={!!selectedAppt} transparent animationType="slide" onRequestClose={() => setSelectedAppt(null)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setSelectedAppt(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40 }}>
              {/* Handle */}
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20 }} />

              {selectedAppt && (() => {
                const apptTypes2 = {
                  consulta: { label: 'Consulta', color: '#0EA5E9', bg: '#EFF6FF' },
                  retorno:  { label: 'Retorno',  color: '#10B981', bg: '#DCFCE7' },
                  cirurgia: { label: 'Cirurgia', color: '#8B5CF6', bg: '#EDE9FE' },
                  exame:    { label: 'Exame',    color: '#F59E0B', bg: '#FEF3C7' },
                  outro:    { label: 'Outro',    color: '#64748B', bg: '#F1F5F9' },
                };
                const cfg = apptTypes2[selectedAppt.type] || apptTypes2.outro;
                const [y, m, d] = selectedAppt.scheduled_date.split('-');
                const vet = selectedAppt.vet;
                const isPast = new Date(selectedAppt.scheduled_date) < new Date(new Date().toDateString());
                return (
                  <>
                    {/* Tipo + status */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                      <View style={[styles.apptTypeBadge, { backgroundColor: cfg.bg, paddingHorizontal: 14, paddingVertical: 8 }]}>
                        <Text style={[styles.apptTypeText, { color: cfg.color, fontSize: 14 }]}>{cfg.label}</Text>
                      </View>
                      {isPast && (
                        <View style={{ backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>Realizado</Text>
                        </View>
                      )}
                    </View>

                    {/* Data e hora */}
                    <View style={styles.apptDetailRow}>
                      <Image source={require('../../../assets/icon_late.png')} style={styles.apptDetailIcon} resizeMode="contain" />
                      <View>
                        <Text style={styles.apptDetailLabel}>Data e horário</Text>
                        <Text style={styles.apptDetailValue}>
                          {d}/{m}/{y}{selectedAppt.scheduled_time ? ` às ${selectedAppt.scheduled_time}` : ' — Horário não informado'}
                        </Text>
                      </View>
                    </View>

                    {/* Veterinário */}
                    {vet && (
                      <View style={styles.apptDetailRow}>
                        <Image source={require('../../../assets/icon_medical.png')} style={styles.apptDetailIcon} resizeMode="contain" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.apptDetailLabel}>Veterinário</Text>
                          <Text style={styles.apptDetailValue}>
                            Dr(a). {vet.full_name}
                          </Text>
                          {(vet.crm || vet.estado) && (
                            <Text style={{ fontSize: 12, color: '#0EA5E9', fontWeight: '600', marginTop: 1 }}>
                              CRM {vet.crm}/{vet.estado}{vet.specialty ? ` · ${vet.specialty}` : ''}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Clínica */}
                    {vet?.clinic_name && (
                      <View style={styles.apptDetailRow}>
                        <Image source={require('../../../assets/icon_home.png')} style={styles.apptDetailIcon} resizeMode="contain" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.apptDetailLabel}>Clínica</Text>
                          <Text style={styles.apptDetailValue}>{vet.clinic_name}</Text>
                          {vet.clinic_address && (
                            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{vet.clinic_address}</Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Instruções */}
                    {selectedAppt.notes && (
                      <View style={[styles.apptDetailRow, { backgroundColor: '#F0F9FF', borderRadius: 14, padding: 14, borderWidth: 0 }]}>
                        <Image source={require('../../../assets/icon_doc.png')} style={styles.apptDetailIcon} resizeMode="contain" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.apptDetailLabel}>Instruções</Text>
                          <Text style={styles.apptDetailValue}>{selectedAppt.notes}</Text>
                        </View>
                      </View>
                    )}

                    <TouchableOpacity
                      style={{ marginTop: 20, backgroundColor: '#F1F5F9', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
                      onPress={() => setSelectedAppt(null)}
                    >
                      <Text style={{ color: '#64748B', fontWeight: '700', fontSize: 15 }}>Fechar</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal solicitar consulta ── */}
      <Modal visible={showApptRequest} transparent animationType="slide" onRequestClose={() => setShowApptRequest(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowApptRequest(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <ScrollView style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }} keyboardShouldPersistTaps="handled">
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 16 }} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 4 }}>Solicitar Consulta</Text>
              {apptRequestVet?.vet_profiles?.full_name && (
                <Text style={{ fontSize: 13, color: '#0EA5E9', fontWeight: '600', marginBottom: 16 }}>Dr(a). {apptRequestVet.vet_profiles.full_name}{apptRequestVet.vet_profiles.clinic_name ? ` · ${apptRequestVet.vet_profiles.clinic_name}` : ''}</Text>
              )}

              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Tipo de atendimento</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {[{k:'consulta',l:'Consulta'},{k:'retorno',l:'Retorno'},{k:'exame',l:'Exame'},{k:'vacinacao',l:'Vacinação'},{k:'outro',l:'Outro'}].map(t => (
                  <TouchableOpacity key={t.k} onPress={() => setApptRequestForm(p => ({ ...p, type: t.k }))}
                    style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, backgroundColor: apptRequestForm.type === t.k ? '#EFF6FF' : '#F1F5F9', borderWidth: 1.5, borderColor: apptRequestForm.type === t.k ? '#0EA5E9' : '#E2E8F0' }}>
                    <Text style={{ fontSize: 13, fontWeight: apptRequestForm.type === t.k ? '800' : '600', color: apptRequestForm.type === t.k ? '#0EA5E9' : '#64748B' }}>{t.l}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Data preferida *</Text>
              <DatePickerInput value={apptRequestForm.date} onChangeText={v => setApptRequestForm(p => ({ ...p, date: v }))} label="Data preferida" />

              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 16 }}>Horário preferido</Text>
              <TextInput
                style={{ backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B' }}
                value={apptRequestForm.time}
                onChangeText={v => setApptRequestForm(p => ({ ...p, time: v }))}
                placeholder="Ex: 14:30 (opcional)"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 16 }}>Mensagem para o veterinário</Text>
              <TextInput
                style={{ backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B', minHeight: 80, textAlignVertical: 'top' }}
                value={apptRequestForm.message}
                onChangeText={v => setApptRequestForm(p => ({ ...p, message: v }))}
                placeholder="Descreva o motivo da consulta..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity style={{ borderRadius: 16, overflow: 'hidden', marginTop: 20 }} onPress={submitApptRequest} disabled={apptRequestSaving}>
                <LinearGradient colors={['#0284C7', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center' }}>
                  {apptRequestSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Enviar solicitação</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowApptRequest(false)} style={{ alignItems: 'center', paddingVertical: 16, marginBottom: 20 }}>
                <Text style={{ color: '#94A3B8', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewerBanner: {
    backgroundColor: '#FEF9C3', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  viewerBannerText: { fontSize: 12, color: '#B45309', fontWeight: '600', textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFF6FF' },
  backBtn: { marginRight: 12, padding: 4 },
  backIcon: { fontSize: 22, color: '#0EA5E9' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1E293B' },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerBtn: { padding: 4 },

  content: { paddingBottom: 40 },

  petCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 24,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 6,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#E0F2FE',
  },

  petTop: { flexDirection: 'row', padding: 16, alignItems: 'flex-start', gap: 14 },
  petAvatarBtn: { position: 'relative', width: 76, height: 76 },
  petAvatarWrap: { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#BFDBFE' },
  petPhoto: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: '#BFDBFE' },
  photoOverlay: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#0EA5E9', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  photoOverlayText: { fontSize: 12 },
  petEmoji: { fontSize: 38 },
  petMeta: { flex: 1, paddingTop: 2 },
  petNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  editInfoBtn: { padding: 4, backgroundColor: '#EFF6FF', borderRadius: 8 },
  editInfoIcon: { fontSize: 14 },
  petName: { fontSize: 22, fontWeight: '900', color: '#1E293B' },
  ageTagBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  ageTagText: { fontSize: 12, fontWeight: '700' },
  petTutorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  petTutorText: { fontSize: 12, color: '#94A3B8' },

  infoGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingHorizontal: 12, paddingVertical: 12,
    gap: 0,
  },
  infoCell: {
    width: '33.33%', paddingHorizontal: 6, paddingVertical: 8,
  },
  infoCellLabel: {
    fontSize: 9, fontWeight: '800', color: '#94A3B8',
    letterSpacing: 0.8, marginBottom: 3,
  },
  infoCellValue: {
    fontSize: 13, fontWeight: '700', color: '#1E293B',
  },

  cardActionsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  qrActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EFF6FF', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  qrActionText: { fontSize: 13, fontWeight: '700', color: '#0284C7' },
  codeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F8FAFC', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  codeBadgeCopied: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  codeValue: { fontSize: 12, fontWeight: '800', color: '#374151', letterSpacing: 0.5 },
  codeCopy: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  codeCopiedText: { color: '#16A34A' },

  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FAFCFF' },
  statBox: { flex: 1, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  statBoxBorder: { borderLeftWidth: 1, borderLeftColor: '#F1F5F9' },
  statIconBubble: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', textAlign: 'center', letterSpacing: 0.2 },
  statValue: { fontSize: 15, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  statValueSm: { fontSize: 12 },

  // Saúde
  healthSection: { borderTopWidth: 1, borderTopColor: '#EFF6FF', padding: 14, gap: 10 },
  healthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  healthIcon: { width: 20, height: 20, marginTop: 1, marginRight: 2 },
  healthLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  healthValue: { fontSize: 13, color: '#374151', lineHeight: 19 },
  healthEditLink: { alignSelf: 'flex-end' },
  healthEditText: { fontSize: 12, color: '#0EA5E9', fontWeight: '600' },
  healthAddBtn: { borderTopWidth: 1, borderTopColor: '#EFF6FF', padding: 14, alignItems: 'center' },
  healthAddText: { fontSize: 13, color: '#0EA5E9', fontWeight: '600' },

  tabBar: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EFF6FF',
    backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 8, gap: 4,
  },
  tabBtn: { flex: 1, alignItems: 'center' },
  tabBtnActive: {},
  tabBtnPill: {
    borderRadius: 20, paddingVertical: 7, paddingHorizontal: 6,
    alignItems: 'center', width: '100%',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  tabBtnPillInactive: {
    borderRadius: 20, paddingVertical: 7, paddingHorizontal: 6,
    alignItems: 'center', width: '100%',
    backgroundColor: 'transparent',
  },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  tabBtnTextActive: { fontSize: 12, fontWeight: '700', color: '#fff' },

  tabContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  exportRow: { flexDirection: 'row', gap: 10, marginBottom: 16, marginTop: 8 },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F0F9FF', borderRadius: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#BAE6FD',
  },
  exportBtnText: { fontSize: 12, fontWeight: '700', color: '#0284C7' },
  tabContentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  tabContentTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginTop: 4, marginBottom: 12 },
  tabContentAdd: {
    fontSize: 13, fontWeight: '700', color: '#0EA5E9',
    backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },

  // Vaccine cards
  vaccineCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#F0F9FF' },
  vaccineCardPending: { borderColor: '#EFF6FF', borderLeftWidth: 3, borderLeftColor: '#BAE6FD' },
  vaccineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, marginRight: 12, flexShrink: 0 },
  vaccineCardContent: { flex: 1 },
  vaccineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  vaccineCardName: { fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1 },
  vaccineCardDesc: { fontSize: 12, color: '#64748B', lineHeight: 17, marginBottom: 10 },
  vaccineAppliedInfo: { gap: 4 },
  vaccineAppliedDate: { fontSize: 12, color: '#16A34A', fontWeight: '600' },
  vaccineNextDate: { fontSize: 11, color: '#64748B' },
  vaccineNextDateLate: { color: '#EF4444' },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  registerBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 2 },
  registerBtnGrad: { paddingVertical: 9, alignItems: 'center' },
  registerBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Timeline
  timelineItem: { flexDirection: 'row', marginBottom: 4 },
  timelineDotWrap: { alignItems: 'center', width: 20, marginRight: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0EA5E9', marginTop: 14 },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#E0F2FE', marginTop: 2 },
  timelineContent: { flex: 1, paddingBottom: 12 },
  timelineDate: { fontSize: 11, color: '#94A3B8', marginTop: 12, marginBottom: 4 },
  timelineCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  timelineIcon: { fontSize: 20 },
  timelineTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  timelineSubtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // Evolução
  chartCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  addWeightBtnWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  addWeightBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  addWeightBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  viewHistoryLink: { textAlign: 'center', color: '#0EA5E9', fontWeight: '600', fontSize: 14, paddingVertical: 4 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 18, padding: 32, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#94A3B8' },

  // Modal saúde
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 420 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 19 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  modalInput: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: '#E0F2FE', padding: 14, fontSize: 14, color: '#1E293B', textAlignVertical: 'top', marginBottom: 16, minHeight: 80 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { color: '#64748B', fontWeight: '700' },
  modalSaveBtnWrap: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  modalSaveBtn: { paddingVertical: 14, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Aba Veterinários
  petIdCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 20,
    borderWidth: 1.5, borderColor: '#BAE6FD',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  petIdTop: { marginBottom: 12 },
  petIdLabel: { fontSize: 13, fontWeight: '800', color: '#0EA5E9', textTransform: 'uppercase', letterSpacing: 0.8 },
  petIdSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  petIdBox: { backgroundColor: '#F0F9FF', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#E0F2FE' },
  petIdValue: { fontSize: 12, color: '#374151', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 0.5 },
  petIdCopyBtn: { borderRadius: 14, overflow: 'hidden' },
  petIdCopyGrad: { paddingVertical: 13, alignItems: 'center' },
  petIdCopyText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  countBadge: { backgroundColor: '#E0F2FE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  countBadgeTxt: { fontSize: 12, fontWeight: '700', color: '#0369A1' },
  emptySubText: { fontSize: 12, color: '#BAE6FD', marginTop: 4, textAlign: 'center' },

  vetLinkCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#EFF6FF',
  },
  vetLinkIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  vetLinkInfo: { flex: 1 },
  vetLinkName: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  vetLinkCrm: { fontSize: 12, color: '#0EA5E9', fontWeight: '600', marginTop: 2 },
  vetLinkSpec: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  vetLinkRemoveBtn: { padding: 8 },

  // Cabeçalho da seção vets
  vetSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10, marginTop: 4,
  },
  vetSectionTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B', flex: 1 },
  vetSectionBadge: { backgroundColor: '#E0F2FE', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  vetSectionBadgeText: { fontSize: 11, fontWeight: '700', color: '#0369A1' },

  // Vet links mini (no topo da aba vets)
  vetLinksMini: { marginBottom: 14 },
  vetLinkMiniCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F0F9FF', borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: '#BAE6FD',
  },
  vetLinkMiniIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },
  vetLinkMiniName: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  vetLinkMiniCrm: { fontSize: 11, color: '#0EA5E9', fontWeight: '600', marginTop: 1 },
  vetLinksEmpty: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  vetLinksEmptyText: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },

  // Sub-abas da aba Vets
  vetSubTabBar: {
    flexDirection: 'row', borderRadius: 16, backgroundColor: '#F0F9FF',
    padding: 4, marginBottom: 16, gap: 4,
    borderWidth: 1, borderColor: '#E0F2FE',
  },
  vetSubTab: { flex: 1, alignItems: 'center' },
  vetSubTabActive: {},
  vetSubTabPill: {
    borderRadius: 12, paddingVertical: 9, width: '100%', alignItems: 'center',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  vetSubTabPillInactive: {
    borderRadius: 12, paddingVertical: 9, width: '100%', alignItems: 'center',
    position: 'relative',
  },
  vetSubTabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  vetSubTabTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },
  vetSubTabDot: { position: 'absolute', top: 6, right: 14, width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },

  // Cards de agendamento (visão tutor)
  apptSectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  apptRequestBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  apptRequestBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16 },
  apptRequestBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },

  apptCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#EDE9FE',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  apptCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  apptTypeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  apptTypeText: { fontSize: 12, fontWeight: '700' },
  apptDateText: { fontSize: 13, color: '#374151', fontWeight: '600', flex: 1 },
  apptArrow: { fontSize: 16, color: '#BAE6FD', marginLeft: 4 },
  apptVetName: { fontSize: 12, color: '#0EA5E9', marginTop: 6, fontWeight: '700' },
  apptClinic: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  apptNotes: { fontSize: 13, color: '#64748B', marginTop: 6, lineHeight: 19 },

  // Modal detalhe agendamento
  apptDetailRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  apptDetailIcon: { width: 22, height: 22, marginTop: 2 },
  apptDetailLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  apptDetailValue: { fontSize: 15, fontWeight: '700', color: '#1E293B' },

  // Registros veterinários (aba Vets)
  vetRecordCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#EFF6FF',
  },
  vetRecordTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  vetRecordIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  vetRecordTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  vetRecordMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  vetRecordTypeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  vetRecordTypeText: { fontSize: 10, fontWeight: '700' },
  vetRecordField: { fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 6 },
  vetRecordDetail: {
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  vetRecordDetailLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 3 },
  vetRecordDetailValue: { fontSize: 13, color: '#1E293B', lineHeight: 18 },
});
