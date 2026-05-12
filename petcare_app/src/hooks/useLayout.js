import { useWindowDimensions } from 'react-native';

/**
 * Retorna informações do layout atual.
 * Breakpoints:
 *   mobile  < 600px
 *   tablet  600px – 1023px
 *   desktop ≥ 1024px
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet  = width >= 600 && width < 1024;
  const isMobile  = width < 600;

  return { width, height, isDesktop, isTablet, isMobile };
}
