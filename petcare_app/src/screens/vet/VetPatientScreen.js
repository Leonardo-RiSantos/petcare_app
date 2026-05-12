import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Image, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../hooks/useLayout';

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

const TYPE_CONFIG = {
  consulta:    { label: 'Consulta',    image: ICON_MEDICAL,  color: '#F43F5E', bg: '#FFE4E6' },
  cirurgia:    { label: 'Cirurgia',    image: ICON_MEDICAL,  color: '#8B5CF6', bg: '#EDE9FE' },
  exame:       { label: 'Exame',       image: ICON_MEDICAL,  color: '#F59E0B', bg: '#FEF3C7' },
  alergia:     { label: 'Alergia',     image: ICON_WARNING,  color: '#EF4444', bg: '#FFE4E6' },
  medicamento: { label: 'Medicamento', image: ICON_MEDICINE, color: '#EC4899', bg: '#FCE7F3' },
  outro:       { label: 'Outro',       image: ICON_MEDICAL,  color: '#64748B', bg: '#F1F5F9' },
};

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).split('T')[0].split('-');
  return `${day}/${m}/${y}`;
}

function calcAge(birthDate) {
  if (!birthDate) return null;
  const months = Math.floor((Date.now() - new Date(birthDate)) / (1000 * 60 * 60 * 24 * 30.44));
  return months < 12 ? `${months} meses` : `${Math.floor(months / 12)} anos`;
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

const ICON_CALENDAR = require('../../../assets/icon_late.png');

export default function VetPatientScreen({ route, navigation }) {
  const { petId } = route.params || {};
  const { user, vetProfile } = useAuth();
  const { isDesktop } = useLayout();
  const [pet, setPet] = useState(null);
  const [records, setRecords] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [weights, setWeights] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!petId) return;
    fetchData();
  }, [petId]);

  const fetchData = async () => {
    const [petRes, recRes, vacRes, wRes, apptRes] = await Promise.all([
      supabase.from('pets').select('id, name, species, breed, birth_date, photo_url, sex, neutered, weight_kg, health_notes, medications, user_id').eq('id', petId).single(),
      supabase.from('medical_records').select('id, type, title, description, date, veterinarian, diagnosis, prescription, created_by_role').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('vaccines').select('id, name, applied_date, next_dose_date').eq('pet_id', petId).order('applied_date', { ascending: false }),
      supabase.from('weight_records').select('id, weight_kg, date, notes').eq('pet_id', petId).order('date', { ascending: false }).limit(10),
      supabase.from('appointments').select('id, type, scheduled_date, scheduled_time, notes, status').eq('pet_id', petId).eq('vet_id', user.id).order('scheduled_date', { ascending: true }),
    ]);
    if (petRes.data) setPet(petRes.data);
    if (recRes.data) setRecords(recRes.data);
    if (vacRes.data) setVaccines(vacRes.data);
    if (wRes.data) setWeights(wRes.data);
    if (apptRes.data) setAppointments(apptRes.data);
    setLoading(false);
  };

  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const handleRemove = () => setShowRemoveModal(true);

  const confirmRemove = async () => {
    try {
      const { error } = await supabase.from('pet_vet_links')
        .update({ status: 'removed' })
        .eq('pet_id', petId)
        .eq('vet_id', user.id);
      if (!error) navigation.goBack();
    } catch (e) { /* silent */ }
    setShowRemoveModal(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  if (!pet) return null;

  const today = new Date();
  const in30 = new Date(); in30.setDate(today.getDate() + 30);
  const lateVac    = vaccines.filter(v => v.next_dose_date && new Date(v.next_dose_date) < today);
  const warnVac    = vaccines.filter(v => v.next_dose_date && new Date(v.next_dose_date) >= today && new Date(v.next_dose_date) <= in30);
  const okVac      = vaccines.filter(v => !v.next_dose_date || new Date(v.next_dose_date) > in30);
  const latestWeight = weights[0];

  // ── Blocos de conteúdo reutilizáveis em ambos os layouts ─────

  const patientCard = (
    <>
      {/* Hero do pet */}
      <LinearGradient
        colors={['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.bubble, { width: 160, height: 160, top: -40, right: -30 }]} />
        <View style={[styles.bubble, { width: 80, height: 80, bottom: -20, left: 20 }]} />

        {/* Foto ou ícone */}
        {pet.photo_url ? (
          <Image source={{ uri: pet.photo_url }} style={styles.petPhoto} />
        ) : (
          <View style={styles.petAvatarWrap}>
            {SPECIES_IMAGES[pet.species]
              ? <Image source={SPECIES_IMAGES[pet.species]} style={{ width: 52, height: 52 }} resizeMode="contain" />
              : <Text style={{ fontSize: 48 }}>🐾</Text>}
          </View>
        )}

        <Text style={styles.petName}>{pet.name}</Text>
        <Text style={styles.petSub}>
          {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
          {pet.birth_date ? ` · ${calcAge(pet.birth_date)}` : ''}
        </Text>

        <View style={styles.heroBadges}>
          {pet.sex      && <View style={styles.heroBadge}><Text style={styles.heroBadgeTxt}>{pet.sex}</Text></View>}
          {pet.neutered && <View style={styles.heroBadge}><Text style={styles.heroBadgeTxt}>Castrado(a)</Text></View>}
          {latestWeight && <View style={styles.heroBadge}><Text style={styles.heroBadgeTxt}>{latestWeight.weight_kg} kg</Text></View>}
        </View>
      </LinearGradient>

      {/* Saúde e medicamentos do pet */}
      {(pet.health_notes || pet.medications) && (
        <View style={styles.healthCard}>
          <View style={styles.healthCardHeader}>
            <Image source={ICON_MEDICAL} style={{ width: 18, height: 18 }} resizeMode="contain" />
            <Text style={styles.healthCardTitle}>Informações de Saúde</Text>
          </View>
          {pet.health_notes && (
            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>Condição de saúde</Text>
              <Text style={styles.healthValue}>{pet.health_notes}</Text>
            </View>
          )}
          {pet.medications && (
            <View style={[styles.healthRow, pet.health_notes && styles.healthRowBorder]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Image source={ICON_MEDICINE} style={{ width: 14, height: 14 }} resizeMode="contain" />
                <Text style={styles.healthLabel}>Medicamentos em uso</Text>
              </View>
              <Text style={[styles.healthValue, { color: '#EC4899' }]}>{pet.medications}</Text>
            </View>
          )}
        </View>
      )}

      {/* Status vacinas */}
      {vaccines.length > 0 && (
        <View style={styles.statusRow}>
          <StatusPill icon={ICON_CHECK}   count={okVac.length}   label="Em dia"    bg="#F0FDF4" labelColor="#16A34A" />
          <StatusPill icon={ICON_WARNING} count={warnVac.length} label="Vencendo"  bg="#FFFBEB" labelColor="#D97706" />
          <StatusPill icon={ICON_LATE}    count={lateVac.length} label="Atrasadas" bg="#FFF1F2" labelColor="#DC2626" />
        </View>
      )}

      {/* Alerta vacinas atrasadas */}
      {lateVac.length > 0 && (
        <View style={styles.alertBanner}>
          <Image source={ICON_LATE} style={{ width: 28, height: 28 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>{lateVac.length} vacina(s) em atraso!</Text>
            {lateVac.map(v => (
              <Text key={v.id} style={styles.alertItem}>• {v.name} — venceu em {formatDate(v.next_dose_date)}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Remover acesso — no painel esquerdo em desktop */}
      {isDesktop && (
        <TouchableOpacity style={[styles.removeBtn, { marginTop: 20 }]} onPress={handleRemove}>
          <Text style={styles.removeBtnText}>Remover acesso a este paciente</Text>
        </TouchableOpacity>
      )}
    </>
  );

  const clinicalPanel = (
    <>
      {/* Ações */}
      <View style={styles.actionRow}>
        {/* Prontuário estruturado — botão principal */}
        <TouchableOpacity
          style={[styles.actionBtnWrap, { flex: 1 }]}
          onPress={() => navigation.navigate('VetConsultation', {
            petId, petName: pet.name,
          })}
        >
          <LinearGradient
            colors={['#0284C7', '#0EA5E9']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.actionBtn}
          >
            <Image source={ICON_MEDICAL} style={{ width: 18, height: 18, marginRight: 6 }} resizeMode="contain" />
            <Text style={styles.actionBtnText}>Nova Consulta</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Registro simples */}
        <TouchableOpacity
          style={[styles.actionBtnWrap, { flex: 1 }]}
          onPress={() => navigation.navigate('AddMedicalRecord', {
            petId, petName: pet.name, isVet: true,
            vetName: vetProfile?.full_name || '',
          })}
        >
          <LinearGradient
            colors={['#10B981', '#34D399']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.actionBtn}
          >
            <Image source={ICON_MEDICAL} style={{ width: 18, height: 18, marginRight: 6 }} resizeMode="contain" />
            <Text style={styles.actionBtnText}>Reg. Simples</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtnWrap, { flex: 1 }]}
          onPress={() => navigation.navigate('VetAddAppointment', {
            petId, petName: pet.name, tutorId: pet.user_id,
          })}
        >
          <LinearGradient
            colors={['#7C3AED', '#A78BFA']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.actionBtn}
          >
            <Image source={ICON_CALENDAR} style={{ width: 18, height: 18, marginRight: 6 }} resizeMode="contain" />
            <Text style={styles.actionBtnText}>Agendar</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Chat com tutor — só aparece se vet habilitou o chat */}
        {vetProfile?.chat_enabled && (
          <TouchableOpacity
            style={[styles.actionBtnWrap, { flex: 1 }]}
            onPress={() => navigation.navigate('VetChat', {
              petId, petName: pet.name, tutorId: pet.user_id,
            })}
          >
            <LinearGradient
              colors={['#F59E0B', '#FBBF24']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.actionBtn}
            >
              <Text style={{ fontSize: 14, marginRight: 4 }}>💬</Text>
              <Text style={styles.actionBtnText}>Chat</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Vacinas */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Vacinas</Text>
        <View style={styles.countBadge}><Text style={styles.countTxt}>{vaccines.length}</Text></View>
      </View>
      <View style={styles.card}>
        {vaccines.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma vacina registrada pelo tutor</Text>
        ) : (
          vaccines.map((v, i) => {
            const late = v.next_dose_date && new Date(v.next_dose_date) < today;
            const warn = v.next_dose_date && !late && new Date(v.next_dose_date) <= in30;
            return (
              <View key={v.id} style={[styles.vaccineRow, i > 0 && styles.rowBorder]}>
                <Image
                  source={late ? ICON_LATE : warn ? ICON_WARNING : ICON_CHECK}
                  style={{ width: 22, height: 22 }} resizeMode="contain"
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.vaccineName}>{v.name}</Text>
                  <Text style={styles.vaccineDate}>Aplicada: {formatDate(v.applied_date)}</Text>
                </View>
                {v.next_dose_date && (
                  <Text style={[styles.vaccineNext, late && { color: '#EF4444' }, warn && { color: '#D97706' }]}>
                    Reforço: {formatDate(v.next_dose_date)}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Histórico médico */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Histórico Médico</Text>
        <View style={styles.countBadge}><Text style={styles.countTxt}>{records.length}</Text></View>
      </View>
      {records.length === 0 ? (
        <View style={styles.card}><Text style={styles.emptyText}>Nenhum registro médico</Text></View>
      ) : (
        records.map(r => {
          const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.outro;
          return (
            <View key={r.id} style={styles.recordCard}>
              <View style={styles.recordTop}>
                <View style={[styles.recordIconWrap, { backgroundColor: cfg.bg }]}>
                  <Image source={cfg.image} style={{ width: 20, height: 20 }} resizeMode="contain" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.recordTitle}>{r.title}</Text>
                  <Text style={styles.recordMeta}>
                    {cfg.label} · {formatDate(r.date)}
                    {r.veterinarian ? ` · ${r.veterinarian}` : ''}
                  </Text>
                </View>
                <View style={[styles.roleBadge, r.created_by_role === 'vet' ? styles.roleBadgeVet : styles.roleBadgeTutor]}>
                  <Image
                    source={r.created_by_role === 'vet' ? ICON_MEDICAL : require('../../../assets/icon_profile.png')}
                    style={{ width: 11, height: 11, marginRight: 3 }}
                    resizeMode="contain"
                  />
                  <Text style={styles.roleBadgeTxt}>
                    {r.created_by_role === 'vet' ? 'Vet' : 'Tutor'}
                  </Text>
                </View>
              </View>
              {r.description  && <Text style={styles.recordField}>{r.description}</Text>}
              {r.diagnosis    && <Text style={styles.recordField}><Text style={styles.fieldLabel}>Diagnóstico: </Text>{r.diagnosis}</Text>}
              {r.prescription && <Text style={styles.recordField}><Text style={styles.fieldLabel}>Prescrição: </Text>{r.prescription}</Text>}
              {r.next_appointment && (
                <Text style={[styles.recordField, { color: '#0EA5E9', fontWeight: '600' }]}>
                  Próxima consulta: {formatDate(r.next_appointment)}
                </Text>
              )}
            </View>
          );
        })
      )}

      {/* Histórico de peso */}
      {weights.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Histórico de Peso</Text>
            <View style={styles.countBadge}><Text style={styles.countTxt}>{weights.length}</Text></View>
          </View>
          <View style={styles.card}>
            {weights.map((w, i) => (
              <View key={w.id} style={[styles.weightRow, i > 0 && styles.rowBorder]}>
                <Text style={styles.weightDate}>{formatDate(w.date)}</Text>
                <Text style={styles.weightVal}>{w.weight_kg} kg</Text>
                {w.notes ? <Text style={styles.weightNote}>{w.notes}</Text> : null}
              </View>
            ))}
          </View>
        </>
      )}

      {/* Agendamentos */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Agendamentos</Text>
        <View style={styles.countBadge}><Text style={styles.countTxt}>{appointments.length}</Text></View>
      </View>
      {appointments.length === 0 ? (
        <View style={styles.card}><Text style={styles.emptyText}>Nenhum agendamento cadastrado</Text></View>
      ) : (
        appointments.map(a => {
          const isPast = new Date(a.scheduled_date) < new Date(new Date().toDateString());
          const [y, m, d] = a.scheduled_date.split('-');
          const dateStr = `${d}/${m}/${y}`;
          const apptTypes = { consulta: { label: 'Consulta', color: '#0EA5E9', bg: '#EFF6FF' }, retorno: { label: 'Retorno', color: '#10B981', bg: '#DCFCE7' }, cirurgia: { label: 'Cirurgia', color: '#8B5CF6', bg: '#EDE9FE' }, exame: { label: 'Exame', color: '#F59E0B', bg: '#FEF3C7' }, outro: { label: 'Outro', color: '#64748B', bg: '#F1F5F9' } };
          const cfg = apptTypes[a.type] || apptTypes.outro;
          return (
            <View key={a.id} style={[styles.apptCard, isPast && styles.apptCardPast]}>
              <View style={styles.apptTop}>
                <View style={[styles.apptTypeBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.apptTypeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                <Text style={styles.apptDate}>
                  📅 {dateStr}{a.scheduled_time ? ` às ${a.scheduled_time}` : ''}
                </Text>
                {isPast && (
                  <View style={styles.apptPastBadge}>
                    <Text style={styles.apptPastText}>Passado</Text>
                  </View>
                )}
              </View>
              {a.notes ? (
                <Text style={styles.apptNotes}>{a.notes}</Text>
              ) : null}
            </View>
          );
        })
      )}

      {/* Remover acesso — no painel clínico em mobile */}
      {!isDesktop && (
        <TouchableOpacity style={styles.removeBtn} onPress={handleRemove}>
          <Text style={styles.removeBtnText}>Remover acesso a este paciente</Text>
        </TouchableOpacity>
      )}

      {/* Modal confirmação remoção — web-compatible */}
      <Modal visible={showRemoveModal} transparent animationType="fade" onRequestClose={() => setShowRemoveModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: '#1E293B', marginBottom: 8, textAlign: 'center' }}>
              Remover paciente?
            </Text>
            <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Você perderá o acesso ao histórico de{' '}
              <Text style={{ fontWeight: '700', color: '#1E293B' }}>{pet?.name}</Text>.
            </Text>
            <TouchableOpacity
              style={{ width: '100%', backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}
              onPress={confirmRemove}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Sim, remover</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: '100%', backgroundColor: '#F1F5F9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              onPress={() => setShowRemoveModal(false)}
            >
              <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '700' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );

  // ── Render final ────────────────────────────────────────────

  if (isDesktop) {
    return (
      <View style={styles.desktopRoot}>
        {/* Painel esquerdo: ficha do paciente (fixo, rolável) */}
        <ScrollView
          style={styles.desktopLeft}
          contentContainerStyle={styles.desktopLeftContent}
          showsVerticalScrollIndicator={false}
        >
          {patientCard}
        </ScrollView>

        {/* Painel direito: prontuário clínico (rolável) */}
        <ScrollView
          style={styles.desktopRight}
          contentContainerStyle={styles.desktopRightContent}
          showsVerticalScrollIndicator={false}
        >
          {clinicalPanel}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {patientCard}
      {clinicalPanel}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: { paddingTop: 28, paddingBottom: 28, paddingHorizontal: 24, alignItems: 'center', overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  petPhoto: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)', marginBottom: 12 },
  petAvatarWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  petName: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  petSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  heroBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  heroBadgeTxt: { fontSize: 12, color: '#fff', fontWeight: '600' },

  statusRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 16 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10 },
  pillIcon: { width: 20, height: 20 },
  pillCount: { fontSize: 16, fontWeight: '800' },
  pillLabel: { fontSize: 11, fontWeight: '600', flex: 1 },

  alertBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 20, marginTop: 12,
    backgroundColor: '#FFF1F2', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#FECDD3',
  },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#DC2626', marginBottom: 4 },
  alertItem: { fontSize: 12, color: '#9A3412', marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 16 },
  actionBtnWrap: { borderRadius: 16, overflow: 'hidden' },
  actionBtn: { flexDirection: 'row', paddingVertical: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  apptCard: {
    backgroundColor: '#fff', borderRadius: 18, marginHorizontal: 20, marginBottom: 10, padding: 16,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#EDE9FE',
  },
  apptCardPast: { opacity: 0.6 },
  apptTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  apptTypeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  apptTypeText: { fontSize: 12, fontWeight: '700' },
  apptDate: { fontSize: 13, color: '#374151', fontWeight: '600', flex: 1 },
  apptPastBadge: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  apptPastText: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  apptNotes: { fontSize: 13, color: '#64748B', marginTop: 8, lineHeight: 19 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  countBadge: { backgroundColor: '#E0F2FE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  countTxt: { fontSize: 12, fontWeight: '700', color: '#0369A1' },

  card: {
    backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 20, padding: 16,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#EFF6FF',
  },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },

  vaccineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  vaccineName: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  vaccineDate: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  vaccineNext: { fontSize: 12, fontWeight: '600', color: '#16A34A' },

  recordCard: {
    backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 20, marginBottom: 10, padding: 16,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#EFF6FF',
  },
  recordTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  recordIconWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  recordTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  recordMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  roleBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center' },
  roleBadgeVet: { backgroundColor: '#EFF6FF' },
  roleBadgeTutor: { backgroundColor: '#F1F5F9' },
  roleBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  recordField: { fontSize: 13, color: '#374151', marginTop: 4, lineHeight: 19 },
  fieldLabel: { fontWeight: '700', color: '#1E293B' },

  weightRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  weightDate: { fontSize: 13, color: '#64748B', flex: 1 },
  weightVal: { fontSize: 15, fontWeight: '800', color: '#0EA5E9' },
  weightNote: { fontSize: 12, color: '#94A3B8' },

  removeBtn: { marginHorizontal: 20, marginTop: 24, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#FECDD3' },
  removeBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },

  // ── Desktop two-column layout ────────────────────────────────
  desktopRoot: {
    flex: 1, flexDirection: 'row', backgroundColor: '#F0F9FF',
    maxWidth: 1280, alignSelf: 'center', width: '100%',
  },
  desktopLeft: {
    width: 400,
    borderRightWidth: 1, borderRightColor: '#E0F2FE',
    backgroundColor: '#F8FAFF',
  },
  desktopLeftContent: { paddingBottom: 40 },
  desktopRight: { flex: 1, backgroundColor: '#F0F9FF' },
  desktopRightContent: { paddingBottom: 60 },

  // Card de saúde do pet
  healthCard: {
    backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 20, marginTop: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#FCE7F3',
    shadowColor: '#EC4899', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  healthCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  healthCardTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  healthRow: { paddingTop: 10 },
  healthRowBorder: { borderTopWidth: 1, borderTopColor: '#FEF3C7', marginTop: 10 },
  healthLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  healthValue: { fontSize: 13, color: '#374151', lineHeight: 20 },
});
