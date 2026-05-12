import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Image, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

const LOGO = require('../../../assets/logo_background.png');

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export default function RegisterScreen({ navigation }) {
  const [role, setRole] = useState('tutor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [crm, setCrm] = useState('');
  const [estado, setEstado] = useState('SP');
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [showEstados, setShowEstados] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const handleRegister = async () => {
    setErro('');
    setSucesso('');

    if (!email || !password) { setErro('Preencha todos os campos.'); return; }
    if (password.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (role === 'vet' && !crm) { setErro('O CRM é obrigatório para veterinários.'); return; }
    if (role === 'vet' && !fullName.trim()) { setErro('Informe seu nome completo.'); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) { setErro(error.message); setLoading(false); return; }

      const userId = data?.user?.id;
      if (!userId) {
        setErro('Erro ao criar conta. Tente novamente.');
        setLoading(false);
        return;
      }

      // Cria perfil base
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({ id: userId, role, full_name: fullName.trim() || null });
      if (profileErr) logger.error('[profiles upsert]', profileErr);

      if (role === 'vet') {
        const crmNum = crm.replace(/\D/g, '');

        // Cria perfil vet com status pending
        const { error: vetErr } = await supabase.from('vet_profiles').upsert({
          id:          userId,
          crm:         crmNum,
          estado:      estado,
          full_name:   fullName.trim(),
          specialty:   specialty.trim()   || null,
          clinic_name:    clinicName.trim()    || null,
          clinic_address: clinicAddress.trim() || null,
          status:      'pending',
        }, { onConflict: 'id' });

        if (vetErr) {
          logger.error('[vet_profiles upsert]', vetErr);
          setErro('Erro ao criar perfil veterinário: ' + vetErr.message);
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // Valida CRM via Edge Function (CFMV)
        try {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('validate-crm', {
            body: { crm: crmNum, estado, userId },
          });

          if (fnErr) logger.error('[validate-crm fn error]', fnErr);

          if (fnData?.valid === false) {
            setErro(fnData.error || 'CRM inválido. Verifique e tente novamente.');
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }

          const approved = fnData?.status === 'approved';
          setSucesso(approved
            ? '✅ CRM validado! Conta criada. Faça login para acessar.'
            : '⏳ Cadastro enviado! Seu CRM está em análise. Faça login para acompanhar.'
          );
        } catch (fnEx) {
          logger.error('[validate-crm exception]', fnEx);
          // Edge Function falhou mas vet_profiles foi criado com status pending — ok
          setSucesso('⏳ Conta criada! CRM será validado em breve. Faça login.');
        }
      } else {
        setSucesso('Conta criada com sucesso! Faça login para acessar.');
      }

      // Faz logout para forçar login limpo — garante que o perfil seja carregado corretamente
      await supabase.auth.signOut();
      setTimeout(() => navigation.navigate('Login'), 2200);
    } catch (e) {
      setErro('Erro de conexão: ' + (e?.message || 'Verifique sua internet.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={['#0284C7', '#0EA5E9', '#38BDF8']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBubble} />
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.heroTitle}>PetCare+</Text>
          <Text style={styles.heroSub}>Crie sua conta gratuita</Text>
        </LinearGradient>

        <View style={styles.formArea}>

          {/* Seleção de perfil */}
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleBtn, role === 'tutor' && styles.roleBtnActive]}
              onPress={() => setRole('tutor')}
            >
              <Image source={require('../../../assets/icon_home.png')} style={styles.roleEmoji} resizeMode="contain" />
              <Text style={[styles.roleLabel, role === 'tutor' && styles.roleLabelActive]}>Sou tutor</Text>
              <Text style={[styles.roleDesc, role === 'tutor' && styles.roleDescActive]}>Cuido de pets</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, role === 'vet' && styles.roleBtnActiveVet]}
              onPress={() => setRole('vet')}
            >
              <Image source={require('../../../assets/icon_medical.png')} style={styles.roleEmoji} resizeMode="contain" />
              <Text style={[styles.roleLabel, role === 'vet' && styles.roleLabelActiveVet]}>Sou veterinário</Text>
              <Text style={[styles.roleDesc, role === 'vet' && styles.roleDescActiveVet]}>Médico veterinário</Text>
            </TouchableOpacity>
          </View>

          {/* Nome completo */}
          <TextInput
            style={styles.input}
            placeholder="Nome completo"
            placeholderTextColor="#9CA3AF"
            value={fullName}
            onChangeText={setFullName}
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha (mínimo 6 caracteres)"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Campos exclusivos veterinário */}
          {role === 'vet' && (
            <View style={styles.vetFields}>
              <View style={styles.vetBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Image source={require('../../../assets/icon_medical.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />
                  <Text style={styles.vetBannerText}>Informações profissionais</Text>
                </View>
                <Text style={styles.vetBannerSub}>Seu CRM será validado automaticamente pelo CFMV</Text>
              </View>

              {/* CRM + Estado lado a lado */}
              <View style={styles.crmRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="CRM (apenas números)"
                  placeholderTextColor="#9CA3AF"
                  value={crm}
                  onChangeText={v => setCrm(v.replace(/\D/g, ''))}
                  keyboardType="numeric"
                  maxLength={8}
                />
                <TouchableOpacity
                  style={styles.estadoBtn}
                  onPress={() => setShowEstados(v => !v)}
                >
                  <Text style={styles.estadoBtnText}>{estado}</Text>
                  <Text style={styles.estadoArrow}>▾</Text>
                </TouchableOpacity>
              </View>

              {/* Dropdown estados */}
              {showEstados && (
                <View style={styles.estadoDropdown}>
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                    {ESTADOS.map(uf => (
                      <TouchableOpacity
                        key={uf}
                        style={[styles.estadoOption, estado === uf && styles.estadoOptionActive]}
                        onPress={() => { setEstado(uf); setShowEstados(false); }}
                      >
                        <Text style={[styles.estadoOptionText, estado === uf && styles.estadoOptionTextActive]}>
                          {uf}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <TextInput
                style={[styles.input, { marginTop: 12 }]}
                placeholder="Especialidade (ex: Clínico geral, Ortopedia)"
                placeholderTextColor="#9CA3AF"
                value={specialty}
                onChangeText={setSpecialty}
              />
              <TextInput
                style={styles.input}
                placeholder="Nome da clínica (opcional)"
                placeholderTextColor="#9CA3AF"
                value={clinicName}
                onChangeText={setClinicName}
              />
              <TextInput
                style={styles.input}
                placeholder="Endereço da clínica (opcional)"
                placeholderTextColor="#9CA3AF"
                value={clinicAddress}
                onChangeText={setClinicAddress}
              />
            </View>
          )}

          {erro   ? <View style={styles.errorBox}><Text style={styles.errorText}>{erro}</Text></View>   : null}
          {sucesso ? <View style={styles.successBox}><Text style={styles.successText}>{sucesso}</Text></View> : null}

          <TouchableOpacity
            style={styles.btnWrap}
            onPress={handleRegister}
            disabled={loading}
          >
            <LinearGradient
              colors={['#0EA5E9', '#38BDF8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.btn}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Criar conta</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>Já tem conta? <Text style={styles.linkBold}>Entrar</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  inner: { flexGrow: 1 },

  hero: { paddingTop: 44, paddingBottom: 30, alignItems: 'center', overflow: 'hidden' },
  heroBubble: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.15)', top: -40, right: -40 },
  logo: { width: 90, height: 90, marginBottom: 10 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 4 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  formArea: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -16, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40, flex: 1,
  },

  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  roleBtn: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0' },
  roleBtnActive:    { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  roleBtnActiveVet: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  roleEmoji: { width: 28, height: 28, marginBottom: 6 },
  roleLabel: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  roleLabelActive:    { color: '#0EA5E9' },
  roleLabelActiveVet: { color: '#0EA5E9' },
  roleDesc: { fontSize: 11, color: '#94A3B8', marginTop: 2, textAlign: 'center' },
  roleDescActive:    { color: '#0EA5E9' },
  roleDescActiveVet: { color: '#0EA5E9' },

  input: {
    backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, marginBottom: 12, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },

  vetFields: { marginBottom: 4 },
  vetBanner: { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: '#BAE6FD' },
  vetBannerText: { color: '#0EA5E9', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  vetBannerSub: { color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 4 },

  crmRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  estadoBtn: {
    backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#E0F2FE', flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  estadoBtnText: { fontSize: 15, fontWeight: '700', color: '#0EA5E9' },
  estadoArrow: { fontSize: 12, color: '#94A3B8' },
  estadoDropdown: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E0F2FE',
    marginTop: 4, overflow: 'hidden',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  estadoOption: { paddingHorizontal: 20, paddingVertical: 12 },
  estadoOptionActive: { backgroundColor: '#EFF6FF' },
  estadoOptionText: { fontSize: 14, color: '#374151' },
  estadoOptionTextActive: { color: '#0EA5E9', fontWeight: '700' },

  errorBox:   { backgroundColor: '#FFF1F2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FECDD3', marginBottom: 12 },
  errorText:  { color: '#EF4444', fontSize: 13, textAlign: 'center' },
  successBox: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 12 },
  successText: { color: '#16A34A', fontSize: 13, textAlign: 'center', fontWeight: '600' },

  btnWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 4, marginBottom: 16 },
  btn: { paddingVertical: 17, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  link: { textAlign: 'center', color: '#64748B', fontSize: 14 },
  linkBold: { color: '#0EA5E9', fontWeight: '700' },
});
