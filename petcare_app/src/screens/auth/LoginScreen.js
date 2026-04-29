import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Image, Alert,
} from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';

function GoogleLogo({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

function AppleLogo({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 814 1000">
      <Path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 411.5 0 261.3 0 116.7c0-95.8 33.4-146.3 96.2-196.5C148.1-25 222.2-41.3 291.4-41.3c93.5 0 168.5 61.3 225.6 61.3 55.1 0 142.2-65.7 249.6-65.7 40.1 0 108.2 4 162.3 59.9zm-181.6-203.5c22.2-27.3 39.1-65.7 39.1-104.1 0-5.2-.6-10.4-1.3-15.6-36.5 1.3-80 24.5-106.5 53.8-21.6 24.5-41.6 62.9-41.6 101.9 0 5.8.6 11.7 1.3 14.3 2.6.6 6.5 1.3 10.4 1.3 32.8 0 74.2-22.1 98.6-51.6z" fill="#000" />
    </Svg>
  );
}

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [erro, setErro] = useState('');

  const handleLogin = async () => {
    setErro('');
    if (!email || !password) { setErro('Preencha email e senha.'); return; }
    setLoading(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) setErro(error.message);
    } catch (e) {
      setErro('Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    Alert.alert(`${provider}`, 'Login social disponível em breve! Use email e senha por enquanto.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoWrapper}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Título */}
        <Text style={styles.title}>Bem-vindo de volta!</Text>
        <Text style={styles.subtitle}>Entre para gerenciar os cuidados do seu pet</Text>

        {/* Botão Google */}
        <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocialLogin('Google')}>
          <GoogleLogo size={22} />
          <Text style={styles.socialText}>Continuar com o Google</Text>
        </TouchableOpacity>

        {/* Botão Apple */}
        <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocialLogin('Apple')}>
          <AppleLogo size={22} />
          <Text style={styles.socialText}>Continuar com a Apple</Text>
        </TouchableOpacity>

        {/* Divisor OU */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OU</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email */}
        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>✉</Text>
          <TextInput
            style={styles.input}
            placeholder="voce@exemplo.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Senha */}
        <Text style={styles.label}>Senha</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>🔒</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>

        {/* Erro */}
        {erro ? <Text style={styles.errorText}>{erro}</Text> : null}

        {/* Botão entrar */}
        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.loginBtnText}>Entrar</Text>}
        </TouchableOpacity>

        {/* Footer links */}
        <View style={styles.footerRow}>
          <TouchableOpacity>
            <Text style={styles.footerLink}>Esqueceu a senha?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>
              Não tem conta? <Text style={styles.footerLinkBold}>Cadastre-se</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBF8FF' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  logoWrapper: { alignItems: 'center', marginBottom: 24 },
  logoImage: { width: 110, height: 110, borderRadius: 55 },

  title: { fontSize: 28, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 28 },

  // Social buttons
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  socialText: { fontSize: 15, fontWeight: '600', color: '#1E293B' },

  // Divisor
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },

  // Campos
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 14, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  inputIcon: { fontSize: 16, marginRight: 10, color: '#94A3B8' },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#1E293B' },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 18 },

  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 12, marginTop: -8 },

  // Botão login
  loginBtn: {
    backgroundColor: '#0D9488', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#0D9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Footer
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  footerLink: { fontSize: 13, color: '#64748B' },
  footerLinkBold: { color: '#0D9488', fontWeight: '700' },
});
