import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const LOGO = require('../../../assets/logo_background.png');

export default function ClinicDashboardScreen({ navigation, route }) {
  const { clinicId } = route.params || {};
  const { user } = useAuth();

  const [clinic,       setClinic]       = useState(null);
  const [myRole,       setMyRole]       = useState(null);
  const [stats,        setStats]        = useState(null);
  const [lowStock,     setLowStock]     = useState([]);
  const [recentSales,  setRecentSales]  = useState([]);
  const [openOrders,   setOpenOrders]   = useState([]);
  const [loading,      setLoading]      = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Clínica
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', clinicId)
        .single();
      setClinic(clinicData);

      // Meu cargo
      const { data: memberData } = await supabase
        .from('clinic_members')
        .select('role')
        .eq('clinic_id', clinicId)
        .eq('user_id', user.id)
        .single();
      setMyRole(memberData?.role || null);

      // Totais do mês
      const startOfMonth = new Date();
      startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);

      const [membersRes, salesRes, productsRes, openOrdersRes] = await Promise.all([
        supabase.from('clinic_members').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('status', 'active'),
        supabase.from('clinic_sales').select('total').eq('clinic_id', clinicId).eq('status', 'completed').gte('created_at', startOfMonth.toISOString()),
        supabase.from('clinic_products').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('active', true),
        supabase.from('clinic_service_orders').select('id, pet_name, owner_name, total, created_at, vet_profiles!vet_id(full_name)').eq('clinic_id', clinicId).eq('status', 'open').order('created_at', { ascending: false }).limit(10),
      ]);

      const monthRevenue = (salesRes.data || []).reduce((s, r) => s + Number(r.total), 0);
      setStats({
        members:    membersRes.count || 0,
        revenue:    monthRevenue,
        products:   productsRes.count || 0,
        sales:      salesRes.data?.length || 0,
        openOrders: openOrdersRes.data?.length || 0,
      });
      setOpenOrders(openOrdersRes.data || []);

      // Estoque baixo
      const { data: lowStockData } = await supabase
        .from('clinic_products')
        .select('id, name, stock_qty, stock_min, unit')
        .eq('clinic_id', clinicId)
        .eq('active', true)
        .gt('stock_min', 0)
        .filter('stock_qty', 'lte', 'stock_min')
        .order('stock_qty')
        .limit(5);
      setLowStock(lowStockData || []);

      // Vendas recentes
      const { data: recentData } = await supabase
        .from('clinic_sales')
        .select('id, total, payment_method, customer_name, patient_name, created_at')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentSales(recentData || []);

    } catch (err) {
      console.error('[ClinicDashboard]', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchAll(); }, [clinicId]));

  const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin';
  const canSell        = ['owner','admin','seller','receptionist'].includes(myRole);
  const isVetRole      = myRole === 'vet' || isOwnerOrAdmin;
  const canReception   = ['owner','admin','seller','receptionist'].includes(myRole);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{clinic?.name || 'Clínica'}</Text>
          <Text style={styles.headerSub}>
            {myRole === 'owner' ? 'Proprietário' :
             myRole === 'admin' ? 'Administrador' :
             myRole === 'vet' ? 'Veterinário' :
             myRole === 'receptionist' ? 'Recepcionista' : 'Vendedor'}
          </Text>
        </View>
        <Image source={LOGO} style={{ width: 36, height: 36 }} resizeMode="contain" />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Ordens abertas — destaque se houver */}
        {openOrders.length > 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('ClinicReception', { clinicId })}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#D97706', '#F59E0B']} style={styles.alertBanner}>
              <Text style={styles.alertBannerIcon}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertBannerTitle}>
                  {openOrders.length} atendimento{openOrders.length > 1 ? 's' : ''} aguardando pagamento
                </Text>
                <Text style={styles.alertBannerSub}>
                  {openOrders.map(o => o.pet_name).slice(0, 3).join(', ')}
                  {openOrders.length > 3 ? '...' : ''}
                </Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 20 }}>›</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Stats do mês */}
        <Text style={styles.sectionTitle}>Este mês</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#EDE9FE' }]}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={[styles.statValue, { color: '#7C3AED', fontSize: 14 }]}>
              R$ {(stats?.revenue || 0).toFixed(2).replace('.', ',')}
            </Text>
            <Text style={styles.statLabel}>Receita</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#DCFCE7' }]}>
            <Text style={styles.statIcon}>🛒</Text>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{stats?.sales || 0}</Text>
            <Text style={styles.statLabel}>Vendas</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: stats?.openOrders > 0 ? '#FEF3C7' : '#E0F2FE' }]}>
            <Text style={styles.statIcon}>📋</Text>
            <Text style={[styles.statValue, { color: stats?.openOrders > 0 ? '#D97706' : '#0284C7' }]}>
              {stats?.openOrders || 0}
            </Text>
            <Text style={styles.statLabel}>Em aberto</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.statIcon}>📦</Text>
            <Text style={[styles.statValue, { color: '#D97706' }]}>{stats?.products || 0}</Text>
            <Text style={styles.statLabel}>Produtos</Text>
          </View>
        </View>

        {/* Atalhos rápidos */}
        <Text style={styles.sectionTitle}>Acesso rápido</Text>
        <View style={styles.actionsRow}>
          {/* Vet: criar atendimento */}
          {isVetRole && (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('ClinicOrder', { clinicId })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.actionGradient}>
                <Text style={styles.actionIcon}>🩺</Text>
                <Text style={styles.actionLabel}>Atendimento</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {/* Recepção: fechar pagamentos */}
          {canReception && (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('ClinicReception', { clinicId })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#059669', '#10B981']} style={styles.actionGradient}>
                <Text style={styles.actionIcon}>💳</Text>
                <Text style={styles.actionLabel}>Recepção</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {/* Venda direta (sem atendimento prévio) */}
          {canSell && (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('ClinicSale', { clinicId })}
              activeOpacity={0.8}
            >
              <View style={[styles.actionGradient, { backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#DDD6FE' }]}>
                <Text style={styles.actionIcon}>🛒</Text>
                <Text style={[styles.actionLabel, { color: '#7C3AED' }]}>Venda direta</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('ClinicProducts', { clinicId, canEdit: isOwnerOrAdmin })}
            activeOpacity={0.8}
          >
            <View style={[styles.actionGradient, { backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#DDD6FE' }]}>
              <Text style={styles.actionIcon}>📦</Text>
              <Text style={[styles.actionLabel, { color: '#7C3AED' }]}>Estoque</Text>
            </View>
          </TouchableOpacity>
          {isOwnerOrAdmin && (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('ClinicTeam', { clinicId })}
              activeOpacity={0.8}
            >
              <View style={[styles.actionGradient, { backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#DDD6FE' }]}>
                <Text style={styles.actionIcon}>👥</Text>
                <Text style={[styles.actionLabel, { color: '#7C3AED' }]}>Equipe</Text>
              </View>
            </TouchableOpacity>
          )}
          {isOwnerOrAdmin && (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('ClinicSetup', { isEdit: true, clinic })}
              activeOpacity={0.8}
            >
              <View style={[styles.actionGradient, { backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#DDD6FE' }]}>
                <Text style={styles.actionIcon}>⚙️</Text>
                <Text style={[styles.actionLabel, { color: '#7C3AED' }]}>Configurar</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Alerta estoque baixo */}
        {lowStock.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>⚠️ Estoque baixo</Text>
            {lowStock.map(p => (
              <View key={p.id} style={styles.alertCard}>
                <Text style={styles.alertProductName}>{p.name}</Text>
                <Text style={styles.alertStock}>
                  {p.stock_qty} {p.unit} · mínimo: {p.stock_min} {p.unit}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Vendas recentes */}
        {recentSales.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Vendas recentes</Text>
            {recentSales.map(sale => (
              <View key={sale.id} style={styles.saleCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.saleName}>
                    {sale.customer_name || sale.patient_name || 'Venda avulsa'}
                  </Text>
                  <Text style={styles.saleDate}>
                    {new Date(sale.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {sale.payment_method ? ` · ${sale.payment_method.replace('_',' ')}` : ''}
                  </Text>
                </View>
                <Text style={styles.saleTotal}>R$ {Number(sale.total).toFixed(2).replace('.', ',')}</Text>
              </View>
            ))}
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 52 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  content: { padding: 16, paddingBottom: 40 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.8, marginBottom: 10, marginTop: 16 },

  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:   { width: '47%', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  statIcon:   { fontSize: 26 },
  statValue:  { fontSize: 20, fontWeight: '900' },
  statLabel:  { fontSize: 11, color: '#64748B', fontWeight: '700' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: '47%', borderRadius: 16, overflow: 'hidden' },
  actionGradient: { padding: 16, borderRadius: 16, alignItems: 'center', gap: 8 },
  actionIcon:     { fontSize: 28 },
  actionLabel:    { fontSize: 13, fontWeight: '800', color: '#fff' },

  alertCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  alertProductName: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  alertStock:       { fontSize: 11, color: '#B45309' },

  alertBanner: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14,
    marginBottom: 16, gap: 10,
  },
  alertBannerIcon:  { fontSize: 24 },
  alertBannerTitle: { fontSize: 14, fontWeight: '900', color: '#fff' },
  alertBannerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  saleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#EDE9FE',
  },
  saleName:  { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  saleDate:  { fontSize: 11, color: '#94A3B8', marginTop: 2, textTransform: 'capitalize' },
  saleTotal: { fontSize: 15, fontWeight: '900', color: '#7C3AED' },
});
