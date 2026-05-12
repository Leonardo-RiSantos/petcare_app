import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ICON_MEDICAL = require('../../../assets/icon_medical.png');
const ICON_CHECK   = require('../../../assets/icon_check.png');
const ICON_EMAIL   = require('../../../assets/icon_email.png');
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';

export default function VetPendingScreen() {
  const { vetProfile, signOut, reloadVetProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState('');

  const handleRecheck = async () => {
    setChecking(true);
    setMsg('');
    try {
      // Tenta validar novamente no CFMV
      const { data } = await supabase.functions.invoke('validate-crm', {
        body: { crm: vetProfile?.crm, estado: vetProfile?.estado, userId: vetProfile?.id },
      });

      if (data?.status === 'approved') {
        // Recarrega perfil no contexto — navigation vai redirecionar automaticamente
        await reloadVetProfile();
      } else {
        setMsg('⏳ CRM ainda em análise. Tente novamente em alguns minutos.');
      }
    } catch {
      setMsg('Erro ao verificar. Verifique sua conexão e tente novamente.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.bubble, { width: 180, height: 180, top: -50, right: -50 }]} />
        <View style={[styles.bubble, { width: 90, height: 90, bottom: -20, left: 30 }]} />
        <Image source={ICON_MEDICAL} style={styles.heroIcon} resizeMode="contain" />
        <Text style={styles.heroTitle}>Conta em Análise</Text>
        <Text style={styles.heroSub}>Validando seu CRM junto ao CFMV</Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusDot}>⏳</Text>
            <Text style={styles.statusText}>Pendente de validação</Text>
          </View>

          <Text style={styles.crmLine}>
            CRM: <Text style={styles.crmValue}>{vetProfile?.crm}/{vetProfile?.estado}</Text>
          </Text>
          {vetProfile?.full_name ? (
            <Text style={styles.nameLine}>{vetProfile.full_name}</Text>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.infoTitle}>O que acontece agora?</Text>

          {[
            { emoji: '🔍',    text: 'Seu CRM está sendo verificado no sistema do CFMV' },
            { emoji: '⚡',    text: 'Normalmente leva menos de 1 minuto' },
            { image: ICON_CHECK, text: 'Após aprovado, acesse normalmente com seu login' },
            { image: ICON_EMAIL, text: 'Em caso de dúvidas, entre em contato pelo suporte' },
          ].map((item, i) => (
            <View key={i} style={styles.infoRow}>
              {item.image
                ? <Image source={item.image} style={styles.infoIcon} resizeMode="contain" />
                : <Text style={styles.infoIconEmoji}>{item.emoji}</Text>}
              <Text style={styles.infoText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {msg ? (
          <View style={[styles.msgBox, msg.includes('✅') ? styles.msgOk : styles.msgWarn]}>
            <Text style={styles.msgText}>{msg}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.recheckBtnWrap} onPress={handleRecheck} disabled={checking}>
          <LinearGradient
            colors={['#0EA5E9', '#38BDF8']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.recheckBtn}
          >
            {checking
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.recheckBtnText}>Verificar novamente</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  hero: { paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24, alignItems: 'center', overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroIcon: { width: 60, height: 60, marginBottom: 12 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 6 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  body: { flex: 1, padding: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: '#E0F2FE', marginBottom: 16,
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { fontSize: 20 },
  statusText: { fontSize: 15, fontWeight: '700', color: '#D97706' },
  crmLine: { fontSize: 14, color: '#64748B', marginBottom: 2 },
  crmValue: { fontWeight: '800', color: '#0EA5E9' },
  nameLine: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  infoIcon: { width: 20, height: 20, marginRight: 4 },
  infoIconEmoji: { fontSize: 16, width: 24 },
  infoText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 20 },

  msgBox: { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1 },
  msgOk: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  msgWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  msgText: { fontSize: 13, fontWeight: '600', textAlign: 'center', color: '#1E293B' },

  recheckBtnWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  recheckBtn: { paddingVertical: 16, alignItems: 'center' },
  recheckBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  logoutBtn: { alignItems: 'center', paddingVertical: 12 },
  logoutText: { color: '#94A3B8', fontSize: 14 },
});
