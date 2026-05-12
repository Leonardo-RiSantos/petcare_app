/**
 * Logger seguro — emite logs APENAS em desenvolvimento.
 * Em produção (builds Expo/web com __DEV__ = false), é um no-op.
 * Nunca use console.log/console.error direto em código de produção.
 */

/* global __DEV__ */
const dev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const logger = {
  info:  (...args) => { if (dev) console.log('[PetCare]',  ...args); },
  warn:  (...args) => { if (dev) console.warn('[PetCare]', ...args); },
  error: (...args) => { if (dev) console.error('[PetCare]',...args); },
};
