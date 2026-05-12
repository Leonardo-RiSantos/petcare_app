import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image, Animated, StyleSheet, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import UpgradeModal from './UpgradeModal';

const safeGet = async (key) => {
  if (Platform.OS === 'web') { try { return localStorage.getItem(key); } catch { return null; } }
  return AsyncStorage.getItem(key);
};
const safeSet = async (key, val) => {
  if (Platform.OS === 'web') { try { localStorage.setItem(key, val); } catch {} return; }
  return AsyncStorage.setItem(key, val);
};

const GENERICOS = [
  '🐾 Seus pets estão sendo muito bem cuidados!',
  '💙 Olá, tutor! Estou aqui se precisar de ajuda.',
  '😸 Que tal registrar o peso do seu pet hoje?',
  '🌟 Continue assim! Seus pets te amam muito!',
  '🏥 Não esqueça do check-up anual do seu pet!',
];

export default function FredFloat() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { canUseFred } = usePlan();
  const [msg, setMsg] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState(false);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.8)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const btnScale   = useRef(new Animated.Value(0)).current;
  const mounted    = useRef(true);

  useEffect(() => {
    // Fred aparece com efeito pop
    Animated.spring(btnScale, { toValue: 1, tension: 70, friction: 6, useNativeDriver: true }).start();

    // Pulo suave periódico
    const doBounce = () => {
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -8, duration: 300, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0,  duration: 300, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: -4, duration: 200, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0,  duration: 200, useNativeDriver: true }),
      ]).start();
    };
    mounted.current = true;
    doBounce();
    const interval = setInterval(doBounce, 9000);

    checkPrimeiraVez();
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, []);

  const checkPrimeiraVez = async () => {
    const hoje = new Date().toDateString();
    const ultimo = await safeGet('fred_last_seen');
    if (ultimo !== hoje) {
      await safeSet('fred_last_seen', hoje);
      setTimeout(buscarLembrete, 2500);
    }
  };

  const buscarLembrete = async () => {
    try {
      const hoje = new Date();
      const em7 = new Date(); em7.setDate(hoje.getDate() + 7);
      const em15 = new Date(); em15.setDate(hoje.getDate() + 15);

      const [{ data: vaccines }, { data: pets }, { data: appointments }] = await Promise.all([
        supabase.from('vaccines').select('name, next_dose_date, pet_id').eq('user_id', user.id).not('next_dose_date', 'is', null),
        supabase.from('pets').select('id, name, birth_date').eq('user_id', user.id),
        supabase.from('appointments').select('scheduled_date, scheduled_time, type, notes, pet_id').eq('tutor_id', user.id).eq('status', 'scheduled'),
      ]);

      const petNome = (petId) => pets?.find(p => p.id === petId)?.name || 'Seu pet';

      // ── Verifica aniversários (prioridade máxima) ──
      for (const pet of (pets || [])) {
        if (!pet.birth_date) continue;
        const birth = new Date(pet.birth_date);
        const nextBd = new Date(hoje.getFullYear(), birth.getMonth(), birth.getDate());
        if (nextBd < hoje) nextBd.setFullYear(hoje.getFullYear() + 1);
        const dias = Math.ceil((nextBd - hoje) / (1000 * 60 * 60 * 24));

        const bdKey = `fred_bd_${pet.id}_${nextBd.getFullYear()}`;
        const jaViu = await safeGet(bdKey);
        if (jaViu) continue;

        let bdMsg = null;
        if (dias === 0)       bdMsg = `🎂 Hoje é aniversário de ${pet.name}! Parabéns ao seu melhor amigo!`;
        else if (dias === 1)  bdMsg = `🎈 Amanhã é aniversário de ${pet.name}! Já preparou a surpresa?`;
        else if (dias === 7)  bdMsg = `🐾 Faltam 7 dias para o aniversário de ${pet.name}!`;
        else if (dias === 15) bdMsg = `🎉 Faltam 15 dias para o aniversário de ${pet.name}! Começa a planejar!`;

        if (bdMsg) {
          await safeSet(bdKey, '1');
          mostrarBolinha(bdMsg);
          return;
        }
      }

      // ── Verifica agendamentos (prioridade alta) ──
      for (const appt of (appointments || [])) {
        const apptDate = new Date(appt.scheduled_date);
        const dias = Math.ceil((apptDate - hoje) / (1000 * 60 * 60 * 24));
        const petNomeAppt = (pets || []).find(p => p.id === appt.pet_id)?.name || 'Seu pet';
        const tipoLabel = { consulta: 'consulta', cirurgia: 'cirurgia', exame: 'exame', retorno: 'retorno', outro: 'consulta' }[appt.type] || 'consulta';

        const apptKey = `fred_appt_${appt.pet_id}_${appt.scheduled_date}`;
        const jaViu = await safeGet(apptKey);
        if (jaViu) continue;

        let apptMsg = null;
        if (dias === 0)       apptMsg = `🏥 Hoje é o dia! ${petNomeAppt} tem ${tipoLabel} marcada${appt.scheduled_time ? ` às ${appt.scheduled_time}` : ''}!`;
        else if (dias === 1)  apptMsg = `📅 Amanhã ${petNomeAppt} tem ${tipoLabel} com o veterinário!`;
        else if (dias <= 3)   apptMsg = `📅 Em ${dias} dias: ${tipoLabel} de ${petNomeAppt}. Prepare-se!`;
        else if (dias === 7)  apptMsg = `🗓 Faltam 7 dias para a ${tipoLabel} de ${petNomeAppt}.`;

        if (apptMsg) {
          await safeSet(apptKey, '1');
          mostrarBolinha(apptMsg);
          return;
        }
      }

      // ── Verifica vacinas ──
      const atrasadas = (vaccines || []).filter(v => new Date(v.next_dose_date) < hoje);
      const proximas  = (vaccines || []).filter(v => {
        const d = new Date(v.next_dose_date);
        return d >= hoje && d <= em7;
      });

      let lembrete;
      if (atrasadas.length > 0) {
        const v = atrasadas[0];
        const nome = v.name.split('(')[0].trim();
        lembrete = `⚠️ ${petNome(v.pet_id)} está com a ${nome} em atraso!`;
      } else if (proximas.length > 0) {
        const v = proximas[0];
        lembrete = `💉 ${petNome(v.pet_id)} tem vacina vencendo em breve!`;
      } else {
        lembrete = GENERICOS[Math.floor(Math.random() * GENERICOS.length)];
      }

      mostrarBolinha(lembrete);
    } catch {
      mostrarBolinha(GENERICOS[0]);
    }
  };

  const mostrarBolinha = (texto) => {
    if (!mounted.current) return;
    setMsg(texto);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
    ]).start();
    setTimeout(esconderBolinha, 5500);
  };

  const esconderBolinha = () => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
    ]).start(() => setMsg(null));
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <UpgradeModal visible={upgradeModal} onClose={() => setUpgradeModal(false)} feature="fred" />

      {/* Bolinha de fala — só aparece no premium */}
      {canUseFred && msg && (
        <Animated.View style={[styles.bubble, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity onPress={esconderBolinha} activeOpacity={0.95}>
            <Text style={styles.bubbleText}>{msg}</Text>
            <Text style={styles.bubbleDismiss}>toque para fechar</Text>
          </TouchableOpacity>
          <View style={styles.tail} />
          <View style={styles.tailInner} />
        </Animated.View>
      )}

      {/* Botão Fred */}
      <Animated.View style={{ transform: [{ translateY: bounceAnim }, { scale: btnScale }] }}>
        <TouchableOpacity
          style={[styles.fredBtn, !canUseFred && styles.fredBtnLocked]}
          onPress={() => canUseFred ? navigation.navigate('Fred') : setUpgradeModal(true)}
          activeOpacity={0.88}
        >
          <Image
            source={require('../../assets/icon_fred.png')}
            style={{ width: 54, height: 54, opacity: canUseFred ? 1 : 0.45 }}
            resizeMode="contain"
          />
          {!canUseFred && (
            <View style={styles.fredLockBadge}>
              <Image source={require('../../assets/icon_crown.png')} style={{ width: 13, height: 13 }} resizeMode="contain" />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 76, right: 14,
    alignItems: 'flex-end', zIndex: 999,
  },

  fredBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
    borderWidth: 2.5, borderColor: '#FEF3C7',
    position: 'relative',
  },
  fredBtnLocked: {
    borderColor: '#E2E8F0',
    shadowColor: '#94A3B8', shadowOpacity: 0.15,
  },
  fredLockBadge: {
    position: 'absolute', top: 2, right: 2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FEF9C3', borderWidth: 1.5, borderColor: '#FDE68A',
    justifyContent: 'center', alignItems: 'center',
  },

  bubble: {
    backgroundColor: '#fff', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 12,
    maxWidth: 220, marginBottom: 10,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.13, shadowRadius: 10, elevation: 7,
    borderWidth: 1.5, borderColor: '#E0F2FE',
  },
  bubbleText: {
    fontSize: 14, color: '#1E293B', lineHeight: 21, fontWeight: '600',
  },
  bubbleDismiss: {
    fontSize: 10, color: '#BAE6FD', marginTop: 6, textAlign: 'right',
  },

  // Triângulo apontando para o botão
  tail: {
    position: 'absolute', bottom: -10, right: 28,
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#E0F2FE',
  },
  tailInner: {
    position: 'absolute', bottom: -8, right: 29,
    width: 0, height: 0,
    borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#fff',
  },
});
