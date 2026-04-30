import { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share, Linking,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const SUPABASE_URL = 'https://wqabzvataiellbttoojn.supabase.co';
const SPECIES_EMOJI = { Cachorro: '🐶', Gato: '🐱', Ave: '🐦', Coelho: '🐰', Hamster: '🐹', Réptil: '🦎', Outro: '🐾' };

export default function PetQRScreen({ route }) {
  const { petId } = route.params;
  const { user } = useAuth();
  const [pet, setPet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingPhone, setSavingPhone] = useState(false);
  const qrRef = useRef();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [petRes, profileRes] = await Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ]);
    if (petRes.data) setPet(petRes.data);
    if (profileRes.data) setProfile(profileRes.data);
    setLoading(false);
  };

  const publicUrl = pet ? `${SUPABASE_URL}/functions/v1/pet-public?id=${pet.qr_code_id}` : '';
  const shortId = pet ? pet.qr_code_id.substring(0, 8).toUpperCase() : '';

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🐾 ${pet?.name} está registrado no PetCare+\n\nAcesse o RG digital: ${publicUrl}`,
        url: publicUrl,
      });
    } catch {}
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(publicUrl);
    Alert.alert('✅ Copiado!', 'Link público copiado para a área de transferência.');
  };

  const handleOpenPublicPage = () => {
    Linking.openURL(publicUrl);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  if (!pet) return null;

  const emoji = SPECIES_EMOJI[pet.species] || '🐾';
  const ownerName = profile?.full_name || 'Tutor';
  const contact = pet.contact_phone || profile?.phone || '(não informado)';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Badge premium */}
      <View style={styles.premiumBadge}>
        <Text style={styles.premiumText}>✦ RECURSO PREMIUM</Text>
      </View>

      <Text style={styles.pageTitle}>Identificação digital</Text>
      <Text style={styles.pageSubtitle}>Documento oficial PetCare+ com QR Code para identificar seu pet em qualquer lugar.</Text>

      {/* Card RG Digital */}
      <View style={styles.rgCard}>
        {/* Header do card */}
        <LinearGradient
          colors={['#0C4A6E', '#0EA5E9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardHeader}
        >
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardBrand}>🐾 PetCare+</Text>
            <Text style={styles.cardDocType}>RG Digital</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.cardId}>#{shortId}</Text>
          </View>
        </LinearGradient>

        {/* Corpo do card */}
        <View style={styles.cardBody}>
          {/* Pet info */}
          <View style={styles.petRow}>
            <View style={styles.petAvatarCircle}>
              <Text style={styles.petAvatarEmoji}>{emoji}</Text>
            </View>
            <View style={styles.petInfoBlock}>
              <Text style={styles.petCardName}>{pet.name}</Text>
              <Text style={styles.petCardBreed}>
                {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
              </Text>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>● IDENTIFICAÇÃO ATIVA</Text>
              </View>
            </View>
          </View>

          {/* Divisor */}
          <View style={styles.divider} />

          {/* Personalidade e pelagem */}
          {(pet.personality?.length > 0 || pet.coat_color) && (
            <View style={styles.extrasSection}>
              {pet.coat_color && (
                <View style={styles.extrasRow}>
                  <Text style={styles.extrasIcon}>🎨</Text>
                  <Text style={styles.extrasLabel}>PELAGEM: </Text>
                  <Text style={styles.extrasValue}>{pet.coat_color}</Text>
                </View>
              )}
              {pet.personality?.length > 0 && (
                <View style={styles.extrasRow}>
                  <Text style={styles.extrasIcon}>🐾</Text>
                  <Text style={styles.extrasLabel}>PERSONALIDADE: </Text>
                  <Text style={styles.extrasValue}>{pet.personality.join(' · ')}</Text>
                </View>
              )}
            </View>
          )}

          <View style={[styles.divider, { marginTop: 0 }]} />

          {/* Tutor e contato */}
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>👤</Text>
              <Text style={styles.infoLabel}>TUTOR</Text>
              <Text style={styles.infoValue}>{ownerName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📞</Text>
              <Text style={styles.infoLabel}>CONTATO</Text>
              <Text style={styles.infoValue}>{contact}</Text>
            </View>
          </View>

          {/* QR Code */}
          <View style={styles.qrSection}>
            <View style={styles.qrLockRow}>
              <Text style={styles.qrLockIcon}>🔒</Text>
              <Text style={styles.qrSectionLabel}>QR CODE</Text>
            </View>
            <View style={styles.qrWrapper}>
              <QRCode
                value={publicUrl}
                size={150}
                color="#1E293B"
                backgroundColor="#fff"
                getRef={qrRef}
              />
            </View>
            <Text style={styles.qrCaption}>Escaneie para ver os dados públicos</Text>
            <Text style={styles.qrSubCaption}>Link permanente, atualizado em tempo real</Text>
          </View>

          {/* Footer do card */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>🐾 Documento oficial PetCare+</Text>
          </View>
        </View>
      </View>

      {/* Botões de ação */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleShare}>
          <Text style={styles.actionBtnPrimaryText}>⬆ Compartilhar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleOpenPublicPage}>
          <Text style={styles.actionBtnSecondaryText}>↓ Abrir QR</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyLink}>
        <Text style={styles.copyLinkText}>🔗 Copiar link público</Text>
      </TouchableOpacity>

      {/* Info: dados públicos */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardRow}>
          <Text style={styles.infoCardIcon}>🔒</Text>
          <View style={styles.infoCardContent}>
            <Text style={styles.infoCardTitle}>Apenas dados públicos compartilhados</Text>
            <Text style={styles.infoCardDesc}>Telefone, endereço completo e dados sensíveis ficam protegidos.</Text>
          </View>
        </View>
      </View>

      {/* Como funciona */}
      <View style={styles.howCard}>
        <Text style={styles.howTitle}>❓ Como funciona?</Text>
        <Text style={styles.howDesc}>Quando alguém escaneia o QR Code, visualiza as informações públicas do seu pet para facilitar a identificação e o contato com você.</Text>
        <View style={styles.howItems}>
          <View style={styles.howItem}>
            <Text style={styles.howItemIcon}>🔗</Text>
            <View>
              <Text style={styles.howItemTitle}>Link permanente</Text>
              <Text style={styles.howItemDesc}>Funciona mesmo sem o app aberto</Text>
            </View>
          </View>
          <View style={styles.howItem}>
            <Text style={styles.howItemIcon}>🔒</Text>
            <View>
              <Text style={styles.howItemTitle}>Seguro e atualizado</Text>
              <Text style={styles.howItemDesc}>Acesso sem login, em qualquer lugar</Text>
            </View>
          </View>
          <View style={styles.howItem}>
            <Text style={styles.howItemIcon}>⚡</Text>
            <View>
              <Text style={styles.howItemTitle}>Sempre atualizado</Text>
              <Text style={styles.howItemDesc}>Mudou o dado? Já reflete no QR</Text>
            </View>
          </View>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  premiumBadge: {
    backgroundColor: '#FEF9C3', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#FDE68A',
  },
  premiumText: { fontSize: 11, fontWeight: '800', color: '#B45309', letterSpacing: 1 },

  pageTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 20 },

  // Card RG
  rgCard: {
    borderRadius: 20, overflow: 'hidden', marginBottom: 20,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  cardHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderLeft: {},
  cardHeaderRight: {},
  cardBrand: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  cardDocType: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  cardId: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'monospace', fontWeight: '700' },

  cardBody: { backgroundColor: '#fff', padding: 20 },

  petRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  petAvatarCircle: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: '#F0F9FF',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0',
  },
  petAvatarEmoji: { fontSize: 36 },
  petInfoBlock: { flex: 1 },
  petCardName: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  petCardBreed: { fontSize: 13, color: '#64748B', marginTop: 2 },
  activeBadge: { backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 8 },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: '#16A34A', letterSpacing: 0.5 },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 16 },

  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  infoItem: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 },
  infoIcon: { fontSize: 18, marginBottom: 4 },
  infoLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1E293B' },

  qrSection: { alignItems: 'center', marginBottom: 16 },
  qrLockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  qrLockIcon: { fontSize: 14 },
  qrSectionLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1 },
  qrWrapper: {
    padding: 16, backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  qrCaption: { fontSize: 13, color: '#374151', fontWeight: '600', marginTop: 12 },
  qrSubCaption: { fontSize: 11, color: '#94A3B8', marginTop: 4 },

  extrasSection: { marginBottom: 14, gap: 6 },
  extrasRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  extrasIcon: { fontSize: 14, marginRight: 4 },
  extrasLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  extrasValue: { fontSize: 13, color: '#1E293B', fontWeight: '500', flex: 1 },

  cardFooter: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, alignItems: 'center' },
  cardFooterText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },

  // Ações
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  actionBtnPrimary: {
    flex: 1, backgroundColor: '#0EA5E9', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center',
  },
  actionBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionBtnSecondary: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  actionBtnSecondaryText: { color: '#1E293B', fontSize: 15, fontWeight: '700' },
  copyLinkBtn: {
    backgroundColor: '#F8FAFC', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0',
  },
  copyLinkText: { color: '#64748B', fontSize: 14, fontWeight: '600' },

  // Info cards
  infoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  infoCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoCardIcon: { fontSize: 24 },
  infoCardContent: { flex: 1 },
  infoCardTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  infoCardDesc: { fontSize: 13, color: '#64748B', lineHeight: 18 },

  howCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  howTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  howDesc: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 16 },
  howItems: { gap: 14 },
  howItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  howItemIcon: { fontSize: 22 },
  howItemTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  howItemDesc: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
});
