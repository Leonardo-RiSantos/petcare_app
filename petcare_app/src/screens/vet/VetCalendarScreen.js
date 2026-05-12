import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DatePickerInput from '../../components/DatePickerInput';

const TYPE_LABELS  = { consulta: 'Consulta', retorno: 'Retorno', cirurgia: 'Cirurgia', exame: 'Exame', vacinacao: 'Vacinação', outro: 'Outro' };
const TYPE_COLORS  = { consulta: '#0EA5E9', retorno: '#10B981', cirurgia: '#8B5CF6', exame: '#F59E0B', vacinacao: '#16A34A', outro: '#64748B' };
const STATUS_LABELS = { scheduled: 'Agendado', confirmed: 'Confirmado', completed: 'Realizado', cancelled: 'Cancelado', no_show: 'Faltou', pending_approval: 'Aguardando' };
const STATUS_COLORS = { scheduled: '#0EA5E9', confirmed: '#10B981', completed: '#64748B', cancelled: '#EF4444', no_show: '#F59E0B', pending_approval: '#7C3AED' };

const DAYS_PT   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const HOURS     = Array.from({ length: 13 }, (_, i) => 7 + i); // 7h–19h

const toISO   = (ddmmyyyy) => { const m = ddmmyyyy?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const fromISO = (iso) => { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };
const fmtTime = (t) => { const d = t.replace(/\D/g,'').slice(0,4); if (d.length<=2) return d; return `${d.slice(0,2)}:${d.slice(2)}`; };

function getWeekDays(pivot) {
  const d = new Date(pivot);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(mon.getDate() + i); return dd; });
}

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startDay = first.getDay(); // 0=Sun
  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

