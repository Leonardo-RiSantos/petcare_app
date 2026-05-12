import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../hooks/usePlan';
import UpgradeModal from '../../components/UpgradeModal';
import { scheduleAllSmartNotifications } from '../../utils/notifications';
import { generateHealthReportHTML, exportReport } from '../../utils/generateReport';

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
  Peixe:    require('../../../assets/pet_peixe.png'),
};

const ICON_CHECK   = require('../../../assets/icon_check.png');
const ICON_CROWN   = require('../../../assets/icon_crown.png');
const ICON_WARNING = require('../../../assets/icon_warning.png');
const ICON_LATE    = require('../../../assets/icon_late.png');

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcVaccineStatus(vaccines) {
  const today = new Date();
  const in30 = new Date(); in30.setDate(today.getDate() + 30);
  let ok = 0, warning = 0, late = 0;
  vaccines.forEach(v => {
    if (!v.next_dose_date) { ok++; return; }
    const next = new Date(v.next_dose_date);
    if (next < today) late++;
    else if (next <= in30) warning++;
    else ok++;
  });
  return { ok, warning, late };
}

// Faixa etária por espécie (meses)
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
  if (months < t.filhote) return { label: 'Filhote', color: '#16A34A', bg: '#DCFCE7' };
  if (months < t.adolescente) return { label: 'Adolescente', color: '#D97706', bg: '#FEF9C3' };
  return { label: 'Adulto', color: '#0EA5E9', bg: '#E0F2FE' };
}

// Dias para o próximo aniversário
function daysToBirthday(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.ceil((next - today) / (1000 * 60 * 60 * 24));
}

