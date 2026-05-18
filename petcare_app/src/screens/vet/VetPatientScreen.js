import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Image, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  Peixe:    require('../../../assets/pet_peixe.png'),
};

const ICON_MEDICAL  = require('../../../assets/icon_medical.png');
const ICON_MEDICINE = require('../../../assets/icon_medicine.png');
const ICON_CHECK    = require('../../../assets/icon_check.png');
const ICON_WARNING  = require('../../../assets/icon_warning.png');
const ICON_LATE     = require('../../../assets/icon_late.png');
const ICON_WEIGHT   = require('../../../assets/icon_weight.png');
const ICON_EXPENSES = require('../../../assets/icon_expenses.png');
const ICON_CALENDAR = require('../../../assets/icon_calendar.png');
const ICON_PROFILE  = require('../../../assets/icon_profile.png');

const CONSULT_COLORS = {
  consulta:   { label: 'Consulta',    color: '#0EA5E9', bg: '#EFF6FF' },
  retorno:    { label: 'Retorno',     color: '#10B981', bg: '#DCFCE7' },
  cirurgia:   { label: 'Cirurgia',    color: '#8B5CF6', bg: '#EDE9FE' },
  exame:      { label: 'Exame',       color: '#F59E0B', bg: '#FEF3C7' },
  vacinacao:  { label: 'Vacinação',   color: '#16A34A', bg: '#DCFCE7' },
  outro:      { label: 'Procedimento',color: '#64748B', bg: '#F1F5F9' },
};
const STATUS_LABELS = {
  scheduled: 'Agendado', confirmed: 'Confirmado', completed: 'Realizado',
  cancelled: 'Cancelado', no_show: 'Faltou', pending_approval: 'Aguardando',
};
const STATUS_COLORS = {
  scheduled: '#0EA5E9', confirmed: '#10B981', completed: '#64748B',
  cancelled: '#EF4444', no_show: '#EF4444', pending_approval: '#F59E0B',
};

const fmt = (d) => {
  if (!d) return '—';
  const [y, m, day] = String(d).split('T')[0].split('-');
  return `${day}/${m}/${y}`;
};
const calcAge = (b) => {
  if (!b) return null;
  const months = Math.floor((Date.now() - new Date(b)) / (1000 * 60 * 60 * 24 * 30.44));
  return months < 12 ? `${months} meses` : `${Math.floor(months / 12)} ano${Math.floor(months/12) > 1 ? 's' : ''}`;
};