export default function VetCalendarScreen({ navigation, route }) {
  const canGoBack = navigation.canGoBack();
  const { user } = useAuth();
  const today = new Date();
  const [pivot, setPivot]           = useState(today);
  const [view, setView]             = useState('week'); // 'month' | 'week' | 'day'
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [editAppt, setEditAppt]     = useState(null);
  const [savingAppt, setSavingAppt] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailAppt, setDetailAppt] = useState(null);

  const emptyForm = () => ({
    patient_name: '', scheduled_date: '', scheduled_time: '',
    duration_minutes: '30', type: 'consulta', status: 'scheduled', notes: '',
  });
  const [form, setForm] = useState(emptyForm());
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Range to fetch based on view
  const getRange = () => {
    if (view === 'month') {
      return {
        start: new Date(pivot.getFullYear(), pivot.getMonth(), 1).toISOString().slice(0,10),
        end:   new Date(pivot.getFullYear(), pivot.getMonth()+1, 0).toISOString().slice(0,10),
      };
    }
    if (view === 'day') {
      const iso = pivot.toISOString().slice(0,10);
      return { start: iso, end: iso };
    }
    const week = getWeekDays(pivot);
    return { start: week[0].toISOString().slice(0,10), end: week[6].toISOString().slice(0,10) };
  };

  const fetchData = async () => {
    const { start, end } = getRange();
    const { data } = await supabase
      .from('vet_schedule')
      .select('*')
      .eq('vet_id', user.id)
      .gte('scheduled_date', start)
      .lte('scheduled_date', end)
      .order('scheduled_date').order('scheduled_time');
    if (data) setAppointments(data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [view, pivot.toISOString().slice(0,7)]));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const apptsByDate = {};
  appointments.forEach(a => {
    if (!apptsByDate[a.scheduled_date]) apptsByDate[a.scheduled_date] = [];
    apptsByDate[a.scheduled_date].push(a);
  });

  const openNew = (date) => {
    setEditAppt(null);
    setForm({ ...emptyForm(), scheduled_date: fromISO(date) });
    setShowModal(true);
  };

  const openEdit = (appt) => {
    setEditAppt(appt);
    setForm({
      patient_name: appt.patient_name || '',
      scheduled_date: fromISO(appt.scheduled_date),
      scheduled_time: appt.scheduled_time?.slice(0,5) || '',
      duration_minutes: String(appt.duration_minutes || 30),
      type: appt.type || 'consulta',
      status: appt.status || 'scheduled',
      notes: appt.notes || '',
    });
    setShowModal(true);
  };

  const openDetail = (appt) => { setDetailAppt(appt); setShowDetail(true); };

  const saveAppt = async () => {
    const isoDate = toISO(form.scheduled_date);
    if (!isoDate || !form.patient_name) return;
    setSavingAppt(true);
    const payload = {
      vet_id: user.id,
      patient_name: form.patient_name,
      scheduled_date: isoDate,
      scheduled_time: form.scheduled_time || null,
      duration_minutes: parseInt(form.duration_minutes) || 30,
      type: form.type,
      status: form.status,
      notes: form.notes || null,
    };
    if (editAppt) {
      await supabase.from('vet_schedule').update(payload).eq('id', editAppt.id);
    } else {
      await supabase.from('vet_schedule').insert(payload);
    }
    setSavingAppt(false);
    setShowModal(false);
    fetchData();
  };

  const deleteAppt = async () => {
    if (!editAppt) return;
    await supabase.from('vet_schedule').delete().eq('id', editAppt.id);
    setShowModal(false);
    fetchData();
  };

  const acceptRequest = async (appt) => {
    await supabase.from('vet_schedule').update({
      status: 'confirmed', responded_at: new Date().toISOString(),
    }).eq('id', appt.id);
    setShowDetail(false);
    fetchData();
  };

  const rejectRequest = async (appt) => {
    await supabase.from('vet_schedule').update({
      status: 'cancelled', responded_at: new Date().toISOString(),
    }).eq('id', appt.id);
    setShowDetail(false);
    fetchData();
  };

  // ── Navigation ────────────────────────────────────────────
  const prev = () => {
    const d = new Date(pivot);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setPivot(d);
  };
  const next = () => {
    const d = new Date(pivot);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setPivot(d);
  };

  const periodLabel = () => {
    if (view === 'month') return `${MONTHS_PT[pivot.getMonth()]} ${pivot.getFullYear()}`;
    if (view === 'day') return `${DAYS_PT[pivot.getDay()]}, ${pivot.getDate()} de ${MONTHS_PT[pivot.getMonth()]}`;
    const week = getWeekDays(pivot);
    return `${week[0].getDate()} – ${week[6].getDate()} de ${MONTHS_PT[week[6].getMonth()]}`;
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;

  return (
    <View style={styles.container}>
      {/* Toolbar de navegação */}
      <LinearGradient colors={['#0284C7', '#0EA5E9']} style={styles.toolbar}>
        {canGoBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.navBtn, { marginRight: 4 }]}>
            <Text style={styles.navTxt}>←</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={prev} style={styles.navBtn}><Text style={styles.navTxt}>‹</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setPivot(new Date())} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.periodLabel}>{periodLabel()}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={next} style={styles.navBtn}><Text style={styles.navTxt}>›</Text></TouchableOpacity>
      </LinearGradient>

      {/* Seletor de nível */}
      <View style={styles.levelRow}>
        {['month', 'week', 'day'].map(v => (
          <TouchableOpacity key={v} onPress={() => setView(v)}
            style={[styles.levelBtn, view === v && styles.levelBtnActive]}>
            <Text style={[styles.levelTxt, view === v && styles.levelTxtActive]}>
              {v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Dia'}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.pendingIndicator}>
          {appointments.filter(a => a.status === 'pending_approval').length > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeTxt}>
                {appointments.filter(a => a.status === 'pending_approval').length} aguardando
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
      >
        {/* ── VISÃO MÊS ── */}
        {view === 'month' && (() => {
          const days = getMonthDays(pivot.getFullYear(), pivot.getMonth());
          return (
            <View style={styles.monthGrid}>
              {DAYS_PT.map(d => <Text key={d} style={styles.monthDayName}>{d}</Text>)}
              {days.map((day, i) => {
                if (!day) return <View key={`empty-${i}`} style={styles.monthCell} />;
                const iso = day.toISOString().slice(0,10);
                const todayISO = today.toISOString().slice(0,10);
                const isToday = iso === todayISO;
                const appts = apptsByDate[iso] || [];
                const pending = appts.filter(a => a.status === 'pending_approval');
                return (
                  <TouchableOpacity key={iso} style={styles.monthCell}
                    onPress={() => { setPivot(day); setView('day'); }}>
                    <View style={[styles.monthDayNum, isToday && styles.monthDayNumToday]}>
                      <Text style={[styles.monthDayTxt, isToday && { color: '#fff' }]}>{day.getDate()}</Text>
                    </View>
                    {appts.length > 0 && (
                      <View style={styles.monthDots}>
                        {pending.length > 0 && <View style={[styles.monthDot, { backgroundColor: '#7C3AED' }]} />}
                        {appts.filter(a => a.status !== 'pending_approval').slice(0,2).map((a, j) => (
                          <View key={j} style={[styles.monthDot, { backgroundColor: TYPE_COLORS[a.type] || '#0EA5E9' }]} />
                        ))}
                        {appts.length > 3 && <Text style={styles.monthMore}>+{appts.length - 3}</Text>}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })()}

        {/* ── VISÃO SEMANA ── */}
        {view === 'week' && (() => {
          const weekDays = getWeekDays(pivot);
          return (
            <>
              <View style={styles.weekDaysRow}>
                {weekDays.map((d, i) => {
                  const iso = d.toISOString().slice(0,10);
                  const isToday = iso === today.toISOString().slice(0,10);
                  const count = apptsByDate[iso]?.length || 0;
                  return (
                    <TouchableOpacity key={i} style={styles.weekDayCol}
                      onPress={() => { setPivot(d); setView('day'); }}>
                      <Text style={[styles.weekDayName, isToday && { color: '#0EA5E9' }]}>{DAYS_PT[d.getDay()]}</Text>
                      <View style={[styles.weekDayNum, isToday && styles.weekDayNumToday]}>
                        <Text style={[styles.weekDayTxt, isToday && { color: '#fff' }]}>{d.getDate()}</Text>
                      </View>
                      {count > 0 && <View style={styles.weekDot}><Text style={styles.weekDotTxt}>{count}</Text></View>}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {weekDays.map(d => {
                const iso = d.toISOString().slice(0,10);
                const appts = apptsByDate[iso] || [];
                const isToday = iso === today.toISOString().slice(0,10);
                return (
                  <View key={iso} style={{ paddingHorizontal: 16 }}>
                    <View style={styles.dayHeader}>
                      <Text style={[styles.dayHeaderTxt, isToday && { color: '#0EA5E9' }]}>
                        {DAYS_PT[d.getDay()]}, {d.getDate()} {isToday ? '· Hoje' : ''}
                      </Text>
                      <TouchableOpacity onPress={() => openNew(iso)} style={styles.addDayBtn}>
                        <Text style={styles.addDayTxt}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {appts.length === 0
                      ? <TouchableOpacity style={styles.emptyDay} onPress={() => openNew(iso)}><Text style={styles.emptyDayTxt}>Toque para agendar</Text></TouchableOpacity>
                      : appts.map(a => <ApptCard key={a.id} appt={a} onPress={() => openDetail(a)} onEdit={() => openEdit(a)} />)}
                  </View>
                );
              })}
            </>
          );
        })()}

        {/* ── VISÃO DIA ── */}
        {view === 'day' && (() => {
          const iso = pivot.toISOString().slice(0,10);
          const dayAppts = (apptsByDate[iso] || []).sort((a,b) => (a.scheduled_time||'').localeCompare(b.scheduled_time||''));
          return (
            <View style={{ paddingHorizontal: 16 }}>
              {HOURS.map(h => {
                const hStr = `${String(h).padStart(2,'0')}:`;
                const slotAppts = dayAppts.filter(a => a.scheduled_time?.startsWith(String(h).padStart(2,'0')));
                return (
                  <View key={h} style={styles.hourRow}>
                    <Text style={styles.hourLabel}>{hStr}00</Text>
                    <View style={styles.hourContent}>
                      {slotAppts.length === 0
                        ? <TouchableOpacity style={styles.hourEmpty} onPress={() => openNew(iso)}>
                            <Text style={styles.hourEmptyTxt}>+ agendar</Text>
                          </TouchableOpacity>
                        : slotAppts.map(a => <ApptCard key={a.id} appt={a} onPress={() => openDetail(a)} onEdit={() => openEdit(a)} />)}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })()}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => openNew(pivot.toISOString().slice(0,10))} activeOpacity={0.85}>
        <LinearGradient colors={['#0284C7', '#0EA5E9']} style={styles.fabGrad}>
          <Text style={styles.fabTxt}>+ Agendar</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Modal detalhe do agendamento ── */}
      <Modal visible={showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowDetail(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            {detailAppt && (() => {
              const color = TYPE_COLORS[detailAppt.type] || '#64748B';
              const sc    = STATUS_COLORS[detailAppt.status] || '#64748B';
              const isPending = detailAppt.status === 'pending_approval';
              return (
                <View style={styles.sheet}>
                  <View style={styles.sheetHandle} />
                  <View style={[styles.detailStripe, { backgroundColor: color }]} />

                  <View style={styles.detailHeader}>
                    <Text style={styles.detailPatient}>{detailAppt.patient_name || 'Paciente'}</Text>
                    <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
                      <Text style={[styles.typeBadgeTxt, { color }]}>{TYPE_LABELS[detailAppt.type] || detailAppt.type}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Data e Horário</Text>
                    <Text style={styles.detailValue}>
                      {fromISO(detailAppt.scheduled_date)}
                      {detailAppt.scheduled_time ? ` às ${detailAppt.scheduled_time.slice(0,5)}` : ''}
                      {` · ${detailAppt.duration_minutes || 30} min`}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={[styles.statusPill, { backgroundColor: sc + '20' }]}>
                      <Text style={[styles.statusPillTxt, { color: sc }]}>{STATUS_LABELS[detailAppt.status] || detailAppt.status}</Text>
                    </View>
                  </View>

                  {detailAppt.notes && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Observações</Text>
                      <Text style={styles.detailValue}>{detailAppt.notes}</Text>
                    </View>
                  )}

                  {detailAppt.request_message && (
                    <View style={[styles.detailRow, { backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12 }]}>
                      <Text style={[styles.detailLabel, { color: '#7C3AED' }]}>Mensagem do tutor</Text>
                      <Text style={styles.detailValue}>{detailAppt.request_message}</Text>
                    </View>
                  )}

                  {/* Aceitar/Recusar solicitação */}
                  {isPending ? (
                    <View style={styles.requestBtns}>
                      <TouchableOpacity style={[styles.requestBtn, styles.acceptBtn]} onPress={() => acceptRequest(detailAppt)}>
                        <Text style={styles.acceptBtnTxt}>✓ Aceitar agendamento</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.requestBtn, styles.rejectBtn]} onPress={() => rejectRequest(detailAppt)}>
                        <Text style={styles.rejectBtnTxt}>✕ Recusar agendamento</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.editDetailBtn}
                      onPress={() => { setShowDetail(false); openEdit(detailAppt); }}
                    >
                      <Text style={styles.editDetailTxt}>Editar agendamento</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnTxt}>Fechar</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal novo/editar ── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{editAppt ? 'Editar agendamento' : 'Novo agendamento'}</Text>

              <Text style={styles.label}>Paciente *</Text>
              <TextInput style={styles.input} value={form.patient_name} onChangeText={v => setF('patient_name', v)} placeholder="Nome do paciente" placeholderTextColor="#9CA3AF" />

              <Text style={styles.label}>Data *</Text>
              <DatePickerInput value={form.scheduled_date} onChangeText={v => setF('scheduled_date', v)} label="Data" />

              <Text style={styles.label}>Horário</Text>
              <TextInput style={styles.input} value={form.scheduled_time} onChangeText={v => setF('scheduled_time', fmtTime(v))} placeholder="HH:MM" placeholderTextColor="#9CA3AF" keyboardType="numeric" maxLength={5} />

              <Text style={styles.label}>Duração (min)</Text>
              <TextInput style={styles.input} value={form.duration_minutes} onChangeText={v => setF('duration_minutes', v)} placeholder="30" placeholderTextColor="#9CA3AF" keyboardType="numeric" />

              <Text style={styles.label}>Tipo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {Object.entries(TYPE_LABELS).map(([k, l]) => {
                  const c = TYPE_COLORS[k]; const active = form.type === k;
                  return <TouchableOpacity key={k} onPress={() => setF('type', k)} style={[styles.chip, active && { backgroundColor: c + '20', borderColor: c }]}>
                    <Text style={[styles.chipTxt, active && { color: c, fontWeight: '700' }]}>{l}</Text>
                  </TouchableOpacity>;
                })}
              </ScrollView>

              <Text style={[styles.label, { marginTop: 14 }]}>Observações</Text>
              <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} value={form.notes} onChangeText={v => setF('notes', v)} placeholder="Instruções para o paciente..." placeholderTextColor="#9CA3AF" multiline />

              <TouchableOpacity style={{ borderRadius: 14, overflow: 'hidden', marginTop: 20 }} onPress={saveAppt} disabled={savingAppt}>
                <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center' }}>
                  {savingAppt ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Salvar</Text>}
                </LinearGradient>
              </TouchableOpacity>
              {editAppt && <TouchableOpacity onPress={deleteAppt} style={{ alignItems: 'center', paddingVertical: 14 }}><Text style={{ color: '#EF4444', fontWeight: '700' }}>Excluir</Text></TouchableOpacity>}
              <TouchableOpacity onPress={() => setShowModal(false)} style={{ alignItems: 'center', paddingBottom: 24 }}><Text style={{ color: '#94A3B8', fontWeight: '600' }}>Cancelar</Text></TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function ApptCard({ appt, onPress, onEdit }) {
  const color = TYPE_COLORS[appt.type] || '#64748B';
  const sc    = STATUS_COLORS[appt.status] || '#64748B';
  const isPending = appt.status === 'pending_approval';
  return (
    <TouchableOpacity style={[styles.apptCard, isPending && { borderColor: '#7C3AED', borderWidth: 2 }]} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.apptStripe, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.apptRow}>
          <Text style={styles.apptTime}>{appt.scheduled_time?.slice(0,5) || '—'}</Text>
          <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.typeBadgeTxt, { color }]}>{TYPE_LABELS[appt.type] || appt.type}</Text>
          </View>
          {isPending && <View style={[styles.typeBadge, { backgroundColor: '#EDE9FE' }]}>
            <Text style={[styles.typeBadgeTxt, { color: '#7C3AED' }]}>Aguardando</Text>
          </View>}
        </View>
        <Text style={styles.apptPatient}>{appt.patient_name || 'Paciente'}</Text>
        {appt.notes ? <Text style={styles.apptNotes} numberOfLines={1}>{appt.notes}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  navBtn:  { padding: 8 },
  navTxt:  { fontSize: 24, color: '#fff', fontWeight: '300' },
  periodLabel: { fontSize: 14, fontWeight: '800', color: '#fff', textAlign: 'center' },

  levelRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0F2FE', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  levelBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
  levelBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#0EA5E9' },
  levelTxt: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  levelTxtActive: { color: '#0EA5E9', fontWeight: '800' },
  pendingIndicator: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  pendingBadge: { backgroundColor: '#EDE9FE', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  pendingBadgeTxt: { fontSize: 11, color: '#7C3AED', fontWeight: '700' },

  // Month
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  monthDayName: { width: '14.28%', textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#94A3B8', paddingVertical: 6 },
  monthCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  monthDayNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  monthDayNumToday: { backgroundColor: '#0EA5E9' },
  monthDayTxt: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  monthDots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  monthDot: { width: 6, height: 6, borderRadius: 3 },
  monthMore: { fontSize: 8, color: '#94A3B8' },

  // Week
  weekDaysRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0F2FE' },
  weekDayCol: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4 },
  weekDayName: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  weekDayNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  weekDayNumToday: { backgroundColor: '#0EA5E9' },
  weekDayTxt: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  weekDot: { backgroundColor: '#0EA5E9', borderRadius: 10, minWidth: 16, paddingHorizontal: 3, alignItems: 'center' },
  weekDotTxt: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Day header
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 16 },
  dayHeaderTxt: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  addDayBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  addDayTxt: { fontSize: 18, color: '#0EA5E9', fontWeight: '300', lineHeight: 22 },
  emptyDay: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#E0F2FE', borderStyle: 'dashed' },
  emptyDayTxt: { fontSize: 12, color: '#BAE6FD', fontWeight: '600' },

  // Day/Hour
  hourRow: { flexDirection: 'row', minHeight: 56, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  hourLabel: { width: 44, fontSize: 11, color: '#94A3B8', fontWeight: '600', paddingTop: 8 },
  hourContent: { flex: 1, paddingVertical: 4 },
  hourEmpty: { flex: 1, justifyContent: 'center', paddingLeft: 8 },
  hourEmptyTxt: { fontSize: 11, color: '#CBD5E1' },

  // Appointment card
  apptCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  apptStripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  apptTime: { fontSize: 13, fontWeight: '900', color: '#1E293B' },
  apptPatient: { fontSize: 13, fontWeight: '700', color: '#374151' },
  apptNotes: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  typeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeTxt: { fontSize: 11, fontWeight: '700' },

  // Detail modal
  detailStripe: { height: 4, borderRadius: 2, marginBottom: 16 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  detailPatient: { flex: 1, fontSize: 18, fontWeight: '900', color: '#1E293B' },
  detailRow: { marginBottom: 14 },
  detailLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 4 },
  detailValue: { fontSize: 14, color: '#374151', fontWeight: '500' },
  statusPill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillTxt: { fontSize: 12, fontWeight: '700' },

  requestBtns: { gap: 10, marginTop: 16 },
  requestBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  acceptBtn: { backgroundColor: '#DCFCE7' },
  acceptBtnTxt: { color: '#16A34A', fontWeight: '800', fontSize: 15 },
  rejectBtn: { backgroundColor: '#FEE2E2' },
  rejectBtnTxt: { color: '#EF4444', fontWeight: '800', fontSize: 15 },

  editDetailBtn: { backgroundColor: '#EFF6FF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  editDetailTxt: { color: '#0EA5E9', fontWeight: '700', fontSize: 14 },
  closeBtn: { alignItems: 'center', paddingVertical: 14 },
  closeBtnTxt: { color: '#94A3B8', fontWeight: '600' },

  // FAB
  fab: { position: 'absolute', bottom: 20, right: 20, borderRadius: 28, overflow: 'hidden', elevation: 6, shadowColor: '#0284C7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
  fabGrad: { paddingVertical: 14, paddingHorizontal: 24 },
  fabTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '92%' },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 14 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
  chipTxt: { fontSize: 13, color: '#64748B' },
});
