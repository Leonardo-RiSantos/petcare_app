import { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share, Image, Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const SPECIES_IMAGES = {
  Cachorro: require('../../../assets/pet_cachorro.png'),
  Gato:     require('../../../assets/pet_gato.png'),
  Ave:      require('../../../assets/pet_ave.png'),
  Coelho:   require('../../../assets/pet_coelho.png'),
  Hamster:  require('../../../assets/pet_hamster.png'),
  Réptil:   require('../../../assets/pet_reptil.png'),
  Peixe:    require('../../../assets/pet_peixe.png'),
};

// Faixa etária por espécie (meses)
function getAgeStage(birthDate, species) {
  if (!birthDate) return null;
  const months = Math.floor((Date.now() - new Date(birthDate)) / (1000 * 60 * 60 * 24 * 30.44));
  const thresholds = {
    Cachorro: { filhote: 12, adolescente: 24 },
    Gato:     { filhote: 12, adolescente: 36 },
    Ave:      { filhote: 6,  adolescente: 18 },
    Coelho:   { filhote: 6,  adolescente: 12 },
    Hamster:  { filhote: 2,  adolescente: 6  },
    Réptil:   { filhote: 12, adolescente: 24 },
    Peixe:    { filhote: 6,  adolescente: 12  },
  };
  const t = thresholds[species] || { filhote: 12, adolescente: 24 };
  if (months < t.filhote) return 'Filhote';
  if (months < t.adolescente) return 'Adolescente';
  return 'Adulto';
}

function calcAge(birthDate) {
  if (!birthDate) return null;
  const months = Math.floor((Date.now() - new Date(birthDate)) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 1) return 'menos de 1 mês';
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}a ${m}m` : `${y} ${y === 1 ? 'ano' : 'anos'}`;
}

export default function PetQRScreen({ route }) {
  const { petId } = route.params;
  const { user } = useAuth();
  const [pet, setPet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  if (!pet) return null;

  // O QR contém o código curto do pet — o vet digita ou escaneia para vincular
  const shortCode = petId.split('-')[0].toUpperCase();
  const qrValue   = shortCode; // código de 8 chars usado no VetAddPatientScreen

  const ownerName = profile?.full_name || 'Tutor';
  const contact   = pet.contact_phone || profile?.phone || 'Não informado';
  const ageStage  = getAgeStage(pet.birth_date, pet.species);
  const ageText   = calcAge(pet.birth_date);
  const speciesImg = SPECIES_IMAGES[pet.species];

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🐾 ${pet.name} — PetCare+\nCódigo: ${shortCode}\n\nCompartilhe este código com o veterinário para acesso ao histórico completo.`,
      });
    } catch {}
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(shortCode);
    Alert.alert('✅ Copiado!', `Código "${shortCode}" copiado. Envie ao veterinário.`);
  };

  const InfoRow = ({ icon, label, value }) => value ? (
    <View style={styles.infoRow}>
      {typeof icon === 'string'
        ? <Text style={styles.infoRowIcon}>{icon}</Text>
        : <Image source={icon} style={styles.infoRowIconImg} resizeMode="contain" />}
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  ) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.pageTitle}>RG Digital</Text>
      <Text style={styles.pageSubtitle}>Documento de identificação do seu pet com QR Code</Text>

      {/* ── Card RG ── */}
      <View style={styles.rgCard}>

        {/* Header */}
        <LinearGradient
          colors={['#0C4A6E', '#0284C7', '#0EA5E9']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.cardHeader}
        >
          <View style={[styles.bubble, { width: 120, height: 120, top: -30, right: -30 }]} />
          <View style={[styles.bubble, { width: 60, height: 60, bottom: -15, left: 20 }]} />
          <View>
            <Text style={styles.cardBrand}>🐾 PetCare+</Text>
            <Text style={styles.cardDocType}>RG Digital</Text>
          </View>
          <View style={styles.shortCodeBox}>
            <Text style={styles.shortCodeLabel}>CÓDIGO</Text>
            <Text style={styles.shortCodeValue}>{shortCode}</Text>
          </View>
        </LinearGradient>

        {/* Corpo */}
        <View style={styles.cardBody}>

          {/* Avatar + nome */}
          <View style={styles.petRow}>
            <View style={styles.petAvatarCircle}>
              {pet.photo_url ? (
                <Image source={{ uri: pet.photo_url }} style={styles.petAvatarPhoto} />
              ) : speciesImg ? (
                <Image source={speciesImg} style={styles.petAvatarImg} resizeMode="contain" />
              ) : (
                <Text style={{ fontSize: 36 }}>🐾</Text>
              )}
            </View>
            <View style={styles.petInfoBlock}>
              <Text style={styles.petCardName}>{pet.name}</Text>
              <Text style={styles.petCardBreed}>
                {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
              </Text>
              {ageStage && (
                <View style={styles.ageStageBadge}>
                  <Text style={styles.ageStageText}>{ageStage}</Text>
                </View>
              )}
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>● IDENTIFICAÇÃO ATIVA</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Dados do pet */}
          <View style={styles.dataSection}>
            <InfoRow icon={require('../../../assets/icon_birthday.png')} label="Idade"    value={ageText} />
            <InfoRow icon={require('../../../assets/icon_gender.png')}   label="Sexo"     value={pet.sex} />
            <InfoRow icon={require('../../../assets/icon_palette.png')}  label="Pelagem"  value={pet.coat_color} />
            <InfoRow icon="✂️"                                           label="Castrado" value={pet.neutered ? 'Sim' : null} />
            <InfoRow icon={require('../../../assets/icon_weight.png')}   label="Peso"     value={pet.weight_kg ? `${pet.weight_kg} kg` : null} />
            {pet.personality?.length > 0 && (
              <InfoRow icon="🐾" label="Perfil"  value={pet.personality.join(' · ')} />
            )}
          </View>

          <View style={styles.divider} />

          {/* Tutor */}
          <View style={styles.tutorRow}>
            <View style={styles.tutorItem}>
              <Image source={require('../../../assets/icon_profile.png')} style={styles.tutorIcon} resizeMode="contain" />
              <Text style={styles.tutorLabel}>TUTOR</Text>
              <Text style={styles.tutorValue}>{ownerName}</Text>
            </View>
            <View style={styles.tutorItem}>
              <Text style={styles.tutorIcon}>📞</Text>
              <Text style={styles.tutorLabel}>CONTATO</Text>
              <Text style={styles.tutorValue}>{contact}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* QR Code */}
          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>QR CODE</Text>
            <View style={styles.qrWrapper}>
              <QRCode
                value={qrValue}
                size={160}
                color="#1E293B"
                backgroundColor="#fff"
                getRef={qrRef}
              />
            </View>
            <Text style={styles.qrCaption}>
              Escaneie ou use o código <Text style={styles.qrCodeHighlight}>{shortCode}</Text>
            </Text>
            <Text style={styles.qrSubCaption}>O veterinário usa este código para acessar o histórico</Text>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>🐾 Documento oficial PetCare+ · {shortCode}</Text>
          </View>
        </View>
      </View>

      {/* Ações */}
      <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
        <LinearGradient colors={['#0EA5E9','#38BDF8']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.copyBtnGrad}>
          <Text style={styles.copyBtnText}>Copiar código para o veterinário</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>⬆ Compartilhar RG</Text>
      </TouchableOpacity>

      {/* Como usar */}
      <View style={styles.howCard}>
        <Text style={styles.howTitle}>Como o veterinário acessa?</Text>
        {[
          { icon: '1️⃣', text: `Copie o código ${shortCode} e envie ao veterinário` },
          { icon: '2️⃣', text: 'O vet cria conta no PetCare+ como veterinário' },
          { icon: '3️⃣', text: 'Na área dele, entra com o código para vincular o pet' },
          { icon: '4️⃣', text: 'Acesso permanente ao histórico completo em tempo real' },
        ].map((item, i) => (
          <View key={i} style={styles.howRow}>
            <Text style={styles.howIcon}>{item.icon}</Text>
            <Text style={styles.howText}>{item.text}</Text>
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { padding: 20, paddingBottom: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  pageTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 20 },

  rgCard: {
    borderRadius: 24, overflow: 'hidden', marginBottom: 20,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },

  // Header
  cardHeader: { padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  cardBrand: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  cardDocType: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 2 },
  shortCodeBox: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, padding: 12, alignItems: 'center' },
  shortCodeLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 2 },
  shortCodeValue: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  // Corpo
  cardBody: { backgroundColor: '#fff', padding: 20 },

  // Pet row
  petRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  petAvatarCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0F9FF',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E0F2FE', overflow: 'hidden',
  },
  petAvatarPhoto: { width: 80, height: 80, borderRadius: 40 },
  petAvatarImg: { width: 52, height: 52 },
  petInfoBlock: { flex: 1 },
  petCardName: { fontSize: 22, fontWeight: '900', color: '#1E293B' },
  petCardBreed: { fontSize: 13, color: '#64748B', marginTop: 2 },
  ageStageBadge: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  ageStageText: { fontSize: 11, fontWeight: '700', color: '#0EA5E9' },
  activeBadge: { backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  activeBadgeText: { fontSize: 9, fontWeight: '700', color: '#16A34A', letterSpacing: 0.5 },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 },

  // Dados
  dataSection: { gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoRowIcon: { fontSize: 14, width: 22 },
  infoRowIconImg: { width: 16, height: 16, marginRight: 6 },
  infoRowLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, width: 60 },
  infoRowValue: { fontSize: 13, color: '#1E293B', fontWeight: '600', flex: 1 },

  // Tutor
  tutorRow: { flexDirection: 'row', gap: 12 },
  tutorItem: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12 },
  tutorIcon: { width: 22, height: 22, marginBottom: 4 },
  tutorLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
  tutorValue: { fontSize: 13, fontWeight: '600', color: '#1E293B' },

  // QR
  qrSection: { alignItems: 'center' },
  qrLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 14 },
  qrWrapper: {
    padding: 16, backgroundColor: '#fff', borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  qrCaption: { fontSize: 13, color: '#374151', fontWeight: '600', marginTop: 12, textAlign: 'center' },
  qrCodeHighlight: { color: '#0EA5E9', fontWeight: '900' },
  qrSubCaption: { fontSize: 11, color: '#94A3B8', marginTop: 4, textAlign: 'center' },

  cardFooter: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, marginTop: 14, alignItems: 'center' },
  cardFooterText: { fontSize: 11, color: '#94A3B8' },

  // Ações
  copyBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  copyBtnGrad: { paddingVertical: 17, alignItems: 'center' },
  copyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  shareBtn: {
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 15, alignItems: 'center',
    marginBottom: 24, borderWidth: 1.5, borderColor: '#E0F2FE',
  },
  shareBtnText: { color: '#1E293B', fontSize: 15, fontWeight: '700' },

  // Como usar
  howCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#EFF6FF' },
  howTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 14 },
  howRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  howIcon: { fontSize: 16, width: 28 },
  howText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 20 },
});
