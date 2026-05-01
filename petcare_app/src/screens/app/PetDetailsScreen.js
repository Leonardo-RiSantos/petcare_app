import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  ActivityIndicator, Alert, RefreshControl, Image, TextInput, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import WeightChart from '../../components/WeightChart';

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
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

function TimelineItem({ item }) {
  const emojiIcons = { vaccine: '💉', expense: '💰', weight: '⚖️' };
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDotWrap}>
        <View style={styles.timelineDot} />
        <View style={styles.timelineLine} />
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineDate}>{item.displayDate}</Text>
        <View style={styles.timelineCard}>
          {item.type === 'medical'
            ? <Image source={require('../../../assets/icon_medical.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
            : <Text style={styles.timelineIcon}>{emojiIcons[item.type] || '📋'}</Text>}
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

  // Foto do pet
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fetchData = async () => {
    const [petRes, vacRes, expRes, wRes, medRes, profileRes] = await Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase.from('vaccines').select('*').eq('pet_id', petId).order('applied_date', { ascending: false }),
      supabase.from('expenses').select('*').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('weight_records').select('*').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('medical_records').select('*').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
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
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleDelete = () => {
    Alert.alert('Remover pet', `Deseja remover ${pet?.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        await supabase.from('pets').delete().eq('id', petId);
        navigation.goBack();
      }},
    ]);
  };

  const handleRegisterVaccine = (vaccineName) => {
    navigation.navigate('AddVaccine', { petId, petName: pet.name, petSpecies: pet.species, prefillName: vaccineName });
  };

  const handlePhotoUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria para adicionar a foto do pet.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;

    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const filePath = `${user.id}/${petId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('pet-photos')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pet-photos')
        .getPublicUrl(filePath);

      await supabase.from('pets').update({ photo_url: publicUrl }).eq('id', petId);
      setPet(prev => ({ ...prev, photo_url: publicUrl }));
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível fazer upload da foto. Verifique se criou o bucket pet-photos no Supabase.');
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

  const age = calcAge(pet.birth_date);
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pet.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('PetQR', { petId })}>
            <Image source={require('../../../assets/icon_doc.png')} style={{ width: 26, height: 26 }} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleDelete}>
            <Image source={require('../../../assets/icon_trash.png')} style={{ width: 26, height: 26 }} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
      >
        {/* Card principal */}
        <View style={styles.petCard}>
          {/* Avatar + info */}
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
              <Text style={styles.petName}>{pet.name}</Text>
              <View style={styles.petTagsRow}>
                {pet.species && <View style={styles.petTag}><Text style={styles.petTagText}>{pet.species}</Text></View>}
                {pet.breed && <View style={styles.petTag}><Text style={styles.petTagText}>{pet.breed}</Text></View>}
                {pet.neutered && <View style={[styles.petTag, styles.petTagBlue]}><Text style={[styles.petTagText, { color: '#0369A1' }]}>Castrado</Text></View>}
              </View>
              <Text style={styles.petInfoRow}>
                {age ? `Idade: ${age}` : ''}
                {age && pet.birth_date ? '  •  ' : ''}
                {pet.birth_date ? `Nasc.: ${formatDate(pet.birth_date)}` : ''}
              </Text>
              {tutorName ? <Text style={styles.petTutorRow}>👤 Tutor: {tutorName}</Text> : null}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>PRÓXIMAS{'\n'}VACINAS</Text>
              <Text style={styles.statValue}>{pendingCount}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Text style={styles.statLabel}>PRÓXIMA{'\n'}VACINA</Text>
              <Text style={[styles.statValue, styles.statValueSm]} numberOfLines={1}>
                {nextVaccine?.name?.split(' ')[0] || '—'}
              </Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Text style={styles.statLabel}>GASTOS DO{'\n'}MÊS</Text>
              <Text style={styles.statValue}>R${monthExpenses.toFixed(0)}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Text style={styles.statLabel}>PESO{'\n'}ATUAL</Text>
              <Text style={styles.statValue}>{latestWeight ? `${latestWeight.weight_kg}kg` : '—'}</Text>
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
                  <Text style={styles.healthIcon}>💊</Text>
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

          {/* Tabs — ordem: Vacinas | Evolução | Linha */}
          <View style={styles.tabBar}>
            {['vacinas', 'evolução', 'linha'].map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
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

        {/* Tab: Linha do tempo (último) */}
        {activeTab === 'linha' && (
          <View style={styles.tabContent}>
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
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFF6FF' },
  backBtn: { marginRight: 12, padding: 4 },
  backIcon: { fontSize: 22, color: '#0EA5E9' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1E293B' },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerBtn: { padding: 4 },

  content: { paddingBottom: 40 },

  petCard: { backgroundColor: '#fff', margin: 16, borderRadius: 22, shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 4, overflow: 'hidden' },

  petTop: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 14 },
  petAvatarBtn: { position: 'relative', width: 70, height: 70 },
  petAvatarWrap: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#BFDBFE' },
  petPhoto: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#BFDBFE' },
  photoOverlay: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#0EA5E9', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  photoOverlayText: { fontSize: 12 },
  petEmoji: { fontSize: 38 },
  petMeta: { flex: 1 },
  petName: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  petTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  petTag: { backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  petTagBlue: { backgroundColor: '#DBEAFE' },
  petTagText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  petInfoRow: { fontSize: 12, color: '#94A3B8' },
  petTutorRow: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EFF6FF' },
  statBox: { flex: 1, padding: 12, alignItems: 'center' },
  statBoxBorder: { borderLeftWidth: 1, borderLeftColor: '#EFF6FF' },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', textAlign: 'center', letterSpacing: 0.3, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  statValueSm: { fontSize: 13 },

  // Saúde
  healthSection: { borderTopWidth: 1, borderTopColor: '#EFF6FF', padding: 14, gap: 10 },
  healthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  healthIcon: { fontSize: 18, marginTop: 1 },
  healthLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  healthValue: { fontSize: 13, color: '#374151', lineHeight: 19 },
  healthEditLink: { alignSelf: 'flex-end' },
  healthEditText: { fontSize: 12, color: '#0EA5E9', fontWeight: '600' },
  healthAddBtn: { borderTopWidth: 1, borderTopColor: '#EFF6FF', padding: 14, alignItems: 'center' },
  healthAddText: { fontSize: 13, color: '#0EA5E9', fontWeight: '600' },

  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EFF6FF' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#0EA5E9' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  tabBtnTextActive: { color: '#0EA5E9' },

  tabContent: { paddingHorizontal: 16, paddingTop: 4 },
  tabContentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  tabContentTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 8, marginBottom: 12 },
  tabContentAdd: { fontSize: 14, fontWeight: '600', color: '#0EA5E9' },

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
});
