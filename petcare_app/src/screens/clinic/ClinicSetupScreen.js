import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
                'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const REGIMES = [
  { value: 1, label: 'Simples Nacional' },
  { value: 2, label: 'SN – Excesso sublimite' },
  { value: 3, label: 'Lucro Presumido / Real' },
];

export default function ClinicSetupScreen({ navigation, route }) {
  const isEdit   = route?.params?.isEdit  || false;
  const existing = route?.params?.clinic  || null;

  // Dados gerais
  const [name,    setName]    = useState(existing?.name    || '');
  const [cnpj,    setCnpj]    = useState(existing?.cnpj ? formatCnpjInit(existing.cnpj) : '');
  const [phone,   setPhone]   = useState(existing?.phone   || '');
  const [address, setAddress] = useState(existing?.address || '');
  const [city,    setCity]    = useState(existing?.city    || '');
  const [state,   setState]   = useState(existing?.state   || 'SP');

  // Dados fiscais / NF-e
  const [razaoSocial, setRazaoSocial] = useState(existing?.razao_social        || '');
  const [ie,          setIe]          = useState(existing?.inscricao_estadual  || '');
  const [im,          setIm]          = useState(existing?.inscricao_municipal || '');
  const [regime,      setRegime]      = useState(existing?.regime_tributario   ?? 1);
  const [emailNfe,    setEmailNfe]    = useState(existing?.email_nfe           || '');

  const [saving, setSaving] = useState(false);

  function formatCnpjInit(v) {
    const n = String(v).replace(/\D/g, '').slice(0, 14).padStart(0, '');
    return n
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  const formatCnpj = (v) => {
    const n = v.replace(/\D/g, '').slice(0, 14);
    return n
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const formatPhone = (v) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    if (n.length <= 10) return n.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    return n.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  };

  const nfePayload = () => ({
    razao_social:        razaoSocial.trim() || null,
    inscricao_estadual:  ie.trim()          || null,
    inscricao_municipal: im.trim()          || null,
    regime_tributario:   regime,
    email_nfe:           emailNfe.trim()    || null,
  });

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Campo obrigatório', 'Informe o nome da clínica.'); return; }
    setSaving(true);
    try {
      if (isEdit && existing?.id) {
        const { error } = await supabase
          .from('clinics')
          .update({
            name:    name.trim(),
            cnpj:    cnpj.replace(/\D/g, '') || null,
            phone:   phone    || null,
            address: address  || null,
            city:    city     || null,
            state:   state    || null,
            ...nfePayload(),
          })
          .eq('id', existing.id);
        if (error) throw error;
        Alert.alert('Salvo!', 'Dados da clínica atualizados.');
        navigation.goBack();
      } else {
        // Cria clínica (owner + clinic_members via RPC)
        const { data: clinicId, error } = await supabase.rpc('create_clinic', {
          p_name:    name.trim(),
          p_cnpj:    cnpj.replace(/\D/g, '') || null,
          p_phone:   phone    || null,
          p_address: address  || null,
          p_city:    city     || null,
          p_state:   state    || null,
        });
        if (error) throw error;

        // Salva dados fiscais separadamente (não estão no RPC)
        const nfe = nfePayload();
        if (Object.values(nfe).some(v => v !== null)) {
          await supabase.from('clinics').update(nfe).eq('id', clinicId);
        }

        Alert.alert('Clínica criada!', `${name} está pronta. Agora você pode convidar sua equipe.`, [
          { text: 'OK', onPress: () => navigation.replace('ClinicDashboard', { clinicId }) },
        ]);
      }
    } catch (err) {
      Alert.alert('Erro', err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{isEdit ? 'Editar Clínica' : 'Criar Clínica'}</Text>
            <Text style={styles.headerSub}>PetCare+ Clínica</Text>
          </View>
        </LinearGradient>

        <View style={styles.form}>

          {/* ── Dados gerais ── */}
          <Text style={styles.sectionTitle}>Dados da Clínica</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Nome fantasia *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Clínica VetPet"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>CNPJ</Text>
            <TextInput
              style={styles.input}
              value={cnpj}
              onChangeText={v => setCnpj(formatCnpj(v))}
              placeholder="00.000.000/0001-00"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={v => setPhone(formatPhone(v))}
              placeholder="(11) 99999-9999"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />
          </View>

          {/* ── Endereço ── */}
          <Text style={styles.sectionTitle}>Endereço</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Endereço</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Rua, número, complemento"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>Cidade</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="São Paulo"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Estado</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.stateScroll}
                contentContainerStyle={styles.stateScrollContent}
              >
                {STATES.map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setState(s)}
                    style={[styles.stateChip, state === s && styles.stateChipActive]}
                  >
                    <Text style={[styles.stateChipText, state === s && styles.stateChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* ── Dados Fiscais / NF-e ── */}
          <Text style={styles.sectionTitle}>Dados Fiscais / NF-e</Text>
          <Text style={styles.sectionDesc}>
            Preenchidos para emissão futura de Nota Fiscal Eletrônica. Não obrigatórios.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Razão Social</Text>
            <TextInput
              style={styles.input}
              value={razaoSocial}
              onChangeText={setRazaoSocial}
              placeholder="Nome jurídico da empresa"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Inscrição Estadual</Text>
              <TextInput
                style={styles.input}
                value={ie}
                onChangeText={setIe}
                placeholder="IE ou ISENTO"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Inscrição Municipal</Text>
              <TextInput
                style={styles.input}
                value={im}
                onChangeText={setIm}
                placeholder="IM (se houver)"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Regime Tributário</Text>
            <View style={styles.regimeRow}>
              {REGIMES.map(r => (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => setRegime(r.value)}
                  style={[styles.regimeChip, regime === r.value && styles.regimeChipActive]}
                >
                  <Text style={[styles.regimeChipText, regime === r.value && styles.regimeChipTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>E-mail para NF-e</Text>
            <TextInput
              style={styles.input}
              value={emailNfe}
              onChangeText={setEmailNfe}
              placeholder="nfe@clinica.com.br"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.saveBtn}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>{isEdit ? 'Salvar alterações' : 'Criar clínica'}</Text>}
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  content:   { paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, paddingTop: 52,
  },
  backBtn:    { padding: 4, marginRight: 12 },
  backArrow:  { color: '#fff', fontSize: 22 },
  headerTitle:{ fontSize: 18, fontWeight: '900', color: '#fff' },
  headerSub:  { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  form: { padding: 20, gap: 4 },

  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: '#7C3AED',
    letterSpacing: 0.8, marginTop: 16, marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 11, color: '#94A3B8', marginBottom: 10,
  },

  field:  { marginBottom: 14 },
  label:  { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input:  {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#DDD6FE',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1E293B',
  },

  row: { flexDirection: 'row', gap: 12 },

  stateScroll:        { marginTop: 4 },
  stateScrollContent: { gap: 6 },
  stateChip: {
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: '#DDD6FE',
  },
  stateChipActive:     { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  stateChipText:       { fontSize: 11, fontWeight: '700', color: '#7C3AED' },
  stateChipTextActive: { color: '#fff' },

  regimeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  regimeChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, backgroundColor: '#EDE9FE', borderWidth: 1.5, borderColor: '#DDD6FE',
  },
  regimeChipActive:     { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  regimeChipText:       { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  regimeChipTextActive: { color: '#fff' },

  saveBtn:     { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 15, fontWeight: '900', color: '#fff' },
});
