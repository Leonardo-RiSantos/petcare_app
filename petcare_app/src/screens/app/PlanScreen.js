import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../hooks/usePlan';
import { supabase } from '../../lib/supabase';

const ICON_CHECK   = require('../../../assets/icon_check.png');
const ICON_MEDICAL = require('../../../assets/icon_medical.png');
const ICON_MAP     = require('../../../assets/icon_map.png');
const ICON_FRED    = require('../../../assets/icon_fred.png');
const ICON_PROFILE = require('../../../assets/icon_profile.png');

const PLANS = [
  {
    id: 'basic',
    name: 'Básico',
    color: '#0EA5E9',
    gradientColors: ['#0284C7', '#0EA5E9'],
    monthlyPrice: 9.90,
    annualPrice: 99,
    annualMonthly: 8.25,
    features: [
      { label: '1 pet cadastrado', included: true },
      { label: 'Histórico de saúde e vacinas', included: true },
      { label: 'Controle de gastos', included: true },
      { label: 'Histórico de peso', included: true },
      { label: 'QR Code do pet', included: true },
      { label: 'Mapa Pet (pet-friendly)', included: false },
      { label: 'Pets ilimitados', included: false },
      { label: 'Vínculo com veterinário', included: false },
      { label: 'Assistente Fred (IA)', included: false },
      { label: 'Compartilhar acesso', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    color: '#D97706',
    gradientColors: ['#F59E0B', '#FBBF24'],
    monthlyPrice: 19.90,
    annualPrice: 199,
    annualMonthly: 16.58,
    popular: true,
    features: [
      { label: 'Pets ilimitados', included: true },
      { label: 'Histórico de saúde e vacinas', included: true },
      { label: 'Controle de gastos', included: true },
      { label: 'Histórico de peso', included: true },
      { label: 'QR Code do pet', included: true },
      { label: 'Mapa Pet (pet-friendly)', included: true },
      { label: 'Vínculo com veterinário', included: true },
      { label: 'Assistente Fred (IA)', included: true },
      { label: 'Compartilhar (até 2 pessoas)', included: true },
    ],
  },
  {
    id: 'vet',
    name: 'Veterinário',
    color: '#7C3AED',
    gradientColors: ['#7C3AED', '#A78BFA'],
    monthlyPrice: 39.90,
    annualPrice: 399,
    annualMonthly: 33.25,
    features: [
      { label: 'Conta verificada (Vet)', included: true },
      { label: 'Painel de pacientes', included: true },
      { label: 'Prontuários clínicos', included: true },
      { label: 'Prescrições e diagnósticos', included: true },
      { label: 'Agendamentos de consultas', included: true },
      { label: 'Comunicação com tutores', included: true },
      { label: 'Acesso via web (PC)', included: true },
      { label: 'Histórico completo do paciente', included: true },
    ],
  },
];

const CLINIC_PLANS = [
  {
    id: 'clinic_starter',
    name: 'Clínica Starter',
    color: '#059669',
    gradientColors: ['#059669', '#10B981'],
    monthlyPrice: 79.90,
    annualPrice: 799,
    annualMonthly: 66.58,
    features: [
      { label: 'Até 5 veterinários', included: true },
      { label: 'Prontuários compartilhados', included: true },
      { label: 'Catálogo de produtos', included: true },
      { label: 'PDV (ponto de venda)', included: true },
      { label: 'Controle de estoque', included: true },
      { label: 'Relatório de vendas', included: true },
      { label: 'Vets ilimitados', included: false },
      { label: 'Múltiplas clínicas', included: false },
    ],
  },
  {
    id: 'clinic_pro',
    name: 'Clínica Pro',
    color: '#D97706',
    gradientColors: ['#D97706', '#F59E0B'],
    monthlyPrice: 149.90,
    annualPrice: 1499,
    annualMonthly: 124.92,
    popular: true,
    features: [
      { label: 'Vets ilimitados', included: true },
      { label: 'Prontuários compartilhados', included: true },
      { label: 'PDV avançado', included: true },
      { label: 'Controle de estoque avançado', included: true },
      { label: 'Relatórios financeiros', included: true },
      { label: 'Múltiplas clínicas', included: true },
      { label: 'Painel administrativo', included: true },
      { label: 'Suporte prioritário', included: true },
    ],
  },
];

const PLAN_LABEL = { basic: 'BÁSICO', premium: 'PREMIUM', vet: 'VETERINÁRIO', clinic_starter: 'CLÍNICA STARTER', clinic_pro: 'CLÍNICA PRO' };

export default function PlanScreen() {
  const { plan, reloadPlan, user, isVet } = useAuth();
  const { isPremium } = usePlan();
  const [annual, setAnnual]     = useState(false);
  const [loading, setLoading]   = useState(null); // plan id sendo processado

  const currentPlanData = PLANS.find(p => p.id === plan) || PLANS[0];

  // Ao voltar para a tela (após fechar o browser do Stripe), atualiza o plano
  useFocusEffect(useCallback(() => {
    reloadPlan?.();
  }, []));

  const handleSubscribe = async (planId) => {
    if (loading) return;
    setLoading(planId);
    try {
      const billing = annual ? 'annual' : 'monthly';
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            planId,
            billing,
            userId: user.id,
            userEmail: user.email,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.url) {
        Alert.alert('Erro', data.error || 'Não foi possível iniciar o pagamento.');
        return;
      }

      // Abre a página de checkout do Stripe no browser
      await WebBrowser.openBrowserAsync(data.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      });

      // Ao fechar o browser, recarrega o plano
      await reloadPlan?.();

    } catch (err) {
      Alert.alert('Erro', 'Falha ao conectar com o servidor de pagamentos.');
      console.error('[PlanScreen] checkout error:', err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Hero */}
      <LinearGradient
        colors={currentPlanData.gradientColors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.bubble, { width: 160, height: 160, top: -50, right: -40 }]} />
        <View style={[styles.bubble, { width: 80, height: 80, bottom: -20, left: 20 }]} />
        <Text style={styles.heroTitle}>{currentPlanData.name}</Text>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>PLANO ATUAL</Text>
        </View>
        <Text style={styles.heroSub}>
          {plan === 'premium'
            ? 'Você tem acesso a todos os recursos do PetCare+'
            : plan === 'vet'
            ? 'Acesso completo ao painel veterinário'
            : 'Faça upgrade e desbloqueie tudo para seus pets'}
        </Text>
      </LinearGradient>

      {/* Toggle mensal / anual */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Mensal</Text>
        <TouchableOpacity
          style={[styles.toggleTrack, annual && styles.toggleTrackActive]}
          onPress={() => setAnnual(v => !v)}
          activeOpacity={0.85}
        >
          <View style={[styles.toggleThumb, annual && styles.toggleThumbActive]} />
        </TouchableOpacity>
        <View style={styles.toggleAnnualLabel}>
          <Text style={styles.toggleLabel}>Anual</Text>
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>2 meses grátis</Text>
          </View>
        </View>
      </View>

      {/* Cards de plano */}
      {PLANS.map(p => {
        const isCurrentPlan = p.id === plan;
        const price = annual ? p.annualMonthly : p.monthlyPrice;
        const billedLabel = annual
          ? `R$ ${p.annualPrice}/ano · cobrado anualmente`
          : 'cobrado mensalmente';

        return (
          <View key={p.id} style={[styles.planCard, isCurrentPlan && { borderColor: p.color, borderWidth: 2 }]}>

            {/* Badge popular */}
            {p.popular && !isCurrentPlan && (
              <LinearGradient
                colors={['#F59E0B', '#FBBF24']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.popularBadge}
              >
                <Text style={styles.popularBadgeText}>MAIS POPULAR</Text>
              </LinearGradient>
            )}
            {isCurrentPlan && (
              <View style={[styles.popularBadge, { backgroundColor: p.color }]}>
                <Text style={styles.popularBadgeText}>SEU PLANO ATUAL</Text>
              </View>
            )}

            {/* Cabeçalho do card */}
            <View style={styles.cardHeader}>
              <Text style={[styles.cardPlanName, { color: p.color }]}>{p.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.pricePrefix}>R$</Text>
                <Text style={styles.priceValue}>
                  {price.toFixed(2).replace('.', ',')}
                </Text>
                <Text style={styles.priceSuffix}>/mês</Text>
              </View>
              <Text style={styles.billedLabel}>{billedLabel}</Text>
            </View>

            <View style={styles.cardDivider} />

            {/* Features */}
            <View style={styles.featuresList}>
              {p.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={[
                    styles.featureCheckWrap,
                    f.included ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#F1F5F9' },
                  ]}>
                    {f.included
                      ? <Image source={ICON_CHECK} style={styles.checkIcon} resizeMode="contain" />
                      : <Text style={styles.featureX}>—</Text>}
                  </View>
                  <Text style={[styles.featureText, !f.included && styles.featureTextMuted]}>
                    {f.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            {!isCurrentPlan && (
              <View style={styles.ctaWrap}>
                <TouchableOpacity
                  onPress={() => handleSubscribe(p.id)}
                  disabled={!!loading}
                  activeOpacity={0.82}
                >
                  <LinearGradient
                    colors={p.gradientColors}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.ctaBtn}
                  >
                    {loading === p.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.ctaBtnText}>Assinar agora</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

          </View>
        );
      })}

      {/* Planos Clínica — visível apenas para vets */}
      {isVet && (
        <>
          <View style={styles.clinicSectionHeader}>
            <LinearGradient
              colors={['#059669', '#10B981']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.clinicSectionBadge}
            >
              <Text style={styles.clinicSectionBadgeText}>🏥  PLANOS CLÍNICA</Text>
            </LinearGradient>
            <Text style={styles.clinicSectionSub}>
              Gerencie equipe, estoque e vendas da sua clínica
            </Text>
          </View>

          {CLINIC_PLANS.map(p => {
            const isCurrentPlan = p.id === plan;
            const price = annual ? p.annualMonthly : p.monthlyPrice;
            const billedLabel = annual
              ? `R$ ${p.annualPrice}/ano · cobrado anualmente`
              : 'cobrado mensalmente';

            return (
              <View key={p.id} style={[styles.planCard, isCurrentPlan && { borderColor: p.color, borderWidth: 2 }]}>
                {p.popular && !isCurrentPlan && (
                  <LinearGradient
                    colors={['#D97706', '#F59E0B']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.popularBadge}
                  >
                    <Text style={styles.popularBadgeText}>MAIS COMPLETO</Text>
                  </LinearGradient>
                )}
                {isCurrentPlan && (
                  <View style={[styles.popularBadge, { backgroundColor: p.color }]}>
                    <Text style={styles.popularBadgeText}>SEU PLANO ATUAL</Text>
                  </View>
                )}

                <View style={styles.cardHeader}>
                  <Text style={[styles.cardPlanName, { color: p.color }]}>{p.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.pricePrefix}>R$</Text>
                    <Text style={styles.priceValue}>
                      {price.toFixed(2).replace('.', ',')}
                    </Text>
                    <Text style={styles.priceSuffix}>/mês</Text>
                  </View>
                  <Text style={styles.billedLabel}>{billedLabel}</Text>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.featuresList}>
                  {p.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <View style={[
                        styles.featureCheckWrap,
                        f.included ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#F1F5F9' },
                      ]}>
                        {f.included
                          ? <Image source={ICON_CHECK} style={styles.checkIcon} resizeMode="contain" />
                          : <Text style={styles.featureX}>—</Text>}
                      </View>
                      <Text style={[styles.featureText, !f.included && styles.featureTextMuted]}>
                        {f.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {!isCurrentPlan && (
                  <View style={styles.ctaWrap}>
                    <TouchableOpacity
                      onPress={() => handleSubscribe(p.id)}
                      disabled={!!loading}
                      activeOpacity={0.82}
                    >
                      <LinearGradient
                        colors={p.gradientColors}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.ctaBtn}
                      >
                        {loading === p.id
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={styles.ctaBtnText}>Assinar agora</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}

      {/* Rodapé informativo */}
      <View style={styles.footerCard}>
        <Text style={styles.footerText}>
          Pagamento seguro via Stripe · Cancele quando quiser
        </Text>
        <Text style={styles.footerEmail}>Dúvidas: suporte@petcareplus.app</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  content: { paddingBottom: 50 },

  hero: {
    paddingTop: 36, paddingBottom: 36, paddingHorizontal: 24,
    alignItems: 'center', overflow: 'hidden',
  },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroTitle: { fontSize: 30, fontWeight: '900', color: '#fff', marginBottom: 8 },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 4, marginBottom: 10,
  },
  heroBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1.5 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.88)', textAlign: 'center', lineHeight: 21 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, marginTop: 24, marginBottom: 8,
  },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: '#475569' },
  toggleTrack: {
    width: 48, height: 28, borderRadius: 14, backgroundColor: '#CBD5E1',
    justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleTrackActive: { backgroundColor: '#0EA5E9' },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  toggleThumbActive: { transform: [{ translateX: 20 }] },
  toggleAnnualLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  saveBadgeText: { fontSize: 10, fontWeight: '800', color: '#16A34A' },

  planCard: {
    marginHorizontal: 20, marginTop: 16, backgroundColor: '#fff', borderRadius: 24,
    overflow: 'hidden', borderWidth: 1.5, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },

  popularBadge: {
    alignSelf: 'flex-start', borderRadius: 0,
    paddingHorizontal: 16, paddingVertical: 6,
    borderBottomRightRadius: 14,
  },
  popularBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1.2 },

  cardHeader: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 16 },
  cardPlanName: { fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginBottom: 4 },
  pricePrefix: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  priceValue: { fontSize: 40, fontWeight: '900', color: '#1E293B', lineHeight: 46 },
  priceSuffix: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 8 },
  billedLabel: { fontSize: 12, color: '#94A3B8' },

  cardDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 22 },

  featuresList: { paddingHorizontal: 22, paddingVertical: 16, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureCheckWrap: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  checkIcon: { width: 11, height: 11 },
  featureX: { fontSize: 12, color: '#94A3B8', fontWeight: '700' },
  featureText: { fontSize: 13, color: '#374151', flex: 1 },
  featureTextMuted: { color: '#94A3B8' },

  ctaWrap: { paddingHorizontal: 22, paddingBottom: 22, paddingTop: 6 },
  ctaBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  footerCard: {
    marginHorizontal: 20, marginTop: 20, marginBottom: 10,
    alignItems: 'center', gap: 6,
  },
  footerText:  { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  footerEmail: { fontSize: 12, color: '#0EA5E9', fontWeight: '700' },

  clinicSectionHeader: {
    marginHorizontal: 20, marginTop: 28, marginBottom: 4, alignItems: 'flex-start', gap: 8,
  },
  clinicSectionBadge: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7,
  },
  clinicSectionBadgeText: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 1.2 },
  clinicSectionSub: { fontSize: 13, color: '#64748B', paddingHorizontal: 4 },
});