function SectionHeader({ title, count, action, onAction }) {
  return (
    <View style={s.secHeader}>
      <Text style={s.secTitle}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {count !== undefined && (
          <View style={s.badge}><Text style={s.badgeTxt}>{count}</Text></View>
        )}
        {action && (
          <TouchableOpacity onPress={onAction} style={s.secAction}>
            <Text style={s.secActionTxt}>{action}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function VetPatientScreen({ route, navigation }) {
  const { petId } = route.params || {};
  const { user, vetProfile } = useAuth();

  const [pet,           setPet]           = useState(null);
  const [records,       setRecords]       = useState([]);
  const [vaccines,      setVaccines]      = useState([]);
  const [weights,       setWeights]       = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [scheduleAppts, setScheduleAppts] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showRemove,    setShowRemove]    = useState(false);
  const [activeTab,     setActiveTab]     = useState('prontuario');

  // Modal registrar medidas
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightForm, setWeightForm] = useState({ weight_kg: '', height_cm: '', length_cm: '', notes: '' });
  const [savingWeight, setSavingWeight] = useState(false);

  // Modal aceitar/recusar agendamento pendente
  const [apptAction, setApptAction] = useState(null); // { appt, action: 'confirm'|'cancel' }

  useEffect(() => { if (petId) fetchData(); }, [petId]);

  const fetchData = async () => {
    const [petRes, recRes, vacRes, wRes, consultRes, schedRes] = await Promise.all([
      supabase.from('pets')
        .select('id, name, species, breed, birth_date, photo_url, sex, neutered, weight_kg, health_notes, medications, user_id, coat_color')
        .eq('id', petId).single(),
      supabase.from('medical_records')
        .select('id, type, title, description, date, veterinarian, diagnosis, prescription, created_by_role')
        .eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('vaccines')
        .select('id, name, applied_date, next_dose_date')
        .eq('pet_id', petId).order('applied_date', { ascending: false }),
      supabase.from('weight_records')
        .select('id, weight_kg, date, notes')
        .eq('pet_id', petId).order('date', { ascending: false }).limit(8),
      supabase.from('vet_consultations')
        .select('id, date, type, chief_complaint, diagnosis, treatment_plan, notes, weight_at_visit, temperature, visible_to_owner')
        .eq('vet_id', user.id).eq('pet_id', petId)
        .order('date', { ascending: false }),
      supabase.from('vet_schedule')
        .select('id, scheduled_date, scheduled_time, type, status, notes, request_message')
        .eq('vet_id', user.id).eq('pet_id', petId)
        .order('scheduled_date', { ascending: true }),
    ]);
    if (petRes.data)       setPet(petRes.data);
    if (recRes.data)       setRecords(recRes.data);
    if (vacRes.data)       setVaccines(vacRes.data);
    if (wRes.data)         setWeights(wRes.data);
    if (consultRes.data)   setConsultations(consultRes.data);
    if (schedRes.data)     setScheduleAppts(schedRes.data);
    setLoading(false);
  };

  const confirmRemove = async () => {
    await supabase.from('pet_vet_links').update({ status: 'removed' }).eq('pet_id', petId).eq('vet_id', user.id);
    setShowRemove(false);
    navigation.goBack();
  };

  const saveWeight = async () => {
    const kg = parseFloat(weightForm.weight_kg.replace(',', '.'));
    if (isNaN(kg) || kg <= 0) return;
    setSavingWeight(true);
    const today = new Date().toISOString().slice(0, 10);
    const extra = {};
    if (weightForm.height_cm) extra.height_cm = parseFloat(weightForm.height_cm.replace(',', '.'));
    if (weightForm.length_cm) extra.length_cm = parseFloat(weightForm.length_cm.replace(',', '.'));
    const { error } = await supabase.from('weight_records').insert({
      pet_id: petId,
      user_id: pet.user_id,
      weight_kg: kg,
      date: today,
      notes: weightForm.notes.trim() || null,
      ...extra,
    });
    setSavingWeight(false);
    if (!error) {
      setShowWeightModal(false);
      setWeightForm({ weight_kg: '', height_cm: '', length_cm: '', notes: '' });
      fetchData();
    }
  };

  const handleApptAction = async (appt, action) => {
    const newStatus = action === 'confirm' ? 'scheduled' : 'cancelled';
    await supabase.from('vet_schedule').update({ status: newStatus }).eq('id', appt.id);
    setApptAction(null);
    fetchData();
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  if (!pet)    return null;

  const today  = new Date();
  const in30   = new Date(); in30.setDate(today.getDate() + 30);
  const age    = calcAge(pet.birth_date);
  const latest = weights[0];
  const upcomingAppts = scheduleAppts.filter(a => new Date(a.scheduled_date) >= today || a.status === 'pending_approval');
  const pastAppts     = scheduleAppts.filter(a => new Date(a.scheduled_date) < today && a.status !== 'pending_approval');

  const lateVac = vaccines.filter(v => v.next_dose_date && new Date(v.next_dose_date) < today).length;
  const warnVac = vaccines.filter(v => v.next_dose_date && new Date(v.next_dose_date) >= today && new Date(v.next_dose_date) <= in30).length;

  const TABS = [
    { key: 'prontuario',   label: 'Prontuário' },
    { key: 'agendamentos', label: `Agenda (${scheduleAppts.length})` },
    { key: 'vacinas',      label: 'Vacinas' },
    { key: 'evolucao',     label: 'Evolução' },
  ];

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── HERO DO PACIENTE ──────────────────────────── */}
        <LinearGradient colors={['#0F3460', '#0284C7', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={[s.bubble, { width: 180, height: 180, top: -50, right: -40 }]} />
          <View style={[s.bubble, { width: 90, height: 90, bottom: -20, left: 30 }]} />

          <View style={s.heroInner}>
            {/* Avatar */}
            {pet.photo_url
              ? <Image source={{ uri: pet.photo_url }} style={s.avatar} />
              : <LinearGradient colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']} style={s.avatarDefault}>
                  {SPECIES_IMAGES[pet.species]
                    ? <Image source={SPECIES_IMAGES[pet.species]} style={{ width: 48, height: 48 }} resizeMode="contain" />
                    : <Text style={{ fontSize: 40 }}>🐾</Text>}
                </LinearGradient>}

            {/* Nome e info principal */}
            <View style={s.heroInfo}>
              <Text style={s.heroName}>{pet.name}</Text>
              <Text style={s.heroSub}>
                {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
                {age ? ` · ${age}` : ''}
              </Text>
              <View style={s.heroPills}>
                {pet.sex && <View style={s.heroPill}><Text style={s.heroPillTxt}>{pet.sex}</Text></View>}
                {pet.neutered && <View style={s.heroPill}><Text style={s.heroPillTxt}>Castrado(a)</Text></View>}
                {latest && <View style={s.heroPill}><Text style={s.heroPillTxt}>{latest.weight_kg} kg</Text></View>}
              </View>
            </View>
          </View>

          {/* Indicadores rápidos */}
          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{vaccines.length}</Text>
              <Text style={s.heroStatLbl}>Vacinas</Text>
            </View>
            <View style={s.heroStatDiv} />
            <View style={s.heroStat}>
              <Text style={[s.heroStatVal, lateVac > 0 && { color: '#FCA5A5' }]}>{lateVac}</Text>
              <Text style={s.heroStatLbl}>Atrasadas</Text>
            </View>
            <View style={s.heroStatDiv} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{consultations.length}</Text>
              <Text style={s.heroStatLbl}>Consultas</Text>
            </View>
            <View style={s.heroStatDiv} />
            <View style={s.heroStat}>
              <Text style={[s.heroStatVal, upcomingAppts.length > 0 && { color: '#A5F3FC' }]}>{upcomingAppts.length}</Text>
              <Text style={s.heroStatLbl}>Próximos</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── AÇÕES RÁPIDAS ─────────────────────────────── */}
        <View style={s.actions}>
          <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('VetConsultation', { petId, petName: pet.name })} activeOpacity={0.85}>
            <LinearGradient colors={['#0284C7', '#0EA5E9']} style={s.actionBtnGrad}>
              <Image source={ICON_MEDICAL} style={s.actionIcon} resizeMode="contain" />
              <Text style={s.actionLbl}>Nova{'\n'}Consulta</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('VetAddAppointment', { petId, petName: pet.name, tutorId: pet.user_id })} activeOpacity={0.85}>
            <LinearGradient colors={['#7C3AED', '#A78BFA']} style={s.actionBtnGrad}>
              <Image source={ICON_CALENDAR} style={s.actionIcon} resizeMode="contain" />
              <Text style={s.actionLbl}>Agendar{'\n'}Consulta</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('VetQuickDoc', { petId, petName: pet.name, petSpecies: pet.species, tutorId: pet.user_id })} activeOpacity={0.85}>
            <LinearGradient colors={['#10B981', '#34D399']} style={s.actionBtnGrad}>
              <Image source={ICON_EXPENSES} style={s.actionIcon} resizeMode="contain" />
              <Text style={s.actionLbl}>Receita{'\n'}Atestado</Text>
            </LinearGradient>
          </TouchableOpacity>
          {vetProfile?.chat_enabled && (
            <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('VetChat', { petId, petName: pet.name, tutorId: pet.user_id })} activeOpacity={0.85}>
              <LinearGradient colors={['#F59E0B', '#FBBF24']} style={s.actionBtnGrad}>
                <Text style={{ fontSize: 20 }}>💬</Text>
                <Text style={s.actionLbl}>Chat{'\n'}Tutor</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* ── SAÚDE DO TUTOR (notas do perfil do pet) ──── */}
        {(pet.health_notes || pet.medications) && (
          <View style={s.healthCard}>
            <View style={s.healthCardHeader}>
              <Image source={ICON_WARNING} style={{ width: 16, height: 16 }} resizeMode="contain" />
              <Text style={s.healthCardTitle}>Informações de saúde registradas pelo tutor</Text>
            </View>
            {pet.health_notes && (
              <View style={s.healthRow}>
                <Text style={s.healthLabel}>🌿 Condições / Alergias</Text>
                <Text style={s.healthValue}>{pet.health_notes}</Text>
              </View>
            )}
            {pet.medications && (
              <View style={[s.healthRow, { borderTopWidth: pet.health_notes ? 1 : 0, borderTopColor: '#FEF9C3', marginTop: 10, paddingTop: 10 }]}>
                <Text style={s.healthLabel}>💊 Medicamentos em uso</Text>
                <Text style={s.healthValue}>{pet.medications}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── TABS ──────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs} style={{ marginBottom: 4 }}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)} style={[s.tab, activeTab === t.key && s.tabActive]} activeOpacity={0.8}>
              <Text style={[s.tabTxt, activeTab === t.key && s.tabTxtActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ══ TAB: PRONTUÁRIO ═══════════════════════════ */}
        {activeTab === 'prontuario' && (
          <>
            {/* Consultas estruturadas (vet_consultations) */}
            <SectionHeader title="Consultas registradas" count={consultations.length} />
            {consultations.length === 0 ? (
              <View style={s.emptyCard}>
                <Image source={ICON_MEDICAL} style={{ width: 40, height: 40, opacity: 0.2, marginBottom: 8 }} resizeMode="contain" />
                <Text style={s.emptyTxt}>Nenhuma consulta registrada</Text>
                <Text style={s.emptySub}>Use "Nova Consulta" para criar o primeiro prontuário</Text>
              </View>
            ) : consultations.map(c => {
              const cfg = CONSULT_COLORS[c.type] || CONSULT_COLORS.outro;
              return (
                <View key={c.id} style={s.consultCard}>
                  <View style={s.consultHeader}>
                    <View style={[s.consultTypeBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.consultTypeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={s.consultDate}>{fmt(c.date)}</Text>
                    {c.weight_at_visit && <Text style={s.consultWeight}>{c.weight_at_visit} kg</Text>}
                    {c.temperature && <Text style={s.consultTemp}>🌡 {c.temperature}°C</Text>}
                  </View>
                  {c.chief_complaint && (
                    <View style={s.consultField}>
                      <Text style={s.consultFieldLabel}>Queixa</Text>
                      <Text style={s.consultFieldValue}>{c.chief_complaint}</Text>
                    </View>
                  )}
                  {c.diagnosis && (
                    <View style={[s.consultField, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                      <Text style={[s.consultFieldLabel, { color: '#15803D' }]}>Diagnóstico</Text>
                      <Text style={s.consultFieldValue}>{c.diagnosis}</Text>
                    </View>
                  )}
                  {c.treatment_plan && (
                    <View style={[s.consultField, { backgroundColor: '#EFF6FF', borderColor: '#BAE6FD' }]}>
                      <Text style={[s.consultFieldLabel, { color: '#0369A1' }]}>Plano terapêutico</Text>
                      <Text style={s.consultFieldValue}>{c.treatment_plan}</Text>
                    </View>
                  )}
                  {c.notes && (
                    <View style={s.consultField}>
                      <Text style={s.consultFieldLabel}>Obs.</Text>
                      <Text style={s.consultFieldValue}>{c.notes}</Text>
                    </View>
                  )}
                  {!c.visible_to_owner && (
                    <View style={s.privateTag}>
                      <Text style={s.privateTagTxt}>🔒 Privado — tutor não vê</Text>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Histórico médico (medical_records — tutor + outros vets) */}
            {records.length > 0 && (
              <>
                <SectionHeader title="Histórico médico geral" count={records.length} />
                {records.map((r, i) => (
                  <View key={r.id} style={s.recordCard}>
                    <View style={s.recordRow}>
                      <View style={[s.recordDot, { backgroundColor: r.created_by_role === 'vet' ? '#0EA5E9' : '#F59E0B' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.recordTitle}>{r.title}</Text>
                        <Text style={s.recordMeta}>
                          {r.created_by_role === 'vet' ? '🩺 Vet' : '👤 Tutor'} · {fmt(r.date)}
                          {r.veterinarian ? ` · Dr(a). ${r.veterinarian}` : ''}
                        </Text>
                      </View>
                    </View>
                    {r.description  && <Text style={s.recordDetail}>{r.description}</Text>}
                    {r.diagnosis    && <Text style={s.recordDetail}><Text style={{ fontWeight: '700' }}>Diagnóstico: </Text>{r.diagnosis}</Text>}
                    {r.prescription && <Text style={s.recordDetail}><Text style={{ fontWeight: '700', color: '#7C3AED' }}>Prescrição: </Text>{r.prescription}</Text>}
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ══ TAB: AGENDAMENTOS ═════════════════════════ */}
        {activeTab === 'agendamentos' && (
          <>
            {upcomingAppts.length > 0 && (
              <>
                <SectionHeader title="Próximos / Pendentes" count={upcomingAppts.length} />
                {upcomingAppts.map(a => {
                  const cfg = CONSULT_COLORS[a.type] || CONSULT_COLORS.outro;
                  const statusColor = STATUS_COLORS[a.status] || '#64748B';
                  const [y, m, d] = (a.scheduled_date || '').split('-');
                  return (
                    <View key={a.id} style={[s.apptCard, { borderLeftColor: statusColor }]}>
                      <View style={s.apptRow}>
                        <View style={[s.apptTypeBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[s.apptTypeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        <View style={[s.apptStatusBadge, { backgroundColor: statusColor + '20' }]}>
                          <Text style={[s.apptStatusTxt, { color: statusColor }]}>{STATUS_LABELS[a.status] || a.status}</Text>
                        </View>
                        <Text style={s.apptDate}>{d}/{m}/{y}{a.scheduled_time ? ` às ${a.scheduled_time.slice(0,5)}` : ''}</Text>
                      </View>
                      {a.notes && <Text style={s.apptNote}>{a.notes}</Text>}
                      {a.request_message && <Text style={[s.apptNote, { color: '#B45309' }]}>Mensagem: {a.request_message}</Text>}
                      {a.status === 'pending_approval' && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: '#DCFCE7', borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#86EFAC' }}
                            onPress={() => handleApptAction(a, 'confirm')}
                          >
                            <Text style={{ color: '#16A34A', fontWeight: '800', fontSize: 13 }}>✓ Confirmar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' }}
                            onPress={() => handleApptAction(a, 'cancel')}
                          >
                            <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 13 }}>✕ Recusar</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {pastAppts.length > 0 && (
              <>
                <SectionHeader title="Anteriores" count={pastAppts.length} />
                {pastAppts.map(a => {
                  const cfg = CONSULT_COLORS[a.type] || CONSULT_COLORS.outro;
                  const [y, m, d] = (a.scheduled_date || '').split('-');
                  return (
                    <View key={a.id} style={[s.apptCard, s.apptCardPast]}>
                      <View style={s.apptRow}>
                        <View style={[s.apptTypeBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[s.apptTypeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        <Text style={[s.apptStatusTxt, { color: '#94A3B8' }]}>{STATUS_LABELS[a.status] || a.status}</Text>
                        <Text style={s.apptDate}>{d}/{m}/{y}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {scheduleAppts.length === 0 && (
              <View style={s.emptyCard}>
                <Image source={ICON_CALENDAR} style={{ width: 40, height: 40, opacity: 0.2, marginBottom: 8 }} resizeMode="contain" />
                <Text style={s.emptyTxt}>Nenhum agendamento</Text>
                <TouchableOpacity onPress={() => navigation.navigate('VetAddAppointment', { petId, petName: pet.name, tutorId: pet.user_id })} style={{ marginTop: 10 }}>
                  <Text style={{ color: '#0EA5E9', fontWeight: '700', fontSize: 14 }}>+ Criar agendamento</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ══ TAB: VACINAS ══════════════════════════════ */}
        {activeTab === 'vacinas' && (
          <>
            {lateVac > 0 && (
              <View style={s.alertBox}>
                <Text style={s.alertTxt}>⚠ {lateVac} vacina{lateVac > 1 ? 's' : ''} em atraso</Text>
              </View>
            )}
            {warnVac > 0 && (
              <View style={[s.alertBox, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <Text style={[s.alertTxt, { color: '#B45309' }]}>⏰ {warnVac} vacina{warnVac > 1 ? 's' : ''} vencendo em 30 dias</Text>
              </View>
            )}
            <SectionHeader title="Carteira de vacinação" count={vaccines.length} />
            {vaccines.length === 0 ? (
              <View style={s.emptyCard}><Text style={s.emptyTxt}>Nenhuma vacina registrada pelo tutor</Text></View>
            ) : vaccines.map((v, i) => {
              const late = v.next_dose_date && new Date(v.next_dose_date) < today;
              const warn = v.next_dose_date && !late && new Date(v.next_dose_date) <= in30;
              return (
                <View key={v.id} style={s.vaccineCard}>
                  <Image source={late ? ICON_LATE : warn ? ICON_WARNING : ICON_CHECK} style={{ width: 22, height: 22 }} resizeMode="contain" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.vaccineName}>{v.name}</Text>
                    <Text style={s.vaccineDate}>Aplicada: {fmt(v.applied_date)}</Text>
                  </View>
                  {v.next_dose_date && (
                    <View style={[s.vaccineNext, { backgroundColor: late ? '#FFE4E6' : warn ? '#FEF9C3' : '#F0FDF4' }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: late ? '#DC2626' : warn ? '#B45309' : '#15803D' }}>
                        Reforço: {fmt(v.next_dose_date)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ══ TAB: EVOLUÇÃO ════════════════════════════ */}
        {activeTab === 'evolucao' && (
          <>
            <SectionHeader
              title="Evolução de peso"
              count={weights.length}
              action="+ Registrar"
              onAction={() => setShowWeightModal(true)}
            />

            {/* Gráfico */}
            {weights.length >= 2 && (
              <View style={s.chartCard}>
                <WeightChart records={[...weights].sort((a, b) => new Date(a.date) - new Date(b.date))} />
              </View>
            )}

            {weights.length === 0 ? (
              <View style={s.emptyCard}>
                <Image source={ICON_WEIGHT} style={{ width: 40, height: 40, opacity: 0.2, marginBottom: 8 }} resizeMode="contain" />
                <Text style={s.emptyTxt}>Nenhum registro de evolução</Text>
                <TouchableOpacity onPress={() => setShowWeightModal(true)} style={{ marginTop: 10 }}>
                  <Text style={{ color: '#0EA5E9', fontWeight: '700', fontSize: 14 }}>+ Registrar agora</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.weightCard}>
                {weights.map((w, i) => {
                  const prev = weights[i + 1];
                  const diff = prev ? (w.weight_kg - prev.weight_kg).toFixed(1) : null;
                  return (
                    <View key={w.id} style={[s.weightRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 10, paddingTop: 10 }]}>
                      <Image source={ICON_WEIGHT} style={{ width: 18, height: 18, opacity: 0.5 }} resizeMode="contain" />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={s.weightVal}>{w.weight_kg} kg{w.height_cm ? ` · ${w.height_cm} cm` : ''}</Text>
                        <Text style={s.weightDate}>{fmt(w.date)}{w.notes ? ` · ${w.notes}` : ''}</Text>
                      </View>
                      {diff !== null && (
                        <Text style={{ fontSize: 12, fontWeight: '700', color: Number(diff) > 0 ? '#F59E0B' : Number(diff) < 0 ? '#0EA5E9' : '#94A3B8' }}>
                          {Number(diff) > 0 ? `+${diff}` : diff} kg
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Remover paciente */}
        <TouchableOpacity style={s.removeBtn} onPress={() => setShowRemove(true)}>
          <Text style={s.removeBtnTxt}>Remover acesso a este paciente</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Modal registrar medidas */}
      <Modal visible={showWeightModal} transparent animationType="slide" onRequestClose={() => setShowWeightModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setShowWeightModal(false)} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontSize: 17, fontWeight: '900', color: '#1E293B', marginBottom: 18 }}>Registrar Evolução — {pet?.name}</Text>

          <Text style={s.mLabel}>Peso (kg) *</Text>
          <TextInput style={s.mInput} value={weightForm.weight_kg} onChangeText={v => setWeightForm(p => ({ ...p, weight_kg: v }))} placeholder="Ex: 4,5" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.mLabel}>Altura (cm)</Text>
              <TextInput style={s.mInput} value={weightForm.height_cm} onChangeText={v => setWeightForm(p => ({ ...p, height_cm: v }))} placeholder="Ex: 28" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.mLabel}>Comprimento (cm)</Text>
              <TextInput style={s.mInput} value={weightForm.length_cm} onChangeText={v => setWeightForm(p => ({ ...p, length_cm: v }))} placeholder="Ex: 45" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
            </View>
          </View>

          <Text style={s.mLabel}>Observações</Text>
          <TextInput style={[s.mInput, { height: 70, textAlignVertical: 'top' }]} value={weightForm.notes} onChangeText={v => setWeightForm(p => ({ ...p, notes: v }))} placeholder="Ex: Pós-cirurgia, em recuperação..." placeholderTextColor="#9CA3AF" multiline />

          <TouchableOpacity
            style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden' }}
            onPress={saveWeight} disabled={savingWeight || !weightForm.weight_kg}
          >
            <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 15, alignItems: 'center' }}>
              {savingWeight ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Salvar registro</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Modal remover */}
      <Modal visible={showRemove} transparent animationType="fade" onRequestClose={() => setShowRemove(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: '#1E293B', marginBottom: 8, textAlign: 'center' }}>Remover paciente?</Text>
            <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Você perderá acesso ao histórico de <Text style={{ fontWeight: '700', color: '#1E293B' }}>{pet?.name}</Text>.
            </Text>
            <TouchableOpacity style={{ width: '100%', backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }} onPress={confirmRemove}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Sim, remover</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ width: '100%', backgroundColor: '#F1F5F9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }} onPress={() => setShowRemove(false)}>
              <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '700' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F9FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 40 },

  /* Hero */
  hero: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarDefault: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 3 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  heroPills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  heroPill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  heroPillTxt: { fontSize: 11, color: '#fff', fontWeight: '600' },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 14 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 20, fontWeight: '900', color: '#fff' },
  heroStatLbl: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 2 },
  heroStatDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 4 },

  /* Actions */
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  actionBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  actionBtnGrad: { paddingVertical: 14, alignItems: 'center', gap: 6 },
  actionIcon: { width: 22, height: 22 },
  actionLbl: { fontSize: 11, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 15 },

  /* Health card (tutor notes) */
  healthCard: {
    backgroundColor: '#FFFBEB', borderRadius: 16, marginHorizontal: 16, marginBottom: 8,
    padding: 14, borderWidth: 1.5, borderColor: '#FDE68A',
  },
  healthCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  healthCardTitle: { fontSize: 12, fontWeight: '800', color: '#B45309', flex: 1 },
  healthRow: { flexDirection: 'column' },
  healthLabel: { fontSize: 11, fontWeight: '800', color: '#B45309', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  healthValue: { fontSize: 14, color: '#78350F', lineHeight: 20 },

  /* Tabs */
  tabs: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E0F2FE' },
  tabActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  tabTxt: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTxtActive: { color: '#fff', fontWeight: '800' },

  /* Section header */
  secHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  secTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  badge: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt: { fontSize: 12, fontWeight: '800', color: '#0EA5E9' },
  secAction: { backgroundColor: '#0EA5E9', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  secActionTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },

  /* Consultation cards */
  consultCard: {
    backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 10,
    padding: 14, borderWidth: 1.5, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  consultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  consultTypeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  consultTypeText: { fontSize: 12, fontWeight: '700' },
  consultDate: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  consultWeight: { fontSize: 11, color: '#10B981', fontWeight: '700', backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  consultTemp: { fontSize: 11, color: '#F59E0B', fontWeight: '700', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  consultField: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginTop: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  consultFieldLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  consultFieldValue: { fontSize: 13, color: '#1E293B', lineHeight: 19 },
  privateTag: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8, alignSelf: 'flex-start' },
  privateTagTxt: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },

  /* Record cards */
  recordCard: {
    backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 8,
    padding: 12, borderWidth: 1, borderColor: '#E0F2FE',
  },
  recordRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  recordDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  recordTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  recordMeta: { fontSize: 11, color: '#94A3B8' },
  recordDetail: { fontSize: 13, color: '#374151', marginTop: 6, lineHeight: 18 },

  /* Appointment cards */
  apptCard: {
    backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 8,
    padding: 12, borderWidth: 1, borderColor: '#E0F2FE', borderLeftWidth: 4, borderLeftColor: '#0EA5E9',
  },
  apptCardPast: { opacity: 0.65, borderLeftColor: '#E2E8F0' },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  apptTypeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  apptTypeTxt: { fontSize: 11, fontWeight: '700' },
  apptStatusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  apptStatusTxt: { fontSize: 11, fontWeight: '700' },
  apptDate: { fontSize: 12, color: '#374151', fontWeight: '600', marginLeft: 'auto' },
  apptNote: { fontSize: 12, color: '#64748B', marginTop: 6, lineHeight: 17 },

  /* Vaccine cards */
  alertBox: { backgroundColor: '#FFF1F2', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: '#FECACA' },
  alertTxt: { fontSize: 13, color: '#BE123C', fontWeight: '700' },
  vaccineCard: {
    backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 8,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 0,
    borderWidth: 1, borderColor: '#E0F2FE',
  },
  vaccineName: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  vaccineDate: { fontSize: 12, color: '#64748B' },
  vaccineNext: { borderRadius: 10, padding: 6 },

  /* Weight */
  weightCard: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, padding: 14, borderWidth: 1, borderColor: '#E0F2FE' },
  weightRow: { flexDirection: 'row', alignItems: 'center' },
  weightVal: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  weightDate: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  chartCard: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 12, borderWidth: 1, borderColor: '#E0F2FE', overflow: 'hidden' },

  // Modal medidas
  mLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 14 },
  mInput: { backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B' },

  /* Empty / remove */
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#E0F2FE' },
  emptyTxt: { fontSize: 14, fontWeight: '700', color: '#94A3B8', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#BAE6FD', textAlign: 'center' },
  removeBtn: { marginHorizontal: 16, marginTop: 24, paddingVertical: 14, alignItems: 'center' },
  removeBtnTxt: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
});
