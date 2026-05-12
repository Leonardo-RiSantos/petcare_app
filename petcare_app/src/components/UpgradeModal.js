import { View, Text, StyleSheet, TouchableOpacity, Modal, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

const ICON_CHECK  = require('../../assets/icon_check.png');
const ICON_CROWN  = require('../../assets/icon_crown.png');

const BENEFITS = [
  'Pets ilimitados cadastrados',
  'Mapa com locais pet-friendly',
  'Vinculação com veterinários',
  'Assistente Fred com IA',
  'Compartilhar com até 2 pessoas',
];

const FEATURE_NAMES = {
  pets:    'Cadastro de múltiplos pets',
  maps:    'Mapa Pet',
  vets:    'Aba Veterinários',
  fred:    'Assistente Fred com IA',
  viewers: 'Compartilhar com outras pessoas',
};

const FEATURE_DETAIL = {
  vets: 'Conecte seu pet ao médico veterinário de confiança. Com a aba Vets você pode:\n\n• Compartilhar o código do pet com o veterinário\n• Ver todos os registros clínicos feitos pelo vet\n• Acompanhar prescrições e diagnósticos\n• Ver agendamentos de consultas e cirurgias\n• Manter o histórico médico centralizado',
};

export default function UpgradeModal({ visible, onClose, feature }) {
  const navigation = useNavigation();
  const featureName = FEATURE_NAMES[feature] || 'este recurso';
  const featureDetail = FEATURE_DETAIL[feature] || null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Ícone premium */}
          <Image source={ICON_CROWN} style={styles.crownImg} resizeMode="contain" />

          <Text style={styles.tag}>PLANO PREMIUM</Text>
          <Text style={styles.title}>Recurso exclusivo</Text>
          <Text style={styles.subtitle}>
            <Text style={styles.featureName}>{featureName}</Text>
            {' '}está disponível apenas no plano Premium.
          </Text>

          {/* Detalhe específico da feature (ex: aba Vets) */}
          {featureDetail ? (
            <View style={styles.detailBox}>
              <Text style={styles.detailText}>{featureDetail}</Text>
            </View>
          ) : (
            /* Benefícios gerais (quando não há detalhe específico) */
            <View style={styles.benefitsList}>
              {BENEFITS.map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <View style={styles.benefitCheck}>
                    <Image source={ICON_CHECK} style={{ width: 11, height: 11 }} resizeMode="contain" />
                  </View>
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Preço destaque */}
          <View style={styles.priceHint}>
            <Text style={styles.priceHintFrom}>A partir de </Text>
            <Text style={styles.priceHintValue}>R$ 19,90</Text>
            <Text style={styles.priceHintPer}>/mês</Text>
          </View>

          {/* Botão upgrade */}
          <TouchableOpacity
            style={styles.upgradeBtnWrap}
            onPress={() => { onClose(); navigation.navigate('Plan'); }}
          >
            <LinearGradient
              colors={['#F59E0B', '#FBBF24']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.upgradeBtn}
            >
              <Text style={styles.upgradeBtnText}>Ver planos →</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Agora não</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 28,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 28, padding: 28,
    alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 30, elevation: 12,
  },

  crownImg: {
    width: 86, height: 86, marginBottom: 14,
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14,
  },

  tag: {
    fontSize: 10, fontWeight: '800', color: '#F59E0B',
    letterSpacing: 1.5, marginBottom: 6,
    backgroundColor: '#FEF9C3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#1E293B', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  featureName: { color: '#0EA5E9', fontWeight: '700' },

  benefitsList: { width: '100%', gap: 10, marginBottom: 24 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitCheck: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#DCFCE7',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  benefitText: { fontSize: 14, color: '#374151', flex: 1 },

  detailBox: {
    backgroundColor: '#F0F9FF', borderRadius: 14, padding: 14, marginBottom: 20,
    width: '100%', borderWidth: 1, borderColor: '#BAE6FD',
  },
  detailText: { fontSize: 13, color: '#374151', lineHeight: 22 },

  upgradeBtnWrap: { borderRadius: 16, overflow: 'hidden', width: '100%', marginBottom: 12 },
  upgradeBtn: { paddingVertical: 16, alignItems: 'center' },
  upgradeBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  priceHint: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 2,
    marginBottom: 16,
  },
  priceHintFrom: { fontSize: 12, color: '#94A3B8', marginBottom: 2 },
  priceHintValue: { fontSize: 24, fontWeight: '900', color: '#1E293B' },
  priceHintPer: { fontSize: 13, color: '#64748B', marginBottom: 3 },

  closeBtn: { paddingVertical: 8 },
  closeBtnText: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
});
