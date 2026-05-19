import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const TYPES = [
  { key: 'consulta', label: 'Consulta' },
  { key: 'retorno',  label: 'Retorno'  },
  { key: 'exame',    label: 'Exame'    },
  { key: 'outro',    label: 'Outro'    },
];

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function TutorBookVetScreen({ route, navigation }) {
  const { petId, petName, vetId, vetName } = route.params || {};
  const { user } = useAuth();

  // slots = [{ date, time, reserved }]
  const [slots,         setSlots]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedSlot,  setSelectedSlot]  = useState(null);
  const [apptType,      setApptType]      = useState('consulta');
  const [message,       setMessage]       = useState('');
  const [saving,        setSaving]        = useState(false);
  const [success,       setSuccess]       = useState(false);
  const [noAvailability,setNoAvailability]= useState(false);

  // Group slots by date
  const slotsByDate = slots.reduce((acc, s) => {
    const key = s.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  useEffect(() => { fetchSlots(); }, []);

  const addMinutes = (timeStr, mins) => {
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
  };

  const fetchSlots = async () => {
    setLoading(true);
    // 1. Busca template de disponibilidade do vet
    const { data: avail } = await supabase
      .from('vet_availability')
      .select('day_of_week, start_time, end_time, slot_minutes')
      .eq('vet_id', vetId).eq('active', true);

    if (!avail || avail.length === 0) { setNoAvailability(true); setLoading(false); return; }

    // 2. Busca agendamentos existentes (próximos 21 dias)
    const today = new Date();
    const startISO = today.toISOString().slice(0, 10);
    const end = new Date(today); end.setDate(today.getDate() + 21);
    const endISO = end.toISOString().slice(0, 10);

    const { data: existing } = await supabase
      .from('vet_schedule')
      .select('scheduled_date, scheduled_time, status')
      .eq('vet_id', vetId)
      .gte('scheduled_date', startISO)
      .lte('scheduled_date', endISO)
      .not('status', 'in', '("cancelled","no_show")');

    // Monta set de slots ocupados: "YYYY-MM-DD HH:MM"
    const takenSet = new Set(
      (existing || []).map(e => `${e.scheduled_date} ${String(e.scheduled_time).slice(0,5)}`)
    );

    // 3. Gera todos os slots para os próximos 21 dias
    const allSlots = [];
    for (let i = 0; i <= 21; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const dow = d.getDay();
      const dateISO = d.toISOString().slice(0, 10);
      const dayAvails = avail.filter(a => a.day_of_week === dow);
      dayAvails.forEach(a => {
        const slotMins = a.slot_minutes || 30;
        let cur = String(a.start_time).slice(0, 5);
        const endT = String(a.end_time).slice(0, 5);
        while (cur < endT) {
          const key = `${dateISO} ${cur}`;
          allSlots.push({ date: dateISO, time: cur, reserved: takenSet.has(key) });
          cur = addMinutes(cur, slotMins);
        }
      });
    }

    setSlots(allSlots);
    setLoading(false);
    if (allSlots.length === 0) setNoAvailability(true);
  };

  const handleConfirm = async () => {
    if (!selectedSlot || saving) return;
    setSaving(true);
    const { error } = await supabase.from('vet_schedule').insert({
      vet_id:               vetId,
      pet_id:               petId,
      patient_name:         petName,
      scheduled_date:       selectedSlot.date,
      scheduled_time:       selectedSlot.time,
      type:                 apptType,
      status:               'pending_approval',
      requested_by_user_id: user.id,
      request_message:      message.trim() || null,
    });
    setSaving(false);
    if (!error) setSuccess(true);
  };

  if (success) {
    return (
      <View style={styles.successWrap}>
        <View style={styles.successCard}>
          <Text style={{ fontSize: 52, marginBottom: 14 }}>📅</Text>
          <Text style={styles.successTitle}>Solicitação enviada!</Text>
          <Text style={styles.successSub}>
            Dr(a). <Text style={{ fontWeight: '900', color: '#0EA5E9' }}>{vetName}</Text> receberá sua solicitação
            e confirmará em breve. O horário fica reservado até a resposta.
          </Text>
          <TouchableOpacity style={{ marginTop: 24, borderRadius: 14, overflow: 'hidden', width: '100%' }} onPress={() => navigation.goBack()}>
            <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 15, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Voltar ao perfil do pet</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;

  if (noAvailability) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>📭</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 8, textAlign: 'center' }}>
          Sem horários disponíveis
        </Text>
        <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 }}>
          Dr(a). {vetName} ainda não configurou sua disponibilidade no app.
          {'\n'}Entre em contato via chat para agendar manualmente.
        </Text>
        <TouchableOpacity style={{ marginTop: 24 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: '#0EA5E9', fontWeight: '700', fontSize: 14 }}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Cabeçalho */}
      <View style={styles.vetHeader}>
        <Text style={styles.vetHeaderName}>Dr(a). {vetName}</Text>
        <Text style={styles.vetHeaderSub}>Selecione um horário disponível para {petName}</Text>
      </View>

      {/* Tipo de consulta */}
      <Text style={styles.label}>Tipo</Text>
      <View style={styles.typeRow}>
        {TYPES.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typeChip, apptType === t.key && styles.typeChipActive]}
            onPress={() => setApptType(t.key)}
          >
            <Text style={[styles.typeChipTxt, apptType === t.key && styles.typeChipTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Slots por dia */}
      <Text style={styles.label}>Horários disponíveis</Text>
      {Object.entries(slotsByDate).map(([date, daySlots]) => {
        const [y, m, d] = date.split('-');
        const dow = new Date(`${date}T12:00:00`).getDay();
        return (
          <View key={date} style={styles.dayBlock}>
            <Text style={styles.dayLabel}>{d}/{m} · {DAY_NAMES[dow]}</Text>
            <View style={styles.slotsRow}>
              {daySlots.map((s) => {
                const key = `${s.date}-${s.time}`;
                const isSelected = selectedSlot && `${selectedSlot.date}-${selectedSlot.time}` === key;
                if (s.reserved) {
                  return (
                    <View key={key} style={styles.slotChipReserved}>
                      <Text style={styles.slotTxtReserved}>{s.time}</Text>
                      <Text style={styles.slotTxtReservedLabel}>Reservado</Text>
                    </View>
                  );
                }
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.slotChip, isSelected && styles.slotChipActive]}
                    onPress={() => setSelectedSlot(s)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.slotTxt, isSelected && styles.slotTxtActive]}>{s.time}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* Mensagem */}
      <Text style={styles.label}>Mensagem para o veterinário (opcional)</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
        value={message}
        onChangeText={setMessage}
        placeholder="Ex: Meu pet está com falta de apetite há 3 dias..."
        placeholderTextColor="#9CA3AF"
        multiline
      />

      {/* Slot selecionado */}
      {selectedSlot && (
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedInfoTxt}>
            ✓ Selecionado: {selectedSlot.date.split('-').reverse().join('/')} às {selectedSlot.time}
          </Text>
        </View>
      )}

      {/* Aviso */}
      <View style={styles.warningBox}>
        <Text style={styles.warningTxt}>
          ⏳ O horário será reservado imediatamente e ficará pendente até Dr(a). {vetName} confirmar ou recusar.
        </Text>
      </View>

      {/* Botão */}
      <TouchableOpacity
        style={[styles.confirmBtn, (!selectedSlot || saving) && { opacity: 0.5 }]}
        onPress={handleConfirm}
        disabled={!selectedSlot || saving}
        activeOpacity={0.85}
      >
        <LinearGradient colors={['#0284C7', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmBtnGrad}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnTxt}>Enviar solicitação</Text>}
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#F0F9FF' },

  vetHeader: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#BAE6FD' },
  vetHeaderName: { fontSize: 17, fontWeight: '900', color: '#0284C7', marginBottom: 3 },
  vetHeaderSub: { fontSize: 13, color: '#64748B' },

  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10, marginTop: 4 },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  typeChip: { backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: '#E2E8F0' },
  typeChipActive: { backgroundColor: '#EFF6FF', borderColor: '#0EA5E9' },
  typeChipTxt: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  typeChipTxtActive: { color: '#0EA5E9', fontWeight: '800' },

  dayBlock: { marginBottom: 16 },
  dayLabel: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  slotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: '#E0F2FE' },
  slotChipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  slotTxt: { fontSize: 13, fontWeight: '700', color: '#0EA5E9' },
  slotTxtActive: { color: '#fff' },
  slotChipReserved: { backgroundColor: 'rgba(248,250,252,0.6)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center' },
  slotTxtReserved: { fontSize: 12, fontWeight: '600', color: '#CBD5E1' },
  slotTxtReservedLabel: { fontSize: 9, color: '#CBD5E1', fontWeight: '500' },

  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B', marginBottom: 12 },

  selectedInfo: { backgroundColor: '#DCFCE7', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#86EFAC' },
  selectedInfoTxt: { fontSize: 13, fontWeight: '700', color: '#16A34A' },

  warningBox: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' },
  warningTxt: { fontSize: 12, color: '#B45309', lineHeight: 18 },

  confirmBtn: { borderRadius: 16, overflow: 'hidden' },
  confirmBtnGrad: { paddingVertical: 17, alignItems: 'center' },
  confirmBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  successWrap: { flex: 1, backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center', padding: 32 },
  successCard: { backgroundColor: '#fff', borderRadius: 28, padding: 32, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: '#BAE6FD' },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B', marginBottom: 10 },
  successSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
});
