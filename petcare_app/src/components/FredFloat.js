import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, Animated, StyleSheet, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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
  const [msg, setMsg] = useState(null);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.8)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const btnScale   = useRef(new Animated.Value(0)).current;

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
    doBounce();
    const interval = setInterval(doBounce, 9000);

    checkPrimeiraVez();
    return () => clearInterval(interval);
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

      const [{ data: vaccines }, { data: pets }] = await Promise.all([
        supabase.from('vaccines').select('name, next_dose_date, pet_id').eq('user_id', user.id).not('next_dose_date', 'is', null),
        supabase.from('pets').select('id, name').eq('user_id', user.id),
      ]);

      const petNome = (petId) => pets?.find(p => p.id === petId)?.name || 'Seu pet';

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

      {/* Bolinha de fala */}
      {msg && (
        <Animated.View style={[styles.bubble, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity onPress={esconderBolinha} activeOpacity={0.95}>
            <Text style={styles.bubbleText}>{msg}</Text>
            <Text style={styles.bubbleDismiss}>toque para fechar</Text>
          </TouchableOpacity>
          {/* Rabo da bolinha */}
          <View style={styles.tail} />
          <View style={styles.tailInner} />
        </Animated.View>
      )}

      {/* Botão Fred */}
      <Animated.View style={{ transform: [{ translateY: bounceAnim }, { scale: btnScale }] }}>
        <TouchableOpacity
          style={styles.fredBtn}
          onPress={() => navigation.navigate('Fred')}
          activeOpacity={0.88}
        >
          <Image
            source={require('../../assets/icon_fred.png')}
            style={{ width: 54, height: 54 }}
            resizeMode="contain"
          />
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
