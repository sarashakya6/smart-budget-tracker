
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Account, Category, Transaction, AppState, AppSettings, CategoryBudget, SyncState, UserProfile, Notification, Wallet } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_CATEGORIES, STORAGE_KEYS, DEFAULT_SETTINGS, TRANSLATIONS, MOCK_ONLINE_CURRENCIES } from '../constants';
import { storage } from '../services/storage';
import { cloudDrive } from '../services/cloudDrive';
import { supabase } from '../services/supabaseClient';
import { GoogleGenAI } from "@google/genai";

interface AppContextType extends AppState {
  addTransaction: (data: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (data: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<boolean>;
  importTransactions: (txs: Transaction[]) => Promise<void>;
  addAccount: (a: Omit<Account, 'id'>) => Promise<void>;
  updateAccountName: (id: string, name: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addCategory: (c: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (c: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateBudget: (amount: number) => void;
  updateCategoryBudget: (id: string, amount: number) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  resetPreferences: () => void;
  logout: () => void;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  backupUserData: (customData?: any) => Promise<{ skipped: boolean; timestamp?: string }>;
  restoreBackup: (strategy: 'merge' | 'replace' | 'skip') => Promise<boolean>;
  availableLanguages: string[];
  installLanguage: (code: string, dict: Record<string, string>) => void;
  uninstallLanguage: (code: string) => void;
  availableCurrencies: string[];
  installCurrency: (code: string) => void;
  uninstallCurrency: (code: string) => void;
  updateUserProfilePhoto: (url: string) => void;
  t: (key: string) => string;
  formatPrice: (amount: number) => string;
  getAccountBalance: (id: string) => number;
  isActionSheetOpen: boolean;
  setIsActionSheetOpen: (v: boolean) => void;
  refreshAIInsights: (force?: boolean) => Promise<void>;
  isAIAnalysing: boolean;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  
  // Wallet Methods
  switchWallet: (walletId: string | null) => Promise<void>;
  createWallet: (name: string, currency: string) => Promise<void>;
  refreshWallets: () => Promise<void>;
  deleteWallet: (walletId: string) => Promise<void>;

  // Lifecycle
  isResetting: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const safeUUID = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch(e) {}
  
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => storage.get(STORAGE_KEYS.TRANSACTIONS, []));
  const [accounts, setAccounts] = useState<Account[]>(() => storage.get(STORAGE_KEYS.ACCOUNTS, INITIAL_ACCOUNTS));
  const [categories, setCategories] = useState<Category[]>(() => storage.get(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES));
  const [budget, setBudget] = useState<number>(() => storage.get(STORAGE_KEYS.BUDGET, 0));
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>(() => storage.get(STORAGE_KEYS.CATEGORY_BUDGETS, []));
  const [settings, setSettings] = useState<AppSettings>(() => {
    const s = storage.get(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...s };
  });
  const [customTranslations, setCustomTranslations] = useState<Record<string, Record<string, string>>>(() => storage.get(STORAGE_KEYS.CUSTOM_TRANSLATIONS, {}));
  const [aiInsight, setAiInsight] = useState<string | undefined>(() => storage.get('sb_ai_insight', undefined));
  const [pendingDeletes, setPendingDeletes] = useState<string[]>(() => storage.get(STORAGE_KEYS.PENDING_DELETES, []));
  const [wallets, setWallets] = useState<Wallet[]>(() => storage.get(STORAGE_KEYS.WALLETS_LIST, []));
  
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isAIAnalysing, setIsAIAnalysing] = useState(false);
  
  const isResetting = false; 

  const [syncState, setSyncState] = useState<SyncState>({ 
    isLoggedIn: false, user: null, 
    lastSync: storage.get(STORAGE_KEYS.LAST_SYNC, null), 
    backupSize: null, pendingRestoreAvailable: false, 
    isOnline: navigator.onLine, pendingActionsCount: 0, isSyncing: false, isRealtimeConnected: false,
    unsyncedChanges: storage.get(STORAGE_KEYS.UNSYNCED_CHANGES, false),
    activeWalletId: storage.get(STORAGE_KEYS.ACTIVE_WALLET_ID, null)
  });
  const [notification, setNotification] = useState<Notification | null>(null);

  const sessionVersion = useRef(0);
  const isBackingUpRef = useRef(false);
  const isLoggingOutRef = useRef(false);

  // Persistence Effects
  useEffect(() => { storage.set(STORAGE_KEYS.TRANSACTIONS, transactions); }, [transactions]);
  useEffect(() => { storage.set(STORAGE_KEYS.ACCOUNTS, accounts); }, [accounts]);
  useEffect(() => { storage.set(STORAGE_KEYS.CATEGORIES, categories); }, [categories]);
  useEffect(() => { storage.set(STORAGE_KEYS.BUDGET, budget); }, [budget]);
  useEffect(() => { storage.set(STORAGE_KEYS.CATEGORY_BUDGETS, categoryBudgets); }, [categoryBudgets]);
  useEffect(() => { storage.set(STORAGE_KEYS.SETTINGS, settings); }, [settings]);
  useEffect(() => { storage.set(STORAGE_KEYS.CUSTOM_TRANSLATIONS, customTranslations); }, [customTranslations]);
  useEffect(() => { storage.set('sb_ai_insight', aiInsight); }, [aiInsight]);
  useEffect(() => { storage.set(STORAGE_KEYS.PENDING_DELETES, pendingDeletes); }, [pendingDeletes]);
  useEffect(() => { storage.set(STORAGE_KEYS.WALLETS_LIST, wallets); }, [wallets]);
  useEffect(() => { storage.set(STORAGE_KEYS.ACTIVE_WALLET_ID, syncState.activeWalletId); }, [syncState.activeWalletId]);
  
  useEffect(() => { 
    storage.set(STORAGE_KEYS.UNSYNCED_CHANGES, syncState.unsyncedChanges); 
  }, [syncState.unsyncedChanges]);

  // IMPORTANT: Persist Last Sync Time to avoid loops
  useEffect(() => { 
    storage.set(STORAGE_KEYS.LAST_SYNC, syncState.lastSync); 
  }, [syncState.lastSync]);

  // Network Status
  useEffect(() => {
    const handleOnline = () => setSyncState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setSyncState(prev => ({ ...prev, isOnline: false, isRealtimeConnected: false }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setNotification({ message, type, id });
    setTimeout(() => {
      setNotification(prev => prev?.id === id ? null : prev);
    }, 5000); // Extended duration for better visibility
  }, []);

  const markAsDirty = useCallback(() => {
    setSyncState(prev => {
      if (!prev.unsyncedChanges) {
        return { ...prev, unsyncedChanges: true };
      }
      return prev;
    });
  }, []);

  // --- REALTIME LISTENER ---
  useEffect(() => {
    if (!syncState.user || !syncState.isLoggedIn || settings.enableRealtime === false || isLoggingOutRef.current) {
       setSyncState(prev => ({ ...prev, isRealtimeConnected: false }));
       return;
    }

    let channel: any;

    if (syncState.activeWalletId) {
       channel = supabase.channel(`wallet-${syncState.activeWalletId}`)
         .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_data', filter: `wallet_id=eq.${syncState.activeWalletId}` },
           (payload) => {
             const newRow = payload.new as any;
             if (newRow && newRow.updated_by !== syncState.user?.id) {
                setSyncState(prev => ({ ...prev, pendingRestoreAvailable: true, syncStatusMessage: 'New wallet data' }));
                showNotification("Shared wallet updated", "info");
             }
           }
         ).subscribe((status: any) => {
            if (status === 'SUBSCRIBED') setSyncState(prev => ({ ...prev, isRealtimeConnected: true }));
         });
    } else {
       channel = supabase.channel('db-backups-sync')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'backups', filter: `user_id=eq.${syncState.user.id}` },
           (payload) => {
             const newRow = payload.new as any;
             const remoteTime = new Date(newRow.updated_at).getTime();
             const localTime = syncState.lastSync ? new Date(syncState.lastSync).getTime() : 0;
             // Check if remote is significantly newer (2s buffer)
             if (remoteTime > localTime + 2000) {
                 // MODIFIED: Only show notification, do NOT pop up modal automatically for background syncs
                 showNotification('New data received from cloud', 'info');
             }
           }
         ).subscribe((status: any) => {
            if (status === 'SUBSCRIBED') setSyncState(prev => ({ ...prev, isRealtimeConnected: true }));
         });
    }

    return () => {
      if(channel) supabase.removeChannel(channel);
      setSyncState(prev => ({ ...prev, isRealtimeConnected: false }));
    };
  }, [syncState.user?.id, syncState.isLoggedIn, settings.enableRealtime, syncState.lastSync, syncState.activeWalletId, showNotification]);

  // --- WALLET SWITCHING ---
  const saveCurrentContextToStorage = (walletId: string | null) => {
      const data = { transactions, accounts, categories, budget, category_budgets: categoryBudgets, settings };
      const key = walletId ? `sb_wallet_${walletId}_data` : `sb_personal_data`;
      storage.set(key, data);
  };

  const loadContextFromStorage = (walletId: string | null) => {
      const key = walletId ? `sb_wallet_${walletId}_data` : `sb_personal_data`;
      const data = storage.get(key, null);
      
      if (data) {
          setTransactions(data.transactions || []);
          setAccounts(data.accounts || INITIAL_ACCOUNTS);
          setCategories(data.categories || INITIAL_CATEGORIES);
          setBudget(data.budget || 0);
          setCategoryBudgets(data.category_budgets || []);
          setSettings(prev => ({ ...prev, ...data.settings }));
      } else if (walletId) {
          setTransactions([]);
          setAccounts(INITIAL_ACCOUNTS);
          setCategories(INITIAL_CATEGORIES);
          setBudget(0);
          setCategoryBudgets([]);
          setSettings(DEFAULT_SETTINGS);
      } else {
          setTransactions(storage.get(STORAGE_KEYS.TRANSACTIONS, []));
          setAccounts(storage.get(STORAGE_KEYS.ACCOUNTS, INITIAL_ACCOUNTS));
          setCategories(storage.get(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES));
          setBudget(storage.get(STORAGE_KEYS.BUDGET, 0));
          setCategoryBudgets(storage.get(STORAGE_KEYS.CATEGORY_BUDGETS, []));
          const s = storage.get(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
          setSettings({ ...DEFAULT_SETTINGS, ...s });
      }
  };

  const switchWallet = async (walletId: string | null) => {
      saveCurrentContextToStorage(syncState.activeWalletId);
      setSyncState(prev => ({ ...prev, activeWalletId: walletId, unsyncedChanges: false }));
      loadContextFromStorage(walletId);

      if (walletId && syncState.isOnline) {
          try {
             const remoteData = await cloudDrive.getWalletData(walletId);
             if (remoteData) {
                 setTransactions(remoteData.transactions || []);
                 setAccounts(remoteData.accounts || INITIAL_ACCOUNTS);
                 setCategories(remoteData.categories || INITIAL_CATEGORIES);
                 setBudget(remoteData.budget || 0);
                 setCategoryBudgets(remoteData.category_budgets || []);
                 setSettings(prev => ({ ...prev, ...remoteData.settings }));
             }
          } catch(e) { console.error("Wallet fetch failed", e); }
      } else if (!walletId && syncState.isOnline && syncState.user) {
          // Switching back to Personal - check for backup but only if needed
      }
      showNotification(walletId ? "Switched to Shared Wallet" : "Switched to Personal Space");
  };

  const createWallet = async (name: string, currency: string) => {
      if (!syncState.user) return;
      try {
          const newWallet = await cloudDrive.createWallet(syncState.user.id, name, currency);
          setWallets(prev => [...prev, newWallet]);
          await switchWallet(newWallet.id);
      } catch (e: any) {
          showNotification(e.message, "error");
      }
  };

  const refreshWallets = async () => {
      if (!syncState.user) return;
      try {
          const list = await cloudDrive.getMyWallets(syncState.user.id);
          setWallets(list);
      } catch(e) {}
  };

  const deleteWallet = async (walletId: string) => {
      try {
          await cloudDrive.deleteWallet(walletId);
          setWallets(prev => prev.filter(w => w.id !== walletId));
          if (syncState.activeWalletId === walletId) await switchWallet(null);
          showNotification("Wallet deleted successfully");
      } catch (e: any) {
          showNotification(e.message, "error");
      }
  };

  // --- CRUD OPERATIONS ---
  const addTransaction = async (data: Omit<Transaction, 'id'>) => {
    const nextTx: Transaction = { ...data, id: safeUUID(), isPendingSync: true };
    setTransactions(prev => [nextTx, ...prev]);
    markAsDirty();
  };

  const importTransactions = async (newTxs: Transaction[]) => {
    setTransactions(prev => {
        const existingSigs = new Set(prev.map(t => `${t.date ? t.date.split('T')[0] : ''}-${t.amount}-${t.type}-${(t.note || '').trim()}`));
        const uniqueNew = newTxs.filter(t => {
            const sig = `${t.date ? t.date.split('T')[0] : ''}-${t.amount}-${t.type}-${(t.note || '').trim()}`;
            return !existingSigs.has(sig);
        });
        const safeUniqueNew = uniqueNew.map(t => ({ ...t, id: t.id || safeUUID(), isPendingSync: true }));
        return [...prev, ...safeUniqueNew];
    });
    markAsDirty();
  };

  const updateTransaction = async (data: Transaction) => {
    setTransactions(prev => prev.map(item => item.id === data.id ? { ...data, isPendingSync: true } : item));
    markAsDirty();
  };

  const deleteTransaction = useCallback(async (txId: string): Promise<boolean> => {
    setTransactions(prev => prev.filter(tx => tx.id !== txId));
    markAsDirty();
    return true;
  }, [markAsDirty]);

  const addAccount = async (a: Omit<Account, 'id'>) => {
    setAccounts(prev => [...prev, { ...a, id: `acc_${Date.now()}` }]);
    markAsDirty();
  };
  
  const updateAccountName = async (id: string, name: string) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, name } : a));
    markAsDirty();
  };
  
  const deleteAccount = async (id: string) => {
    const remainingAccounts = accounts.filter(a => a.id !== id);
    const fallbackId = remainingAccounts.length > 0 ? remainingAccounts[0].id : undefined;

    setAccounts(prev => prev.filter(a => a.id !== id));
    setTransactions(prev => prev.map(t => {
      let changed = false;
      const nextT = { ...t };
      if (t.accountId === id) { nextT.accountId = fallbackId; changed = true; }
      if (t.fromAccountId === id) { nextT.fromAccountId = fallbackId; changed = true; }
      if (t.toAccountId === id) { nextT.toAccountId = fallbackId; changed = true; }
      return changed ? { ...nextT, isPendingSync: true } : nextT;
    }));
    markAsDirty();
  };

  const addCategory = async (c: Omit<Category, 'id'>) => {
    setCategories(prev => [...prev, { ...c, id: `cat_${Date.now()}` }]);
    markAsDirty();
  };
  
  const updateCategory = async (c: Category) => {
    setCategories(prev => prev.map(cat => cat.id === c.id ? c : cat));
    markAsDirty();
  };
  
  const deleteCategory = async (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setCategoryBudgets(prev => prev.filter(b => b.categoryId !== id));
    setTransactions(prev => prev.map(t => {
      if (t.categoryId === id) return { ...t, categoryId: undefined, isPendingSync: true };
      return t;
    }));
    markAsDirty();
  };

  const updateBudget = (n: number) => { setBudget(n); markAsDirty(); };
  const updateCategoryBudget = (cid: string, n: number) => { 
    setCategoryBudgets(prev => [...prev.filter(b => b.categoryId !== cid), { categoryId: cid, amount: n }]);
    markAsDirty();
  };
  const updateSettings = (s: Partial<AppSettings>) => { setSettings(prev => ({ ...prev, ...s })); markAsDirty(); };
  const resetPreferences = () => { storage.clearAll(); window.location.reload(); };
  const login = async (e: string, p: string) => { await cloudDrive.login(e, p); };
  const signup = async (e: string, p: string, n: string) => { await cloudDrive.signup(e, p, n); };
  const resetPassword = async (e: string) => { await cloudDrive.resetPassword(e); };
  const updateUserProfilePhoto = (url: string) => setSyncState(prev => prev.user ? { ...prev, user: { ...prev.user, photoURL: url } } : prev);

  // --- BACKUP & RESTORE ---
  const backupUserData = async (custom?: any) => {
    if (isBackingUpRef.current) return { skipped: true };
    isBackingUpRef.current = true;
    setSyncState(p => ({ ...p, isSyncing: true }));

    try {
      if (!syncState.user) return { skipped: true };
      
      const data = custom || { transactions, accounts, categories, budget, category_budgets: categoryBudgets, settings };
      
      if (syncState.activeWalletId) {
          await cloudDrive.syncWalletData(syncState.activeWalletId, syncState.user.id, data);
          setSyncState(p => ({ ...p, unsyncedChanges: false, lastSync: new Date().toISOString() }));
          return { skipped: false, timestamp: new Date().toISOString() };
      } else {
          const res = await cloudDrive.backupUserData(syncState.user.id, data);
          setSyncState(p => ({ ...p, lastSync: res.timestamp, unsyncedChanges: false }));
          return res;
      }
    } catch (err: any) {
      console.error("Backup failed:", err);
      throw err;
    } finally {
      isBackingUpRef.current = false;
      setSyncState(p => ({ ...p, isSyncing: false }));
    }
  };

  useEffect(() => {
    const checkAutoBackup = async () => {
        if (!syncState.isLoggedIn || !syncState.user || !syncState.isOnline || isLoggingOutRef.current) return;
        if (isBackingUpRef.current) return;
        if (syncState.unsyncedChanges) {
            try { await backupUserData(); } catch(e) {}
            return;
        }
        if (settings.autoBackup === 'off') return;
        if (!syncState.lastSync) { await backupUserData(); return; }
        const last = new Date(syncState.lastSync).getTime();
        const now = new Date().getTime();
        const hoursDiff = (now - last) / (1000 * 60 * 60);
        const threshold = settings.autoBackup === 'daily' ? 24 : 168; 
        if (hoursDiff >= threshold) await backupUserData();
    };
    const timer = setTimeout(checkAutoBackup, 4000); 
    return () => clearTimeout(timer);
  }, [syncState.isLoggedIn, syncState.isOnline, settings.autoBackup, syncState.unsyncedChanges, transactions, syncState.lastSync]); 

  const restoreBackup = async (strat: 'merge' | 'replace' | 'skip') => {
    if (!syncState.user) return false;
    if (strat === 'skip') { setSyncState(p => ({ ...p, pendingRestoreAvailable: false })); return true; }
    
    try {
      let remoteData: any = null;
      let remoteTimestamp: string | null = null;

      if (syncState.activeWalletId) {
         remoteData = await cloudDrive.getWalletData(syncState.activeWalletId);
         remoteTimestamp = new Date().toISOString(); // Shared wallets are always "latest"
      } else {
         const backupResult = await cloudDrive.restoreBackup(syncState.user.id);
         if (backupResult) {
             remoteData = backupResult.data;
             remoteTimestamp = backupResult.metadata?.timestamp;
         }
      }
      
      if (!remoteData) return false;

      const cloudTxs: Transaction[] = remoteData.transactions || [];
      const cloudAccounts: Account[] = remoteData.accounts || INITIAL_ACCOUNTS;
      const cloudCats: Category[] = remoteData.categories || INITIAL_CATEGORIES;
      const cloudBudget = remoteData.budget || 0;
      const cloudSettings = remoteData.settings || DEFAULT_SETTINGS;
      const cloudCatBudgets = remoteData.category_budgets || [];

      if (strat === 'replace') {
          setTransactions(cloudTxs);
          setAccounts(cloudAccounts);
          setCategories(cloudCats);
          setBudget(cloudBudget);
          setCategoryBudgets(cloudCatBudgets);
          setSettings(cloudSettings);
      } else {
          setTransactions(prevTxs => {
            const txMap = new Map();
            cloudTxs.forEach(t => txMap.set(t.id, t)); 
            prevTxs.forEach(t => { if (!txMap.has(t.id)) txMap.set(t.id, t); });
            return Array.from(txMap.values()).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) as Transaction[];
          });
          setAccounts(cloudAccounts); 
          setCategories(cloudCats);
          // FIX: Merge settings, budget, and category budgets even in merge mode
          // Cloud settings should generally take precedence if we are syncing to a new device
          setSettings(prev => ({ ...prev, ...cloudSettings }));
          setBudget(cloudBudget);
          setCategoryBudgets(cloudCatBudgets);
      }
      
      // FIX: Update lastSync so modal doesn't pop up again immediately
      if (remoteTimestamp) {
          setSyncState(p => ({ ...p, pendingRestoreAvailable: false, lastSync: remoteTimestamp }));
      } else {
          setSyncState(p => ({ ...p, pendingRestoreAvailable: false }));
      }
      
      return true;
    } catch (e) {
      console.error("Restore failed", e);
      return false;
    }
  };

  // --- AUTH HANDLER ---
  const handleAuthStateChange = useCallback(async (user: any) => {
    if (isLoggingOutRef.current) return;
    
    const currentVersion = ++sessionVersion.current;
    
    if (!user) { 
        setSyncState(prev => ({ 
           ...prev, 
           isLoggedIn: false, 
           user: null, 
           isRealtimeConnected: false, 
           unsyncedChanges: false,
           activeWalletId: null,
           lastSync: null // Clear sync on logout
        })); 
        setWallets([]); 
        return; 
    }

    const profile: UserProfile = {
      id: user.id, email: user.email || null, name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
      createdAt: user.created_at, emailVerified: !!user.email_confirmed_at,
      photoURL: user.user_metadata?.photo_url || user.user_metadata?.avatar_url || null
    };

    setSyncState(prev => ({ ...prev, isLoggedIn: true, user: profile }));

    if (navigator.onLine) {
        try {
            const walletsList = await cloudDrive.getMyWallets(user.id);
            if (currentVersion !== sessionVersion.current) return;
            setWallets(walletsList);
        } catch (e) { console.error("Auto-fetch wallets failed", e); }
    }

    if (!storage.get(STORAGE_KEYS.ACTIVE_WALLET_ID, null)) {
         try {
             // Fetch cloud backup meta
             const result = await cloudDrive.restoreBackup(user.id);
             if (currentVersion !== sessionVersion.current) return;
             
             if (result && result.data) {
                 const cloudTimestamp = result.metadata?.timestamp;
                 const localLastSync = storage.get(STORAGE_KEYS.LAST_SYNC, null);
                 
                 // FIX: Only prompt restore if Cloud is NEWER than local Last Sync
                 // If localLastSync is null, it means new device or cleared cache -> Prompt
                 const isNewer = !localLastSync || (cloudTimestamp && new Date(cloudTimestamp).getTime() > new Date(localLastSync).getTime() + 1000); // 1s buffer

                 if (isNewer) {
                     setSyncState(prev => ({ ...prev, lastSync: cloudTimestamp || null, pendingRestoreAvailable: true }));
                 } else {
                     // We are up to date, just set the timestamp pointer without prompting
                     setSyncState(prev => ({ ...prev, lastSync: cloudTimestamp || null, pendingRestoreAvailable: false }));
                 }
             }
         } catch(e) {}
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
       handleAuthStateChange(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
       if (event === 'SIGNED_OUT') {
          handleAuthStateChange(null);
       } else {
          handleAuthStateChange(session?.user || null);
       }
    });
    return () => subscription.unsubscribe();
  }, [handleAuthStateChange]);

  const logout = async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    // 1. Switch to Personal Context logic (Save Shared, Load Personal)
    if (syncState.activeWalletId) {
         saveCurrentContextToStorage(syncState.activeWalletId);
         loadContextFromStorage(null); 
    }

    // 2. Sign Out
    try { 
        supabase.removeAllChannels();
        await supabase.auth.signOut(); 
    } catch (e) {}

    // 3. Update State (NO RELOAD)
    setSyncState(prev => ({
        ...prev,
        isLoggedIn: false,
        user: null,
        activeWalletId: null,
        unsyncedChanges: false,
        isRealtimeConnected: false,
        lastSync: null
    }));
    
    setWallets([]); 

    showNotification("Logged out - Switched to Personal Wallet");
    isLoggingOutRef.current = false;
  };

  const t = (key: string): string => {
    const dict = customTranslations[settings.language] || TRANSLATIONS[settings.language] || TRANSLATIONS['en'];
    // 1. Try exact key match
    if (dict[key]) return dict[key];
    
    // 2. Try English key match (fallback for missing translations)
    if (TRANSLATIONS['en'][key]) return TRANSLATIONS['en'][key];
    
    // 3. Return key itself (for user generated content)
    return key;
  };

  const formatPrice = (amount: number) => {
      // Use standard Intl.NumberFormat for correct locale formatting (e.g. Arabic numerals)
      try {
          return new Intl.NumberFormat(settings.language, { 
              style: 'currency', 
              currency: settings.currency === '$' ? 'USD' : settings.currency,
              minimumFractionDigits: 2
          }).format(amount);
      } catch (e) {
          // Fallback if currency code is invalid or custom
          return `${settings.currency}${amount.toFixed(2)}`;
      }
  };
  
  const getAccountBalance = (id: string) => transactions.reduce((bal, tx) => {
    if (tx.accountId === id) return tx.type === 'income' ? bal + tx.amount : tx.type === 'expense' ? bal - tx.amount : bal;
    if (tx.type === 'transfer') { if (tx.fromAccountId === id) return bal - tx.amount; if (tx.toAccountId === id) return bal + tx.amount; }
    return bal;
  }, 0);

  const refreshAIInsights = async (force = false) => {
    if (!settings.showAIInsightsOnDashboard) return;
    
    // Auto-load throttling (1 hour cooldown unless forced)
    const lastFetch = storage.get('sb_ai_last_fetch', 0);
    const now = Date.now();
    // If NOT forced AND has insight AND fetched recently (< 1 hour), skip
    if (!force && aiInsight && (now - lastFetch < 3600000)) {
        return;
    }

    setIsAIAnalysing(true);

    try {
      // Rule: obtaining exclusively from the environment variable process.env.API_KEY.
      // Rule: Create a new GoogleGenAI instance right before making an API call.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const recentTxs = transactions.slice(-20).map(t => ({ type: t.type, amount: t.amount, note: t.note, cat: categories.find(c => c.id === t.categoryId)?.name }));
      const prompt = `Analyze these recent transactions. Give 3 short, distinct, specific financial tips. Start each tip with a "•" character. Keep it under 30 words total per tip. Use currency ${settings.currency}. Data: ${JSON.stringify(recentTxs)}. Budget: ${budget}.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setAiInsight(response.text || "Tracking finances leads to growth.");
      storage.set('sb_ai_last_fetch', Date.now());
    } catch (e: any) { 
        if (e.message?.includes('403') || e.message?.includes('PERMISSION_DENIED') || e.status === 403) {
             setAiInsight("AI currently unavailable. Ensure the API_KEY is correctly set in your environment.");
        } else {
             setAiInsight("Analysis failed. Please check your connection.");
        }
    } finally {
        setIsAIAnalysing(false);
    }
  };

  // --- SMART NUDGES (ON-LAUNCH ALERTS) ---
  const checkSmartNudges = useCallback(async () => {
    // 1. Throttling: Check if we already nudged recently (e.g., last 6 hours)
    const lastNudge = storage.get('sb_last_nudge_time', 0);
    const now = Date.now();
    if (now - lastNudge < 6 * 60 * 60 * 1000) return; // 6 hours cooldown

    // Data prep
    const currentMonth = new Date().getMonth();
    const monthlyExpenses = transactions
      .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === currentMonth)
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Sort transactions to get latest
    const sortedTx = [...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastTxDate = sortedTx.length > 0 ? new Date(sortedTx[0].date) : new Date(0);
    const today = new Date();
    const isEvening = today.getHours() >= 20; // 8 PM or later

    let prompt = "";
    let type: 'info' | 'error' | 'success' = 'info';

    // LOGIC TREE
    
    // A. Budget Alert (High Priority)
    if (budget > 0 && monthlyExpenses > budget * 0.9) {
        prompt = `You are a financial assistant. The user has spent ${formatPrice(monthlyExpenses)} of their ${formatPrice(budget)} budget (over 90%). Give a short, urgent warning (max 15 words).`;
        type = 'error';
    } 
    else if (budget > 0 && monthlyExpenses > budget * 0.8) {
        prompt = `You are a financial assistant. The user has spent ${formatPrice(monthlyExpenses)} of their ${formatPrice(budget)} budget (80%). Give a short caution (max 15 words).`;
        type = 'info';
    }
    // B. Evening "Forgot to Save?" Nudge
    else if (isEvening && lastTxDate.getDate() !== today.getDate()) {
        // It's evening and last transaction was not today
        prompt = `You are a friendly financial assistant. It is 8 PM and the user hasn't logged any transactions today. Ask if they forgot to track their daily spending. Short and casual (max 15 words).`;
        type = 'info';
    }
    // C. General Inactivity (more than 2 days)
    else if ((now - lastTxDate.getTime()) > 2 * 24 * 60 * 60 * 1000) {
        prompt = `You are a financial coach. The user hasn't logged anything in 2 days. Gently remind them to stay on track. Short (max 15 words).`;
        type = 'info';
    }

    if (prompt) {
        // Execute Nudge
        storage.set('sb_last_nudge_time', now);
        
        // Try AI generation if online
        if (navigator.onLine) {
            try {
                // Rule: Create a new GoogleGenAI instance right before making an API call.
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const resp = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
                const text = resp.text?.trim();
                if (text) {
                    showNotification(text, type);
                    return;
                }
            } catch(e) { console.error("AI Nudge failed", e); }
        }

        // Fallback messages
        if (type === 'error') showNotification(`Alert: You have used over 90% of your budget!`, 'error');
        else if (isEvening) showNotification("Good evening! Did you spend anything today?", 'info');
        else showNotification("Reminder: Track your expenses to stay on top of your goals.", 'info');
    }

  }, [transactions, budget, settings.currency, settings.language, showNotification]);

  // Effect to run it once on mount (with delay to let data load)
  useEffect(() => {
      const t = setTimeout(() => {
          checkSmartNudges();
      }, 5000); // 5 seconds after load
      return () => clearTimeout(t);
  }, [checkSmartNudges]);

  return (
    <AppContext.Provider value={{
      transactions, accounts, categories, budget, categoryBudgets, settings, syncState, aiInsight, alerts: [], automationRules: [], notification, wallets,
      addTransaction, updateTransaction, deleteTransaction, importTransactions,
      addAccount, updateAccountName, deleteAccount, addCategory, updateCategory, deleteCategory,
      updateBudget, updateCategoryBudget, updateSettings, resetPreferences, logout, login, signup, resetPassword, backupUserData, restoreBackup,
      availableLanguages: Array.from(new Set(['en', ...Object.keys(customTranslations)])), 
      installLanguage: (code, dict) => { setCustomTranslations(prev => ({ ...prev, [code]: dict })); updateSettings({ language: code }); },
      uninstallLanguage: (code) => { 
          if(code === 'en') return; 
          setCustomTranslations(prev => { const n = { ...prev }; delete n[code]; return n; }); 
          if (settings.language === code) updateSettings({ language: 'en' }); 
      },
      availableCurrencies: [...new Set([...settings.currencies, ...MOCK_ONLINE_CURRENCIES.map(c => c.code)])],
      installCurrency: (code) => { 
        if (!settings.currencies.includes(code)) updateSettings({ currencies: [...settings.currencies, code], currency: code }); 
        else updateSettings({ currency: code }); 
      },
      uninstallCurrency: (code) => { if (code === '$') return; const next = settings.currencies.filter(c => c !== code); updateSettings({ currencies: next, currency: settings.currency === code ? '$' : settings.currency }); },
      t, formatPrice, getAccountBalance, isActionSheetOpen, setIsActionSheetOpen, refreshAIInsights, updateUserProfilePhoto, showNotification,
      switchWallet, createWallet, refreshWallets, isAIAnalysing, deleteWallet,
      isResetting
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
