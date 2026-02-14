
import { STORAGE_KEYS } from '../constants';

export const storage = {
  get: <T>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(key);
      if (item === null || item === 'undefined') return fallback;
      return JSON.parse(item);
    } catch (e) {
      console.error(`Error reading ${key}`, e);
      return fallback;
    }
  },
  set: <T>(key: string, value: T): void => {
    try {
      if (value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.error(`Error writing ${key}`, e);
    }
  },
  clearAll: () => {
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.ACCOUNTS);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.BUDGET);
    localStorage.removeItem(STORAGE_KEYS.CATEGORY_BUDGETS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_TRANSLATIONS);
  }
};
