import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { registerPushToken } from '../utils/pushService';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser]                 = useState(null);
  const [isVet, setIsVet]               = useState(false);
  const [vetProfile, setVetProfile]     = useState(null);
  const [plan, setPlan]                 = useState('basic');
  const [viewerGrants, setViewerGrants] = useState([]);
  const [loading, setLoading]           = useState(true);

  const loadUserRole = async (userId) => {
    if (!userId) { setIsVet(false); setVetProfile(null); return; }
    const { data } = await supabase
      .from('vet_profiles')
      .select('id, full_name, crm, estado, specialty, clinic_name, status, validated_at, chat_enabled, booking_enabled, booking_slug, signature_url')
      .eq('id', userId)
      .maybeSingle();
    setIsVet(!!data);
    setVetProfile(data ?? null);
  };

  const loadPlanAndGrants = async (userId) => {
    if (!userId) { setPlan('basic'); setViewerGrants([]); return; }

    const [profileRes, grantsRes, vetRes] = await Promise.all([
      supabase.from('profiles').select('plan, plan_expires_at').eq('id', userId).single(),
      supabase.from('pet_viewers')
        .select('id, owner_id, status, profiles!owner_id(full_name)')
        .eq('viewer_id', userId)
        .neq('status', 'removed'),
      supabase.from('vet_profiles').select('id, status').eq('id', userId).maybeSingle(),
    ]);

    // Veterinário aprovado sempre tem plano 'vet' (acesso total)
    if (vetRes.data && vetRes.data.status === 'approved') {
      setPlan('vet');
    } else if (profileRes.data) {
      const p = profileRes.data.plan || 'basic';
      const expired = profileRes.data.plan_expires_at
        && new Date(profileRes.data.plan_expires_at + 'T23:59:59') < new Date();
      setPlan(expired ? 'basic' : p);
    }

    if (grantsRes.data) setViewerGrants(grantsRes.data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      Promise.all([
        loadUserRole(u?.id),
        loadPlanAndGrants(u?.id),
      ]).finally(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        supabase.from('profiles').upsert({ id: u.id }, { onConflict: 'id', ignoreDuplicates: true });
        loadUserRole(u.id);
        loadPlanAndGrants(u.id);
        registerPushToken(u.id);
      } else {
        setIsVet(false);
        setVetProfile(null);
        setPlan('basic');
        setViewerGrants([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const reloadVetProfile = async () => {
    if (user?.id) await loadUserRole(user.id);
  };

  const reloadPlan = async () => {
    if (user?.id) await loadPlanAndGrants(user.id);
  };

  const acceptViewerInvite = async (grantId) => {
    await supabase.from('pet_viewers').update({ status: 'active' }).eq('id', grantId);
    if (user?.id) await loadPlanAndGrants(user.id);
  };

  const declineViewerInvite = async (grantId) => {
    await supabase.from('pet_viewers').update({ status: 'removed' }).eq('id', grantId);
    if (user?.id) await loadPlanAndGrants(user.id);
  };

  const vetStatus      = isVet ? (vetProfile?.status ?? 'pending') : null;
  const isPremium      = plan === 'premium' || plan === 'vet' || isVet;
  const pendingInvites = viewerGrants.filter(g => g.status === 'pending');

  return (
    <AuthContext.Provider value={{
      user, isVet, vetProfile, vetStatus, loading,
      plan, isPremium, viewerGrants, pendingInvites,
      signIn, signUp, signOut,
      reloadVetProfile, reloadPlan, acceptViewerInvite, declineViewerInvite,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
