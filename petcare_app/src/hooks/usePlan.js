import { useAuth } from '../context/AuthContext';

export function usePlan() {
  const { plan, isVet } = useAuth();
  // Veterinários têm acesso completo a todas as funcionalidades
  const isFullAccess = isVet || plan === 'premium' || plan === 'vet';

  return {
    plan: isVet ? 'vet' : plan,
    isPremium: isFullAccess,
    canAddPet:    (currentCount) => isFullAccess || currentCount < 1,
    canUseMaps:   isFullAccess,
    canUseVets:   isFullAccess,
    canUseFred:   isFullAccess,
    canAddViewer: isFullAccess,
    maxViewers:   isFullAccess ? 5 : 0,
  };
}
