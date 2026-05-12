import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Image, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../utils/logger';

// Necessário para fechar o browser após o redirect OAuth no mobile
WebBrowser.maybeCompleteAuthSession();

const LOGO = require('../../../assets/logo_background.png');

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

// Extrai tokens do URL de callback OAuth
function parseOAuthCallback(url) {
  try {
    // Tenta hash fragment (fluxo implícito)
    const hash = url.split('#')[1];
    if (hash) {
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token) return { access_token, refresh_token };
    }
    // Tenta query string (fluxo PKCE)
    const query = url.split('?')[1]?.split('#')[0];
    if (query) {
      const params = new URLSearchParams(query);
      const code = params.get('code');
      if (code) return { code };
    }
  } catch (_) {}
  return null;
}

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const passwordRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [erro, setErro] = useState('');

  // URL de redirect para OAuth nativo — usa o scheme do app
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'petcare',
    path: 'auth/callback',
  });

  // ── Login com email/senha ──────────────────────────────────────────────────
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

  // ── Login com Google ───────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setErro('');
    setLoadingGoogle(true);
    try {
      if (Platform.OS === 'web') {
        // No web o Supabase redireciona direto pelo browser
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
        return; // o browser redireciona, não há mais código aqui
      }

      // Nativo: abre browser embutido, captura o redirect
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (result.type === 'success' && result.url) {
        const parsed = parseOAuthCallback(result.url);
        if (parsed?.access_token) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token ?? '',
          });
          if (sessionErr) throw sessionErr;
        } else if (parsed?.code) {
          const { error: codeErr } = await supabase.auth.exchangeCodeForSession(parsed.code);
          if (codeErr) throw codeErr;
        } else {
          throw new Error('Resposta do Google inválida. Tente novamente.');
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // usuário cancelou — não é erro
      }
    } catch (e) {
      logger.error('[Google OAuth]', e);
      setErro(e?.message || 'Erro ao entrar com Google.');
    } finally {
      setLoadingGoogle(false);
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
        {/* ── Hero com gradiente e logo ── */}
        <LinearGradient
          colors={['#0284C7', '#0EA5E9', '#38BDF8']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={[styles.bubble, { width: 220, height: 220, top: -70, right: -60 }]} />
          <View style={[styles.bubble, { width: 110, height: 110, bottom: -30, left: 20 }]} />
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.heroTitle}>PetCare+</Text>

          {/* Frase emocional principal */}
          <Text style={styles.heroEmotion}>
            Tudo que seu pet precisa,{'\n'}organizado para você.
          </Text>
          <Text style={styles.heroTagline}>
            Porque cuidar bem é um ato de amor.
          </Text>

          {/* Feature chips */}
          <View style={styles.featureGrid}>
            <View style={styles.featureChip}>
              <Image source={require('../../../assets/icon_medical.png')} style={styles.chipIcon} resizeMode="contain" />
              <Text style={styles.chipText}>Vacinas em dia</Text>
            </View>
            <View style={styles.featureChip}>
              <Image source={require('../../../assets/icon_map.png')} style={styles.chipIcon} resizeMode="contain" />
              <Text style={styles.chipText}>Mapa Pet</Text>
            </View>
            <View style={styles.featureChip}>
              <Image source={require('../../../assets/icon_fred.png')} style={styles.chipIcon} resizeMode="contain" />
              <Text style={styles.chipText}>IA para dúvidas</Text>
            </View>
            <View style={styles.featureChip}>
              <Image source={require('../../../assets/icon_expenses.png')} style={styles.chipIcon} resizeMode="contain" />
              <Text style={styles.chipText}>Controle de gastos</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Formulário ── */}
        <View style={styles.form}>
          <Text style={styles.welcomeTitle}>Bem-vindo de volta!</Text>
          <Text style={styles.welcomeSub}>Tudo sobre seus pets, num só lugar</Text>

          {/* Botão Google */}
          <TouchableOpacity
            style={styles.socialBtn}
            onPress={handleGoogleLogin}
            disabled={loadingGoogle}
            activeOpacity={0.8}
          >
            {loadingGoogle
              ? <ActivityIndicator size="small" color="#4285F4" />
              : <GoogleLogo size={22} />}
            <Text style={styles.socialText}>Continuar com o Google</Text>
          </TouchableOpacity>

          {/* Divisor */}
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
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Senha */}
          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              ref={passwordRef}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          {/* Erro */}
          {erro ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{erro}</Text>
            </View>
          ) : null}

          {/* Botão entrar */}
          <TouchableOpacity onPress={handleLogin} disabled={loading} style={styles.loginBtnWrap}>
            <LinearGradient
              colors={['#0EA5E9', '#38BDF8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.loginBtn}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.loginBtnText}>Entrar</Text>}
            </LinearGradient>
          </TouchableOpacity>

          {/* Mini pitch premium */}
          <View style={styles.pitchRow}>
            <View style={styles.pitchDot} />
            <Text style={styles.pitchText}>
              Planos a partir de <Text style={styles.pitchBold}>R$9,90/mês</Text> — sem compromisso
            </Text>
          </View>

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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  inner: { flexGrow: 1 },

  hero: {
    paddingTop: 48, paddingBottom: 28, paddingHorizontal: 24,
    alignItems: 'center', overflow: 'hidden',
  },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' },
  logo: { width: 100, height: 100, marginBottom: 8 },
  heroTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 10 },
  heroEmotion: {
    fontSize: 20, fontWeight: '800', color: '#fff',
    textAlign: 'center', lineHeight: 28, marginBottom: 10,
  },
  heroTagline: {
    fontSize: 13, color: 'rgba(255,255,255,0.82)',
    textAlign: 'center', lineHeight: 20, marginBottom: 20,
  },

  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  featureChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  chipIcon: { width: 14, height: 14 },
  chipText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  form: {
    flex: 1, backgroundColor: '#fff',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -20,
    paddingHorizontal: 24, paddingTop: 30, paddingBottom: 40,
  },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  welcomeSub: { fontSize: 13, color: '#64748B', marginBottom: 22 },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 10, gap: 10,
  },
  socialText: { fontSize: 15, fontWeight: '600', color: '#1E293B' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },

  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: '#E0F2FE',
    paddingHorizontal: 14, marginBottom: 16,
  },
  inputIcon: { fontSize: 16, marginRight: 10, color: '#94A3B8' },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#1E293B' },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 18 },

  errorBox: {
    backgroundColor: '#FFF1F2', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#FECDD3', marginBottom: 14,
  },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center' },

  loginBtnWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  loginBtn: { paddingVertical: 17, alignItems: 'center' },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  pitchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0F9FF', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16, borderWidth: 1, borderColor: '#BAE6FD',
  },
  pitchDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0EA5E9', flexShrink: 0 },
  pitchText: { fontSize: 12, color: '#475569', flex: 1 },
  pitchBold: { color: '#0284C7', fontWeight: '800' },

  footerRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  footerLink: { fontSize: 13, color: '#64748B' },
  footerLinkBold: { color: '#0EA5E9', fontWeight: '700' },
});
