import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { generateQuickDocHTML, exportReport } from '../../utils/generateReport';

const DOC_TYPES = [
  { key: 'receita',    label: 'Receita Médica',    emoji: '💊', color: '#7C3AED', bg: '#EDE9FE' },
  { key: 'atestado',  label: 'Atestado de Saúde', emoji: '🩺', color: '#0284C7', bg: '#EFF6FF' },
  { key: 'declaracao',label: 'Declaração',         emoji: '📄', color: '#10B981', bg: '#DCFCE7' },
];

export default function VetQuickDocScreen({ route, navigation }) {
  const { petId, petName, petSpecies } = route.params || {};
  const { user, vetProfile } = useAuth();

  const [docType, setDocType] = useState('receita');
  const [pet,     setPet]     = useState({ name: petName, species: petSpecies });
  const [loading, setLoading] = useState(false);

  // Receita — lista de medicamentos
  const [medications, setMedications] = useState([{ name: '', dose: '', frequency: '', duration: '', instructions: '' }]);
  const [rxNotes, setRxNotes] = useState('');

  // Atestado
  const [statement,   setStatement]   = useState('');
  const [restrictions,setRestrictions]= useState('');
  const [validity,    setValidity]    = useState('');

  // Declaração
  const [declText, setDeclText] = useState('');

  useEffect(() => {
    if (petId) {
      supabase.from('pets').select('name, species, breed').eq('id', petId).single()
        .then(({ data }) => { if (data) setPet(data); });
    }
  }, [petId]);

  const addMed = () => setMedications(p => [...p, { name: '', dose: '', frequency: '', duration: '', instructions: '' }]);
  const removeMed = (i) => setMedications(p => p.filter((_, idx) => idx !== i));
  const setMed = (i, field, val) => setMedications(p => p.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  const handlePrint = async () => {
    setLoading(true);
    try {
      const vetData = {
        full_name:       vetProfile?.full_name,
        crm:             vetProfile?.crm,
        estado:          vetProfile?.estado,
        specialty:       vetProfile?.specialty,
        clinic_name:     vetProfile?.clinic_name,
        clinic_address:  vetProfile?.clinic_address,
        clinic_logo_url: vetProfile?.clinic_logo_url,
        signature_url:   vetProfile?.signature_url,
      };

      let content = {};
      if (docType === 'receita') {
        content = { medications: medications.filter(m => m.name.trim()), notes: rxNotes };
      } else if (docType === 'atestado') {
        content = { statement, restrictions, validity };
      } else {
        content = { text: declText };
      }

      const html = generateQuickDocHTML({ type: docType, pet, vet: vetData, content });
      const label = DOC_TYPES.find(d => d.key === docType)?.label || 'documento';
      await exportReport(html, `${label}_${pet?.name || 'paciente'}.pdf`);
    } catch (e) {
      console.warn('Erro ao gerar documento:', e);
    } finally {
      setLoading(false);
    }
  };

  const canPrint = docType === 'receita'
    ? medications.some(m => m.name.trim())
    : docType === 'atestado'
    ? true
    : declText.trim().length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Seletor de tipo */}
      <Text style={styles.sectionLabel}>Tipo de documento</Text>
      <View style={styles.typeRow}>
        {DOC_TYPES.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typeCard, docType === t.key && { borderColor: t.color, backgroundColor: t.bg }]}
            onPress={() => setDocType(t.key)}
            activeOpacity={0.8}
          >
            <Text style={styles.typeEmoji}>{t.emoji}</Text>
            <Text style={[styles.typeLabel, docType === t.key && { color: t.color, fontWeight: '800' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Info do paciente */}
      <View style={styles.patientCard}>
        <Text style={styles.patientTitle}>🐾 {pet?.name || petName}</Text>
        <Text style={styles.patientSub}>{pet?.species || petSpecies}{pet?.breed ? ` · ${pet.breed}` : ''}</Text>
      </View>

      {/* ── Receita ── */}
      {docType === 'receita' && (
        <>
          <Text style={styles.sectionLabel}>Medicamentos</Text>
          {medications.map((m, i) => (
            <View key={i} style={styles.medCard}>
              <View style={styles.medCardHeader}>
                <Text style={styles.medNum}>{i + 1}.</Text>
                {medications.length > 1 && (
                  <TouchableOpacity onPress={() => removeMed(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Remover</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput style={styles.input} value={m.name} onChangeText={v => setMed(i, 'name', v)} placeholder="Nome do medicamento *" placeholderTextColor="#9CA3AF" />
              <View style={styles.row2}>
                <TextInput style={[styles.input, { flex: 1 }]} value={m.dose} onChangeText={v => setMed(i, 'dose', v)} placeholder="Dose (ex: 10mg)" placeholderTextColor="#9CA3AF" />
                <TextInput style={[styles.input, { flex: 1 }]} value={m.frequency} onChangeText={v => setMed(i, 'frequency', v)} placeholder="Frequência (ex: 2x/dia)" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={styles.row2}>
                <TextInput style={[styles.input, { flex: 1 }]} value={m.duration} onChangeText={v => setMed(i, 'duration', v)} placeholder="Duração (ex: 7 dias)" placeholderTextColor="#9CA3AF" />
                <TextInput style={[styles.input, { flex: 1 }]} value={m.instructions} onChangeText={v => setMed(i, 'instructions', v)} placeholder="Instruções especiais" placeholderTextColor="#9CA3AF" />
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.addMedBtn} onPress={addMed}>
            <Text style={styles.addMedBtnTxt}>+ Adicionar medicamento</Text>
          </TouchableOpacity>
          <Text style={[styles.sectionLabel, { marginTop: 18 }]}>Observações gerais</Text>
          <TextInput style={[styles.input, styles.textarea]} value={rxNotes} onChangeText={setRxNotes} placeholder="Orientações adicionais para o tutor..." placeholderTextColor="#9CA3AF" multiline />
        </>
      )}

      {/* ── Atestado ── */}
      {docType === 'atestado' && (
        <>
          <Text style={styles.sectionLabel}>Declaração de saúde</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={statement}
            onChangeText={setStatement}
            placeholder={`Atesto que o(a) animal ${pet?.name || petName} encontra-se em bom estado de saúde geral, apto(a) para as atividades descritas.`}
            placeholderTextColor="#9CA3AF"
            multiline
          />
          <Text style={styles.sectionLabel}>Restrições / Recomendações</Text>
          <TextInput style={[styles.input, styles.textarea]} value={restrictions} onChangeText={setRestrictions} placeholder="Ex: Repouso por 7 dias, evitar banho..." placeholderTextColor="#9CA3AF" multiline />
          <Text style={styles.sectionLabel}>Validade do atestado</Text>
          <TextInput style={styles.input} value={validity} onChangeText={setValidity} placeholder="Ex: 30 dias, indeterminado..." placeholderTextColor="#9CA3AF" />
        </>
      )}

      {/* ── Declaração ── */}
      {docType === 'declaracao' && (
        <>
          <Text style={styles.sectionLabel}>Texto da declaração</Text>
          <TextInput
            style={[styles.input, styles.textarea, { height: 180 }]}
            value={declText}
            onChangeText={setDeclText}
            placeholder="Digite o texto completo da declaração..."
            placeholderTextColor="#9CA3AF"
            multiline
          />
        </>
      )}

      {/* Info assinatura */}
      <View style={styles.sigInfo}>
        <Text style={styles.sigInfoTxt}>
          {vetProfile?.signature_url
            ? '✓ Assinatura digital incluída automaticamente'
            : '⚠ Sem assinatura — configure em Perfil → Assinatura digital'}
        </Text>
        {vetProfile?.clinic_logo_url
          ? <Text style={[styles.sigInfoTxt, { color: '#16A34A' }]}>✓ Logo da clínica incluída</Text>
          : <Text style={[styles.sigInfoTxt, { color: '#94A3B8' }]}>• Sem logo — configure em Perfil</Text>}
      </View>

      {/* Botão imprimir */}
      <TouchableOpacity
        style={[styles.printBtn, !canPrint && { opacity: 0.5 }]}
        onPress={handlePrint}
        disabled={!canPrint || loading}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#0284C7', '#0EA5E9']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.printBtnGrad}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.printBtnTxt}>🖨 Gerar e imprimir</Text>}
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 48 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10, marginTop: 4 },

  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  typeCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 6, borderWidth: 2, borderColor: '#E0F2FE' },
  typeEmoji: { fontSize: 22 },
  typeLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', textAlign: 'center' },

  patientCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#BAE6FD', marginBottom: 18 },
  patientTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  patientSub: { fontSize: 12, color: '#64748B', marginTop: 2 },

  medCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E0F2FE', marginBottom: 10, gap: 8 },
  medCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  medNum: { fontSize: 14, fontWeight: '800', color: '#7C3AED' },

  input: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 8 },

  addMedBtn: { backgroundColor: '#EDE9FE', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C4B5FD', marginTop: 4 },
  addMedBtnTxt: { color: '#7C3AED', fontWeight: '800', fontSize: 13 },

  sigInfo: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginTop: 18, gap: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  sigInfoTxt: { fontSize: 12, color: '#64748B' },

  printBtn: { marginTop: 20, borderRadius: 16, overflow: 'hidden' },
  printBtnGrad: { paddingVertical: 17, alignItems: 'center' },
  printBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
