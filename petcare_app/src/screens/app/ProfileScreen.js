import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl, Platform, Image, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../utils/logger';
import { usePlan } from '../../hooks/usePlan';
import { uploadImage, pickImage } from '../../utils/uploadImage';

const ICONS = {
  email:    require('../../../assets/icon_email.png'),
  profile:  require('../../../assets/icon_profile.png'),
  fred:     require('../../../assets/icon_fred.png'),
  app:      require('../../../assets/icon_app.png'),
  logout:   require('../../../assets/icon_logout.png'),
  expenses: require('../../../assets/icon_expenses.png'),
  medical:  require('../../../assets/icon_medical.png'),
  home:     require('../../../assets/icon_home.png'),
};

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ icon, label, value, onPress, danger }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Image source={icon} style={[styles.rowIcon, danger && { tintColor: '#EF4444' }]} resizeMode="contain" />
      <Text style={[styles.rowLabel, danger && styles.rowDanger]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Text style={styles.rowArrow}>›</Text> : null}
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, signOut, plan, isPremium, isVet } = useAuth();
  const { maxViewers } = usePlan();
  const [profile, setProfile] = useState({ full_name: '', phone: '', address: '', avatar_url: '' });
  const [vetData, setVetData] = useState({ specialty: '', clinic_name: '', clinic_address: '' });
  const [stats, setStats] = useState({ pets: 0, vaccines: 0, totalExpenses: 0 });
  const [vetStats, setVetStats] = useState({ patients: 0, consultations: 0, monthRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactSaved, setContactSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Edição dados profissionais (vet)
  const [editingVet, setEditingVet] = useState(false);
  const [vetInputs, setVetInputs] = useState({ specialty: '', clinic_name: '', clinic_address: '' });
  const [savingVet, setSavingVet] = useState(false);
  // Configurações clínica (vet)
  const [vetSettings, setVetSettings] = useState({ chat_enabled: false, booking_enabled: false, booking_slug: '', signature_url: '' });
  const [bookingSlugInput, setBookingSlugInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const fetchData = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const firstOfMonth = `${today.slice(0, 7)}-01`;

    const baseQueries = [
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ];

    if (isVet) {
      // Stats do veterinário: pacientes + consultas + receita do mês
      baseQueries.push(
        supabase.from('vet_profiles').select('specialty, clinic_name, clinic_address, chat_enabled, booking_enabled, booking_slug, signature_url').eq('id', user.id).single(),
        supabase.from('pet_vet_links').select('id', { count: 'exact' }).eq('vet_id', user.id).eq('status', 'active'),
        supabase.from('vet_unlinked_patients').select('id', { count: 'exact' }).eq('vet_id', user.id),
        supabase.from('vet_consultations').select('id', { count: 'exact' }).eq('vet_id', user.id),
        supabase.from('vet_billing').select('amount').eq('vet_id', user.id).eq('status', 'paid').eq('type', 'income').gte('created_at', firstOfMonth),
      );
    } else {
      // Stats do tutor: pets + vacinas + gastos
      baseQueries.push(
        supabase.from('pets').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('vaccines').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('expenses').select('amount').eq('user_id', user.id),
      );
    }

    const results = await Promise.all(baseQueries);

    const profileRes = results[0];
    if (profileRes.data) {
      setProfile(profileRes.data);
      setNameInput(profileRes.data.full_name || '');
      setPhoneInput(profileRes.data.phone || '');
      setAddressInput(profileRes.data.address || '');
    }

    if (isVet) {
      const [, vetRes, linkedRes, avulsosRes, consultRes, billingRes] = results;
      if (vetRes?.data) {
        const vd = { specialty: vetRes.data.specialty || '', clinic_name: vetRes.data.clinic_name || '', clinic_address: vetRes.data.clinic_address || '' };
        setVetData(vd);
        setVetInputs(vd);
        const vs = { chat_enabled: !!vetRes.data.chat_enabled, booking_enabled: !!vetRes.data.booking_enabled, booking_slug: vetRes.data.booking_slug || '', signature_url: vetRes.data.signature_url || '' };
        setVetSettings(vs);
        setBookingSlugInput(vs.booking_slug);
      }
      const totalPatients = (linkedRes.count ?? 0) + (avulsosRes.count ?? 0);
      const monthRevenue = (billingRes.data ?? []).reduce((s, b) => s + Number(b.amount), 0);
      setVetStats({ patients: totalPatients, consultations: consultRes.count ?? 0, monthRevenue });
    } else {
      const [, petsRes, vaccinesRes, expensesRes] = results;
      const total = (expensesRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
      setStats({ pets: petsRes.count ?? 0, vaccines: vaccinesRes.count ?? 0, totalExpenses: total });
    }

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const saveName = async () => {
    if (!nameInput.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: nameInput.trim(),
    });
    setSavingName(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      setProfile(prev => ({ ...prev, full_name: nameInput.trim() }));
      setEditingName(false);
    }
  };

  const saveContact = async () => {
    setContactError('');
    setContactSaved(false);
    setSavingContact(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          phone:   phoneInput.trim()   || null,
          address: addressInput.trim() || null,
        })
        .eq('id', user.id)
        .select('phone, address');

      if (error) throw error;

      // update retornou 0 linhas = RLS bloqueou silenciosamente
      if (!data || data.length === 0) {
        throw new Error('Nenhuma linha atualizada. Execute o SQL de migração no Supabase (supabase_profile_extras.sql) e verifique as políticas RLS.');
      }

      setProfile(prev => ({ ...prev, phone: phoneInput.trim(), address: addressInput.trim() }));
      setContactSaved(true);
      setTimeout(() => { setContactSaved(false); setEditingContact(false); }, 1200);
    } catch (e) {
      logger.error('[saveContact]', e);
      setContactError(e?.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setSavingContact(false);
    }
  };

  const saveVetData = async () => {
    setSavingVet(true);
    const { error } = await supabase.from('vet_profiles').update({
      specialty:      vetInputs.specialty.trim()      || null,
      clinic_name:    vetInputs.clinic_name.trim()    || null,
      clinic_address: vetInputs.clinic_address.trim() || null,
    }).eq('id', user.id);
    setSavingVet(false);
    if (!error) {
      setVetData({ ...vetInputs });
      setEditingVet(false);
    }
  };

  const toggleVetSetting = async (key, value) => {
    const updated = { ...vetSettings, [key]: value };
    setVetSettings(updated);
    await supabase.from('vet_profiles').update({ [key]: value }).eq('id', user.id);
  };

  const saveBookingSlug = async () => {
    const slug = bookingSlugInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!slug) return;
    setSavingSettings(true);
    const { error } = await supabase.from('vet_profiles').update({ booking_slug: slug }).eq('id', user.id);
    setSavingSettings(false);
    if (error) { Alert.alert('Erro', error.message.includes('unique') ? 'Este link já está em uso. Escolha outro.' : error.message); }
    else { setVetSettings(p => ({ ...p, booking_slug: slug })); setBookingSlugInput(slug); }
  };

  const handleSignatureUpload = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setUploadingSignature(true);
    try {
      const url = await uploadImage(uri, 'pet-photos', `signatures/${user.id}`);
      await supabase.from('vet_profiles').update({ signature_url: url }).eq('id', user.id);
      setVetSettings(p => ({ ...p, signature_url: url }));
    } catch (e) {
      Alert.alert('Erro ao enviar assinatura', e.message);
    } finally {
      setUploadingSignature(false);
    }
  };

  const handlePhotoUpload = async () => {
    const uri = await pickImage();
    if (!uri) return;

    setUploadingPhoto(true);
    try {
      const url = await uploadImage(uri, 'pet-photos', `avatars/${user.id}`);
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: url });
      setProfile(prev => ({ ...prev, avatar_url: url }));
    } catch (e) {
      Alert.alert('Erro ao enviar foto', e.message || 'Verifique as configurações do bucket no Supabase Storage.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Deseja sair da sua conta?');
      if (confirmed) signOut();
    } else {
      Alert.alert('Sair', 'Deseja sair da sua conta?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: signOut },
      ]);
    }
  };

  const initials = (profile.full_name || user?.email || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const formatCurrency = (v) =>
    `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
    >
      {/* Hero com avatar */}
      <LinearGradient
        colors={['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.bubble, { width: 130, height: 130, top: -35, right: -25 }]} />
        <View style={[styles.bubble, { width: 70, height: 70, bottom: -15, left: 35 }]} />

        {/* Avatar com botão de foto */}
        <TouchableOpacity style={styles.avatarWrap} onPress={handlePhotoUpload} activeOpacity={0.85}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarPhoto} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {uploadingPhoto
            ? <View style={styles.avatarBadge}><ActivityIndicator size="small" color="#fff" /></View>
            : <View style={styles.avatarBadge}><Text style={styles.avatarBadgeText}>📷</Text></View>}
        </TouchableOpacity>

        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Seu nome"
              placeholderTextColor="rgba(255,255,255,0.6)"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveName} disabled={savingName}>
              {savingName
                ? <ActivityIndicator size="small" color="#0EA5E9" />
                : <Text style={styles.saveBtnText}>Salvar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingName(false)}>
              <Text style={styles.cancelBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingName(true)} style={styles.nameRow}>
            <Text style={styles.name}>{profile.full_name || 'Adicionar nome'}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.email}>{user?.email}</Text>
        {isVet && (
          <View style={{ backgroundColor: 'rgba(167,139,250,0.25)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 8, alignSelf: 'center', borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)' }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>🩺 Plano Veterinário</Text>
          </View>
        )}
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        {isVet ? (
          <>
            <View style={styles.statCard}>
              <LinearGradient colors={['#EDE9FE', '#F5F3FF']} style={styles.statIconWrap}>
                <Text style={styles.statEmoji}>🐾</Text>
              </LinearGradient>
              <Text style={styles.statValue}>{vetStats.patients}</Text>
              <Text style={styles.statLabel}>Pacientes</Text>
            </View>
            <View style={styles.statCard}>
              <LinearGradient colors={['#EDE9FE', '#F5F3FF']} style={styles.statIconWrap}>
                <Image source={ICONS.medical} style={{ width: 24, height: 24 }} resizeMode="contain" />
              </LinearGradient>
              <Text style={styles.statValue}>{vetStats.consultations}</Text>
              <Text style={styles.statLabel}>Consultas</Text>
            </View>
            <View style={styles.statCard}>
              <LinearGradient colors={['#EDE9FE', '#F5F3FF']} style={styles.statIconWrap}>
                <Image source={ICONS.expenses} style={{ width: 24, height: 24 }} resizeMode="contain" />
              </LinearGradient>
              <Text style={[styles.statValue, { fontSize: 13 }]}>{formatCurrency(vetStats.monthRevenue)}</Text>
              <Text style={styles.statLabel}>Mês</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.statCard}>
              <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.statIconWrap}>
                <Text style={styles.statEmoji}>🐾</Text>
              </LinearGradient>
              <Text style={styles.statValue}>{stats.pets}</Text>
              <Text style={styles.statLabel}>Pets</Text>
            </View>
            <View style={styles.statCard}>
              <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.statIconWrap}>
                <Text style={styles.statEmoji}>💉</Text>
              </LinearGradient>
              <Text style={styles.statValue}>{stats.vaccines}</Text>
              <Text style={styles.statLabel}>Vacinas</Text>
            </View>
            <View style={styles.statCard}>
              <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.statIconWrap}>
                <Image source={ICONS.expenses} style={{ width: 24, height: 24 }} resizeMode="contain" />
              </LinearGradient>
              <Text style={[styles.statValue, { fontSize: 13 }]}>{formatCurrency(stats.totalExpenses)}</Text>
              <Text style={styles.statLabel}>Total gasto</Text>
            </View>
          </>
        )}
      </View>

      {/* Seções */}
      <View style={styles.sections}>
        <Section title="Conta">
          <Row icon={ICONS.email}   label="Email" value={user?.email} />
          <Row icon={ICONS.profile} label="Nome"  value={profile.full_name || '—'} onPress={() => setEditingName(true)} />
        </Section>

        {/* Contato */}
        <Section title="Contato">
          {editingContact ? (
            <View style={styles.contactEdit}>
              <Text style={styles.contactEditLabel}>Telefone</Text>
              <TextInput
                style={styles.contactInput}
                value={phoneInput}
                onChangeText={v => { setPhoneInput(v); setContactError(''); }}
                placeholder="(11) 91234-5678"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
              <Text style={styles.contactEditLabel}>Endereço</Text>
              <TextInput
                style={styles.contactInput}
                value={addressInput}
                onChangeText={v => { setAddressInput(v); setContactError(''); }}
                placeholder="Rua, número, bairro..."
                placeholderTextColor="#9CA3AF"
              />

              {/* Feedback inline */}
              {contactError ? (
                <View style={styles.contactFeedbackError}>
                  <Text style={styles.contactFeedbackErrorText}>⚠ {contactError}</Text>
                </View>
              ) : null}
              {contactSaved ? (
                <View style={styles.contactFeedbackOk}>
                  <Text style={styles.contactFeedbackOkText}>✓ Salvo com sucesso!</Text>
                </View>
              ) : null}

              <View style={styles.contactEditBtns}>
                <TouchableOpacity style={styles.contactSaveBtn} onPress={saveContact} disabled={savingContact}>
                  {savingContact
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.contactSaveBtnText}>Salvar</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactCancelBtn} onPress={() => { setEditingContact(false); setContactError(''); }}>
                  <Text style={styles.contactCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Row icon={ICONS.profile} label="Telefone" value={profile.phone || 'Adicionar'} onPress={() => setEditingContact(true)} />
              <Row icon={ICONS.profile} label="Endereço" value={profile.address ? profile.address.slice(0, 28) + (profile.address.length > 28 ? '…' : '') : 'Adicionar'} onPress={() => setEditingContact(true)} />
            </>
          )}
        </Section>

        {/* Dados profissionais — só aparece para vets */}
        {isVet && (
          <Section title="Dados Profissionais">
            {editingVet ? (
              <View style={styles.contactEdit}>
                <Text style={styles.contactEditLabel}>Especialidade</Text>
                <TextInput
                  style={styles.contactInput}
                  value={vetInputs.specialty}
                  onChangeText={v => setVetInputs(p => ({ ...p, specialty: v }))}
                  placeholder="Ex: Clínico geral, Dermatologia"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.contactEditLabel}>Nome da clínica</Text>
                <TextInput
                  style={styles.contactInput}
                  value={vetInputs.clinic_name}
                  onChangeText={v => setVetInputs(p => ({ ...p, clinic_name: v }))}
                  placeholder="Nome da clínica ou consultório"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.contactEditLabel}>Endereço da clínica</Text>
                <TextInput
                  style={styles.contactInput}
                  value={vetInputs.clinic_address}
                  onChangeText={v => setVetInputs(p => ({ ...p, clinic_address: v }))}
                  placeholder="Rua, número, bairro, cidade"
                  placeholderTextColor="#9CA3AF"
                />
                <View style={styles.contactBtns}>
                  <TouchableOpacity style={styles.contactSaveBtn} onPress={saveVetData} disabled={savingVet}>
                    {savingVet
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.contactSaveBtnText}>Salvar</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.contactCancelBtn} onPress={() => { setEditingVet(false); setVetInputs(vetData); }}>
                    <Text style={styles.contactCancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <Row icon={ICONS.medical} label="Especialidade"   value={vetData.specialty    || 'Adicionar'} onPress={() => setEditingVet(true)} />
                <Row icon={ICONS.home}    label="Clínica"         value={vetData.clinic_name  ? vetData.clinic_name.slice(0,28) : 'Adicionar'}     onPress={() => setEditingVet(true)} />
                <Row icon={ICONS.home}    label="Endereço"        value={vetData.clinic_address ? vetData.clinic_address.slice(0,28) + (vetData.clinic_address.length > 28 ? '…' : '') : 'Adicionar'} onPress={() => setEditingVet(true)} />
              </>
            )}
          </Section>
        )}

        {/* Configurações da Clínica — só aparece para vets */}
        {isVet && (
          <Section title="Configurações da Clínica">
            {/* Chat com tutores */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Chat com tutores</Text>
                <Text style={styles.settingDesc}>Permite que tutores vinculados enviem mensagens</Text>
              </View>
              <Switch
                value={vetSettings.chat_enabled}
                onValueChange={v => toggleVetSetting('chat_enabled', v)}
                trackColor={{ true: '#0EA5E9', false: '#E2E8F0' }}
              />
            </View>

            {/* Agendamento online */}
            <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 8, paddingTop: 14 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Página de agendamento</Text>
                <Text style={styles.settingDesc}>Tutores externos podem solicitar consultas</Text>
              </View>
              <Switch
                value={vetSettings.booking_enabled}
                onValueChange={v => toggleVetSetting('booking_enabled', v)}
                trackColor={{ true: '#0EA5E9', false: '#E2E8F0' }}
              />
            </View>
            {vetSettings.booking_enabled && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.settingDesc}>Link da clínica: petcareplus.app/agendar/<Text style={{ color: '#0EA5E9', fontWeight: '700' }}>{vetSettings.booking_slug || '...'}</Text></Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TextInput
                    style={[styles.contactInput, { flex: 1 }]}
                    value={bookingSlugInput}
                    onChangeText={v => setBookingSlugInput(v.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="ex: clinica-pet-saude"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: '#0EA5E9', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' }}
                    onPress={saveBookingSlug} disabled={savingSettings}
                  >
                    {savingSettings ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Assinatura digital */}
            <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 8, paddingTop: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
              <Text style={styles.settingLabel}>Assinatura digital</Text>
              <Text style={styles.settingDesc}>Aparece no PDF das receitas geradas pelo app</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {vetSettings.signature_url ? (
                  <Image source={{ uri: vetSettings.signature_url }} style={{ width: 120, height: 50, borderRadius: 8, borderWidth: 1, borderColor: '#E0F2FE' }} resizeMode="contain" />
                ) : (
                  <View style={{ width: 120, height: 50, borderRadius: 8, borderWidth: 1.5, borderColor: '#BAE6FD', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>Sem assinatura</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={{ backgroundColor: '#EFF6FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#BAE6FD' }}
                  onPress={handleSignatureUpload} disabled={uploadingSignature}
                >
                  {uploadingSignature ? <ActivityIndicator color="#0EA5E9" size="small" /> : <Text style={{ color: '#0EA5E9', fontWeight: '700', fontSize: 13 }}>{vetSettings.signature_url ? 'Trocar' : 'Fazer upload'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </Section>
        )}

        <Section title="Plano">
          {isVet ? (
            /* Badge especial para veterinários */
            <View style={[styles.planBadge, { backgroundColor: '#F5F3FF', borderColor: '#C4B5FD', borderWidth: 1.5, borderRadius: 16, padding: 16 }]}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Text style={{ fontSize: 24 }}>🩺</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#6D28D9' }}>Plano Veterinário</Text>
                <Text style={{ fontSize: 12, color: '#7C3AED', marginTop: 2 }}>Acesso completo a todas as funcionalidades</Text>
              </View>
            </View>
          ) : (
          <TouchableOpacity style={styles.planCard} onPress={() => navigation.navigate('Plan')}>
            <View style={[styles.planBadge, isPremium ? styles.planBadgePremium : styles.planBadgeBasic]}>
              {isPremium
                ? <Image source={require('../../../assets/icon_crown.png')} style={styles.planBadgeCrown} resizeMode="contain" />
                : <Text style={styles.planBadgeIcon}>🐾</Text>}
              <View>
                <Text style={[styles.planBadgeLabel, isPremium ? { color: '#D97706' } : { color: '#64748B' }]}>
                  {isPremium ? 'Plano Premium' : 'Plano Básico'}
                </Text>
                <Text style={[styles.planBadgeSub, !isPremium && { color: '#D97706', fontWeight: '600' }]}>
                  {isPremium ? 'Todos os recursos ativos' : 'Acesse todas as funcionalidades para seus pets 🐾'}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 20, color: '#BAE6FD' }}>›</Text>
          </TouchableOpacity>
          )}
          {isPremium && !isVet && (
            <Row
              icon={ICONS.profile}
              label="Compartilhar acesso"
              value={`0/${maxViewers} convidados`}
              onPress={() => navigation.navigate('ManageViewers')}
            />
          )}
        </Section>

        <Section title="App">
          <Row icon={ICONS.fred} label="Fred — Assistente IA" value={isPremium ? 'Ativo' : 'Premium'} />
          <Row icon={ICONS.app}  label="Versão" value="1.0.0" />
        </Section>

        <Section title="Sessão">
          <Row icon={ICONS.logout} label="Sair da conta" onPress={handleSignOut} danger />
        </Section>
      </View>

      <Text style={styles.footer}>PetCare+ · Feito com 🐾</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    paddingTop: 36, paddingBottom: 32, paddingHorizontal: 24,
    alignItems: 'center', overflow: 'hidden',
  },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' },

  avatarWrap: { marginBottom: 14, position: 'relative' },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarPhoto: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarText: { fontSize: 34, fontWeight: '700', color: '#fff' },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarBadgeText: { fontSize: 13 },

  nameRow: { marginBottom: 6 },
  name: { fontSize: 22, fontWeight: '700', color: '#fff' },
  email: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, width: '100%' },
  nameInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16,
    color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  saveBtn: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  saveBtnText: { color: '#0EA5E9', fontWeight: '700', fontSize: 14 },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  cancelBtnText: { color: '#fff', fontSize: 16 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 20, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 14, alignItems: 'center',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#EFF6FF',
  },
  statIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },

  sections: { paddingHorizontal: 20 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8', marginBottom: 8,
    paddingHorizontal: 4, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#EFF6FF',
  },

  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  rowIcon: { width: 26, height: 26, marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 15, color: '#1E293B' },
  rowDanger: { color: '#EF4444' },
  rowValue: { fontSize: 13, color: '#94A3B8', maxWidth: 160, textAlign: 'right' },
  rowArrow: { fontSize: 20, color: '#BAE6FD', marginLeft: 8 },

  contactEdit: { padding: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  settingLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  settingDesc: { fontSize: 12, color: '#94A3B8', lineHeight: 16 },
  contactEditLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6, marginTop: 10 },
  contactInput: {
    backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, borderWidth: 1.5, borderColor: '#E0F2FE', color: '#1E293B',
  },
  contactFeedbackError: {
    backgroundColor: '#FFF1F2', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FECDD3', marginTop: 10,
  },
  contactFeedbackErrorText: { color: '#EF4444', fontSize: 13, lineHeight: 18 },
  contactFeedbackOk: {
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#BBF7D0', marginTop: 10,
  },
  contactFeedbackOkText: { color: '#16A34A', fontSize: 13, fontWeight: '700' },
  contactEditBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  contactSaveBtn: { flex: 1, backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  contactSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  contactCancelBtn: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  contactCancelBtnText: { color: '#64748B', fontWeight: '700', fontSize: 14 },

  footer: { textAlign: 'center', color: '#BAE6FD', fontSize: 12, marginTop: 12 },

  planCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  planBadgeBasic: {},
  planBadgePremium: {},
  planBadgeIcon: { fontSize: 26 },
  planBadgeCrown: { width: 30, height: 30 },
  planBadgeLabel: { fontSize: 15, fontWeight: '700' },
  planBadgeSub: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
});
