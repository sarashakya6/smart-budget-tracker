import { STORAGE_KEYS } from '../constants';

export const storage = {
  get: <T>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(key);
      if (item === null || item === 'undefined' || item === 'null') return fallback;
      return JSON.parse(item);
    } catch (e) {
      console.error(`Error reading ${key}`, e);
      return fallback;
    }
  },
  set: <T>(key: string, value: T): void => {
    try {
      if (value === undefined || value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.error(`Error writing ${key}`, e);
    }
  },
  remove: (key: string): void => {
    localStorage.removeItem(key);
  },
  clearAll: () => {
    try {
      // 1. Clear known specific keys first
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      
      // 2. Clear dynamic app and session keys
      const dynamicKeys = [
        'sb_active_wallet',
        'sb_wallet_roles',
        'sb_shared_wallets',
        'sb_ai_insight'
      ];
      dynamicKeys.forEach(key => localStorage.removeItem(key));
      
      // 3. Clear all keys with app prefix or supabase identifier
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb_') || key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn("Storage clear failed, falling back to localClear", e);
      localStorage.clear();
    }
  }
};