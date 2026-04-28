import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const handleRegister = async () => {
    setErro('');
    setSucesso('');

    if (!email || !password) {
      setErro('Preencha todos os campos.');
      return;
    }
    if (password.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setErro('Erro: ' + error.message);
      } else if (data?.user) {
        setSucesso('Conta criada com sucesso! Fazendo login...');
        setTimeout(() => navigation.navigate('Login'), 1500);
      } else {
        setErro('Resposta inesperada do servidor. Tente novamente.');
      }
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

        {erro ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{erro}</Text>
          </View>
        ) : null}

        {sucesso ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{sucesso}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Criar conta</Text>
          )}
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
  subtitle: { fontSize: 16, textAlign: 'center', color: '#64748B', marginBottom: 32 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B',
  },
  errorBox: {
    backgroundColor: '#FFF1F2', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FECDD3', marginBottom: 12,
  },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center' },
  successBox: {
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 12,
  },
  successText: { color: '#16A34A', fontSize: 14, textAlign: 'center' },
  button: {
    backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#64748B', fontSize: 14 },
  linkBold: { color: '#0EA5E9', fontWeight: '600' },
});
