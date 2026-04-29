import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function RegisterScreen({ navigation }) {
  const [role, setRole] = useState('tutor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [crm, setCrm] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const handleRegister = async () => {
    setErro('');
    setSucesso('');

    if (!email || !password) { setErro('Preencha todos os campos.'); return; }
    if (password.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (role === 'vet' && !crm) { setErro('O CRM é obrigatório para veterinários.'); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) { setErro('Erro: ' + error.message); setLoading(false); return; }

      const userId = data?.user?.id;
      if (userId) {
        // Cria perfil com role
        await supabase.from('profiles').upsert({ id: userId, role });

        // Se veterinário, cria perfil vet
        if (role === 'vet') {
          await supabase.from('vet_profiles').upsert({
            id: userId,
            crm: crm.trim(),
            specialty: specialty.trim() || null,
            clinic_name: clinicName.trim() || null,
          });
        }
      }

      setSucesso('Conta criada com sucesso! Fazendo login...');
      setTimeout(() => navigation.navigate('Login'), 1500);
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
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🐾</Text>
        <Text style={styles.title}>PetCare+</Text>
        <Text style={styles.subtitle}>Crie sua conta</Text>

        {/* Seleção de perfil */}
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'tutor' && styles.roleBtnActive]}
            onPress={() => setRole('tutor')}
          >
            <Text style={styles.roleEmoji}>🏠</Text>
            <Text style={[styles.roleLabel, role === 'tutor' && styles.roleLabelActive]}>Sou tutor</Text>
            <Text style={[styles.roleDesc, role === 'tutor' && styles.roleDescActive]}>Cuido de pets</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'vet' && styles.roleBtnActiveVet]}
            onPress={() => setRole('vet')}
          >
            <Text style={styles.roleEmoji}>👨‍⚕️</Text>
            <Text style={[styles.roleLabel, role === 'vet' && styles.roleLabelActiveVet]}>Sou veterinário</Text>
            <Text style={[styles.roleDesc, role === 'vet' && styles.roleDescActiveVet]}>Cuido de pacientes</Text>
          </TouchableOpacity>
        </View>

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

        {/* Campos extras para veterinário */}
        {role === 'vet' && (
          <View style={styles.vetFields}>
            <View style={styles.vetBanner}>
              <Text style={styles.vetBannerText}>👨‍⚕️ Informações profissionais</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="CRM (obrigatório)"
              placeholderTextColor="#9CA3AF"
              value={crm}
              onChangeText={setCrm}
            />
            <TextInput
              style={styles.input}
              placeholder="Especialidade (ex: Clínico geral, Ortopedia)"
              placeholderTextColor="#9CA3AF"
              value={specialty}
              onChangeText={setSpecialty}
            />
            <TextInput
              style={styles.input}
              placeholder="Nome da clínica"
              placeholderTextColor="#9CA3AF"
              value={clinicName}
              onChangeText={setClinicName}
            />
          </View>
        )}

        {erro ? <View style={styles.errorBox}><Text style={styles.errorText}>{erro}</Text></View> : null}
        {sucesso ? <View style={styles.successBox}><Text style={styles.successText}>{sucesso}</Text></View> : null}

        <TouchableOpacity style={[styles.button, role === 'vet' && styles.buttonVet]} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Criar conta</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Já tem conta? <Text style={styles.linkBold}>Entrar</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logo: { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center', color: '#0EA5E9', marginBottom: 4 },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#64748B', marginBottom: 24 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  roleBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center',
    borderWidth: 2, borderColor: '#E2E8F0',
  },
  roleBtnActive: { borderColor: '#0EA5E9', backgroundColor: '#EFF6FF' },
  roleBtnActiveVet: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  roleEmoji: { fontSize: 28, marginBottom: 6 },
  roleLabel: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  roleLabelActive: { color: '#0EA5E9' },
  roleLabelActiveVet: { color: '#10B981' },
  roleDesc: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  roleDescActive: { color: '#0EA5E9' },
  roleDescActiveVet: { color: '#10B981' },
  input: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B',
  },
  vetFields: { marginBottom: 4 },
  vetBanner: {
    backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  vetBannerText: { color: '#10B981', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  errorBox: { backgroundColor: '#FFF1F2', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FECDD3', marginBottom: 12 },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center' },
  successBox: { backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 12 },
  successText: { color: '#16A34A', fontSize: 14, textAlign: 'center' },
  button: { backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  buttonVet: { backgroundColor: '#10B981' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#64748B', fontSize: 14 },
  linkBold: { color: '#0EA5E9', fontWeight: '600' },
});