function StatusPill({ icon, count, label, bg, labelColor }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Image source={icon} style={styles.pillIcon} resizeMode="contain" />
      <Text style={[styles.pillCount, { color: labelColor }]}>{count}</Text>
      <Text style={[styles.pillLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user, isPremium, pendingInvites, acceptViewerInvite, declineViewerInvite } = useAuth();
  const { canAddPet } = usePlan();
  const [pets, setPets] = useState([]);
  const [sharedPets, setSharedPets] = useState([]); // pets de outros usuários compartilhados
  const [vaccines, setVaccines] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [exportingPetId, setExportingPetId] = useState(null);

  const handleHealthReport = async (pet) => {
    setExportingPetId(pet.id);
    try {
      const [vacRes, weightRes, medRes] = await Promise.all([
        supabase.from('vaccines').select('*').eq('pet_id', pet.id),
        supabase.from('weight_records').select('*').eq('pet_id', pet.id).order('recorded_at', { ascending: false }),
        supabase.from('medical_records').select('*').eq('pet_id', pet.id).order('date', { ascending: false }),
      ]);
      const vetRecords = (medRes.data || []).filter(r => r.created_by_role === 'vet');
      const tutorRecords = (medRes.data || []).filter(r => r.created_by_role !== 'vet');
      const html = generateHealthReportHTML({
        pet,
        vaccines: vacRes.data || [],
        weights: weightRes.data || [],
        medicalRecords: tutorRecords,
        vetRecords,
        ownerName: profile?.full_name || '',
      });
      await exportReport(html, `saude_${pet.name}.pdf`);
    } catch (e) {
      console.warn('Erro ao gerar relatório:', e);
    } finally {
      setExportingPetId(null);
    }
  };

  const fetchData = async () => {
    const [petsRes, vacRes, profileRes, expensesRes, weightsRes, medRes] = await Promise.all([
      supabase.from('pets').select('id, name, species, breed, birth_date, photo_url, user_id, weight_kg, coat_color').eq('user_id', user.id).order('created_at'),
      supabase.from('vaccines').select('id, pet_id, name, next_dose_date').eq('user_id', user.id),
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('expenses').select('id, pet_id, amount, date, category').eq('user_id', user.id).gte('date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
      supabase.from('weight_records').select('id, pet_id, weight_kg, recorded_at').eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(20),
      supabase.from('medical_records').select('id, pet_id, date').eq('user_id', user.id).order('date', { ascending: false }).limit(20),
    ]);
    if (petsRes.data) setPets(petsRes.data);
    if (vacRes.data) setVaccines(vacRes.data);
    if (profileRes.data) setProfile(profileRes.data);

    // Carrega pets compartilhados (viewer grants ativos)
    const { data: viewerLinks } = await supabase
      .from('pet_viewers')
      .select('owner_id, profiles!owner_id(full_name)')
      .eq('viewer_id', user.id)
      .eq('status', 'active');

    if (viewerLinks?.length) {
      const ownerIds = viewerLinks.map(l => l.owner_id);
      const { data: sharedData } = await supabase
        .from('pets').select('*').in('user_id', ownerIds).order('created_at');
      if (sharedData) {
        setSharedPets(sharedData.map(p => ({
          ...p,
          _ownerName: viewerLinks.find(l => l.owner_id === p.user_id)?.profiles?.full_name || '',
        })));
      }
    } else {
      setSharedPets([]);
    }

    setLoading(false);
    setRefreshing(false);

    // Monta mapa de última atividade por pet para notificações inteligentes
    const lastVetRecordByPet = {};
    (medRes.data || []).forEach(r => {
      if (!lastVetRecordByPet[r.pet_id] || r.date > lastVetRecordByPet[r.pet_id]) {
        lastVetRecordByPet[r.pet_id] = r.date;
      }
    });

    scheduleAllSmartNotifications({
      pets: petsRes.data || [],
      vaccines: vacRes.data || [],
      expenses: expensesRes.data || [],
      weights: weightsRes.data || [],
      medicalRecords: medRes.data || [],
      lastVetRecordByPet,
    }).catch(() => {});
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // Memoiza vacinas globais e vacinas por pet para evitar recompute no render
  const { ok, warning, late } = useMemo(() => calcVaccineStatus(vaccines), [vaccines]);
  const vaccinesByPet = useMemo(() => {
    const map = {};
    vaccines.forEach(v => {
      if (!map[v.pet_id]) map[v.pet_id] = [];
      map[v.pet_id].push(v);
    });
    return map;
  }, [vaccines]);
  const firstName = profile?.full_name?.split(' ')[0] || 'tutor';
  const hasAlerts = late > 0 || warning > 0;
  const allGood = vaccines.length > 0 && !hasAlerts;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  }

  const handleAddPet = () => {
    if (!canAddPet(pets.length)) { setUpgradeModal(true); return; }
    navigation.navigate('AddPet');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
    >
      <UpgradeModal visible={upgradeModal} onClose={() => setUpgradeModal(false)} feature="pets" />

      {/* Banners de convite pendente */}
      {pendingInvites.map(invite => (
        <View key={invite.id} style={styles.inviteBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inviteBannerTitle}>Convite recebido!</Text>
            <Text style={styles.inviteBannerSub}>
              <Text style={{ fontWeight: '700' }}>{invite.profiles?.full_name || 'Alguém'}</Text>
              {' '}te convidou para visualizar os pets
            </Text>
          </View>
          <TouchableOpacity style={styles.inviteAcceptBtn} onPress={() => acceptViewerInvite(invite.id)}>
            <Text style={styles.inviteAcceptText}>Aceitar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inviteDeclineBtn} onPress={() => declineViewerInvite(invite.id)}>
            <Text style={styles.inviteDeclineText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Hero */}
      <LinearGradient
        colors={isPremium ? ['#0F3460', '#0284C7', '#0EA5E9'] : ['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.bubble, { width: 220, height: 220, top: -70, right: -50 }]} />
        <View style={[styles.bubble, { width: 100, height: 100, bottom: -30, left: 20 }]} />

        {/* Badge de plano */}
        <View style={[styles.heroPlanBadge, isPremium && styles.heroPlanBadgePremium]}>
          {isPremium && <Image source={ICON_CROWN} style={{ width: 14, height: 14, marginRight: 5 }} resizeMode="contain" />}
          <Text style={styles.heroPlanBadgeText}>
            {isPremium ? 'Plano Premium' : 'Plano Básico'}
          </Text>
        </View>

        <Text style={styles.heroTitle}>Olá, {firstName}!</Text>

        {/* Frase emocional */}
        <Text style={styles.heroEmotion}>
          {pets.length === 0
            ? 'Tudo que seu pet precisa, organizado para você.'
            : hasAlerts
              ? 'Seu pet conta com você. Não deixe nada passar.'
              : 'Tudo que seu pet precisa, organizado para você.'}
        </Text>

        {/* Status resumido */}
        <Text style={styles.heroSub}>
          {pets.length === 0
            ? 'Adicione seu primeiro pet para começar'
            : allGood
              ? `${pets.length} pet${pets.length > 1 ? 's' : ''} com vacinas em dia ✓`
              : hasAlerts
                ? `${pets.length} pet${pets.length > 1 ? 's' : ''} · ${late + warning} alerta${(late + warning) > 1 ? 's' : ''} de vacina`
                : `${pets.length} pet${pets.length > 1 ? 's' : ''} cadastrado${pets.length > 1 ? 's' : ''}`}
        </Text>
      </LinearGradient>

      {/* Status vacinas */}
      {vaccines.length > 0 && (
        <View style={styles.statusRow}>
          <StatusPill icon={ICON_CHECK}   count={ok}      label="Em dia"    bg="#F0FDF4" labelColor="#16A34A" />
          <StatusPill icon={ICON_WARNING} count={warning} label="Vencendo"  bg="#FFFBEB" labelColor="#D97706" />
          <StatusPill icon={ICON_LATE}    count={late}    label="Atrasadas" bg="#FFF1F2" labelColor="#DC2626" />
        </View>
      )}

      {/* Banner alerta */}
      {hasAlerts && (
        <View style={[styles.alertBanner, late > 0 ? styles.alertBannerRed : styles.alertBannerYellow]}>
          <Image source={late > 0 ? ICON_LATE : ICON_WARNING} style={styles.alertBannerIcon} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertBannerTitle}>
              {late > 0 ? `${late} vacina${late > 1 ? 's' : ''} em atraso!` : `${warning} vacina${warning > 1 ? 's' : ''} vencendo em breve`}
            </Text>
            <Text style={styles.alertBannerSub}>Veja os pets abaixo e registre o reforço</Text>
          </View>
        </View>
      )}

      {/* Seção pets */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Meus Pets</Text>
        <TouchableOpacity style={styles.addBtnWrap} onPress={handleAddPet}>
          <LinearGradient
            colors={canAddPet(pets.length) ? ['#0EA5E9','#38BDF8'] : ['#F59E0B','#FBBF24']}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={[styles.addBtnGrad, !canAddPet(pets.length) && { flexDirection: 'row', alignItems: 'center', gap: 5 }]}
          >
            {!canAddPet(pets.length) && <Image source={ICON_CROWN} style={{ width: 14, height: 14 }} resizeMode="contain" />}
            <Text style={styles.addBtnText}>{canAddPet(pets.length) ? '+ Adicionar' : 'Premium'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {pets.length === 0 ? (
        /* ── Empty state com imagem ── */
        <TouchableOpacity
          style={styles.emptyState}
          onPress={() => navigation.navigate('AddPet')}
          activeOpacity={0.85}
        >
          <Image
            source={require('../../../assets/icon_empty_pets.png')}
            style={styles.emptyImg}
            resizeMode="contain"
          />
          <Text style={styles.emptyTitle}>Nenhum pet ainda</Text>
          <Text style={styles.emptySub}>Toque para adicionar seu primeiro pet!</Text>
          <LinearGradient colors={['#0EA5E9','#38BDF8']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>+ Adicionar pet</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        pets.map(pet => {
          const petVaccines = vaccinesByPet[pet.id] || [];
          const s = calcVaccineStatus(petVaccines);
          const ageStage = getAgeStage(pet.birth_date, pet.species);
          const daysLeft = daysToBirthday(pet.birth_date);
          const isBirthdaySoon = daysLeft !== null && daysLeft <= 15;
          const isBirthdayToday = daysLeft === 0;

          return (
            <TouchableOpacity
              key={pet.id}
              style={[styles.petCard, isBirthdaySoon && styles.petCardBirthday]}
              onPress={() => navigation.navigate('PetDetails', { petId: pet.id })}
              activeOpacity={0.82}
            >
              {/* Avatar */}
              {pet.photo_url ? (
                <Image source={{ uri: pet.photo_url }} style={styles.petPhotoCircle} />
              ) : (
                <LinearGradient colors={['#DBEAFE','#EFF6FF']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.petEmojiWrap}>
                  {SPECIES_IMAGES[pet.species]
                    ? <Image source={SPECIES_IMAGES[pet.species]} style={{ width: 36, height: 36 }} resizeMode="contain" />
                    : <Text style={{ fontSize: 30 }}>🐾</Text>}
                </LinearGradient>
              )}

              <View style={styles.petInfo}>
                <View style={styles.petNameRow}>
                  <Text style={styles.petName}>{pet.name}</Text>
                  {(isBirthdayToday || isBirthdaySoon) && (
                    <Image
                      source={require('../../../assets/icon_birthday.png')}
                      style={styles.birthdayIcon}
                      resizeMode="contain"
                    />
                  )}
                </View>
                <Text style={styles.petBreed}>{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</Text>

                {/* Faixa etária + aniversário */}
                <View style={styles.petBadgesRow}>
                  {ageStage && (
                    <View style={[styles.stageBadge, { backgroundColor: ageStage.bg }]}>
                      <Text style={[styles.stageBadgeText, { color: ageStage.color }]}>{ageStage.label}</Text>
                    </View>
                  )}
                  {isBirthdaySoon && (
                    <View style={styles.bdBadge}>
                      <Image source={require('../../../assets/icon_birthday.png')} style={{ width: 13, height: 13, marginRight: 4 }} resizeMode="contain" />
                      <Text style={styles.bdBadgeText}>
                        {isBirthdayToday ? 'Aniversário hoje!' : `Aniversário em ${daysLeft}d`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.petRight}>
                {s.late > 0 ? (
                  <View style={[styles.badge, styles.badgeLate]}><Text style={[styles.badgeTxt, { color: '#DC2626' }]}>Atrasada</Text></View>
                ) : s.warning > 0 ? (
                  <View style={[styles.badge, styles.badgeWarn]}><Text style={[styles.badgeTxt, { color: '#D97706' }]}>Vencendo</Text></View>
                ) : petVaccines.length > 0 ? (
                  <View style={[styles.badge, styles.badgeOk]}><Text style={[styles.badgeTxt, { color: '#16A34A' }]}>Em dia</Text></View>
                ) : (
                  <View style={[styles.badge, styles.badgeNone]}><Text style={[styles.badgeTxt, { color: '#94A3B8' }]}>Sem vacinas</Text></View>
                )}
                <TouchableOpacity
                  style={styles.pdfBtn}
                  onPress={(e) => { e.stopPropagation?.(); handleHealthReport(pet); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  {exportingPetId === pet.id
                    ? <ActivityIndicator size="small" color="#0EA5E9" />
                    : <Image source={require('../../../assets/icon_doc.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />}
                </TouchableOpacity>
                <Text style={styles.petArrow}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      {/* Upsell Premium — só para plano básico */}
      {!isPremium && (
        <TouchableOpacity
          style={styles.upsellCard}
          onPress={() => navigation.navigate('Plan')}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={['#FFFBEB', '#FEF9C3']}
            style={styles.upsellGrad}
          >
            <View style={styles.upsellHeader}>
              <View style={styles.upsellCrown}>
                <Image source={ICON_CROWN} style={{ width: 30, height: 30 }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.upsellTitle}>Desbloqueie o PetCare+ completo</Text>
                <Text style={styles.upsellPrice}>A partir de R$19,90/mês</Text>
              </View>
              <Text style={styles.upsellArrow}>›</Text>
            </View>

            <View style={styles.upsellGrid}>
              {[
                { icon: require('../../../assets/icon_profile.png'),  label: 'Pets ilimitados'       },
                { icon: require('../../../assets/icon_medical.png'),  label: 'Vínculo com veterinário' },
                { icon: require('../../../assets/icon_fred.png'),     label: 'Assistente Fred IA'    },
                { icon: require('../../../assets/icon_map.png'),      label: 'Mapa pet-friendly'     },
              ].map(({ icon, label }) => (
                <View key={label} style={styles.upsellFeature}>
                  <View style={styles.upsellFeatureIcon}>
                    <Image source={icon} style={{ width: 14, height: 14 }} resizeMode="contain" />
                  </View>
                  <Text style={styles.upsellFeatureText}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.upsellCTARow}>
              <Text style={styles.upsellCTAText}>Ver planos →</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Pets compartilhados comigo */}
      {sharedPets.length > 0 && (
        <>
          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>Pets compartilhados</Text>
            <View style={styles.viewerBadge}>
              <Text style={styles.viewerBadgeTxt}>Visualizador</Text>
            </View>
          </View>
          {sharedPets.map(pet => (
            <TouchableOpacity
              key={pet.id}
              style={[styles.petCard, { borderColor: '#FEF3C7', borderWidth: 1.5 }]}
              onPress={() => navigation.navigate('PetDetails', { petId: pet.id })}
              activeOpacity={0.82}
            >
              {pet.photo_url ? (
                <Image source={{ uri: pet.photo_url }} style={styles.petPhotoCircle} />
              ) : (
                <LinearGradient colors={['#FEF9C3','#FFFBEB']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.petEmojiWrap}>
                  {SPECIES_IMAGES[pet.species]
                    ? <Image source={SPECIES_IMAGES[pet.species]} style={{ width: 36, height: 36 }} resizeMode="contain" />
                    : <Text style={{ fontSize: 30 }}>🐾</Text>}
                </LinearGradient>
              )}
              <View style={styles.petInfo}>
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petBreed}>{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</Text>
                {pet._ownerName ? <Text style={{ fontSize: 11, color: '#D97706', marginTop: 2 }}>De {pet._ownerName}</Text> : null}
              </View>
              <Text style={styles.petArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 28, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },

  heroPlanBadge: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start', marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  heroPlanBadgePremium: {
    backgroundColor: 'rgba(245,158,11,0.35)',
    borderColor: 'rgba(251,191,36,0.5)',
  },
  heroPlanBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 8 },
  heroEmotion: {
    fontSize: 15, color: 'rgba(255,255,255,0.96)',
    lineHeight: 22, fontWeight: '600', fontStyle: 'italic',
    marginBottom: 10,
  },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },

  statusRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 14 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10 },
  pillIcon: { width: 20, height: 20 },
  pillCount: { fontSize: 16, fontWeight: '800' },
  pillLabel: { fontSize: 11, fontWeight: '600', flex: 1 },

  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 12, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  alertBannerRed: { backgroundColor: '#FFF1F2', borderWidth: 1.5, borderColor: '#FECDD3' },
  alertBannerYellow: { backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#FDE68A' },
  alertBannerIcon: { width: 32, height: 32 },
  alertBannerTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  alertBannerSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 22, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  addBtnWrap: { borderRadius: 22, overflow: 'hidden' },
  addBtnGrad: { paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Empty state
  emptyState: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center',
    marginHorizontal: 20,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
    borderWidth: 1.5, borderColor: '#E0F2FE', borderStyle: 'dashed',
  },
  emptyImg: { width: 160, height: 160, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 20 },
  emptyBtn: { borderRadius: 16, paddingHorizontal: 28, paddingVertical: 13 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Pet card
  petCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 14,
    marginHorizontal: 20, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#EFF6FF',
  },
  petCardBirthday: { borderColor: '#FDE68A', borderWidth: 2, backgroundColor: '#FFFDF0' },
  petEmojiWrap: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  petPhotoCircle: { width: 54, height: 54, borderRadius: 27, marginRight: 14, borderWidth: 2, borderColor: '#BFDBFE' },
  petInfo: { flex: 1 },
  petNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  petName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  birthdayIcon: { width: 18, height: 18 },
  petBreed: { fontSize: 13, color: '#64748B', marginTop: 2 },
  petBadgesRow: { flexDirection: 'row', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  stageBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  stageBadgeText: { fontSize: 10, fontWeight: '700' },
  bdBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF9C3', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  bdBadgeText: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  petRight: { alignItems: 'flex-end', gap: 6 },
  petArrow: { fontSize: 20, color: '#BAE6FD' },
  pdfBtn: { padding: 4, marginTop: 4 },

  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOk: { backgroundColor: '#DCFCE7' },
  badgeWarn: { backgroundColor: '#FEF9C3' },
  badgeLate: { backgroundColor: '#FFE4E6' },
  badgeNone: { backgroundColor: '#F1F5F9' },
  badgeTxt: { fontSize: 11, fontWeight: '700' },

  // Banner convite pendente
  inviteBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginTop: 12,
    backgroundColor: '#FFFBEB', borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: '#FDE68A',
  },
  inviteBannerTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  inviteBannerSub: { fontSize: 12, color: '#64748B' },
  inviteAcceptBtn: { backgroundColor: '#0EA5E9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  inviteAcceptText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  inviteDeclineBtn: { padding: 8 },
  inviteDeclineText: { fontSize: 16, color: '#94A3B8', fontWeight: '700' },

  // Pets compartilhados
  viewerBadge: { backgroundColor: '#FEF3C7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  viewerBadgeTxt: { fontSize: 11, fontWeight: '700', color: '#D97706' },

  // Upsell Premium
  upsellCard: {
    marginHorizontal: 20, marginTop: 20, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 5,
    borderWidth: 1.5, borderColor: '#FDE68A',
  },
  upsellGrad: { padding: 20 },
  upsellHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  upsellCrown: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  upsellTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 3 },
  upsellPrice: { fontSize: 12, color: '#D97706', fontWeight: '700' },
  upsellArrow: { fontSize: 24, color: '#D97706', fontWeight: '300' },
  upsellGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  upsellFeature: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    width: '47%',
  },
  upsellFeatureIcon: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.15)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  upsellFeatureText: { fontSize: 12, color: '#374151', fontWeight: '600', flex: 1 },
  upsellCTARow: {
    backgroundColor: '#F59E0B', borderRadius: 14,
    paddingVertical: 12, alignItems: 'center',
  },
  upsellCTAText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
