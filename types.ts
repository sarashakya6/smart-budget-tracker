
export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountKey = 'cash' | 'bank' | 'wallet';

export interface Account {
  id: string;
  key: AccountKey;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  subCategories: string[];
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  note: string;
  accountId?: string;
  categoryId?: string;
  subCategory?: string;
  fromAccountId?: string;
  toAccountId?: string;
  receiptUrl?: string; 
  merchantName?: string; 
  isFlagged?: boolean; 
  user_id?: string; // Supabase owner ID
  isPendingSync?: boolean; 
}

export interface Alert {
  id: string;
  type: 'budget_threshold' | 'unusual_spend' | 'recurring';
  message: string;
  date: string;
  isDismissed: boolean;
}

export interface AutomationRule {
  id: string;
  trigger: 'merchant_contains' | 'amount_above';
  value: string;
  action: 'assign_category' | 'flag';
  targetId?: string; 
}

export interface AppSettings {
  currency: string;
  currencies: string[];
  deletedCurrencies: string[];
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  language: string;
  deletedLanguages: string[];
  archivedCustomLanguages: Record<string, Record<string, string>>;
  defaultDashboardView: 'today' | 'week' | 'month';
  defaultReportView: 'daily' | 'weekly' | 'monthly' | 'custom' | 'all';
  defaultExportView: 'monthly' | 'custom';
  showBudgetOnDashboard: boolean;
  showCategoryBudgetsOnDashboard: boolean;
  hiddenCategoryBudgets: string[];
  showFinancialOverviewChart: boolean;
  showAccountsOnDashboard: boolean;
  showQuickActionsOnDashboard: boolean;
  showAIInsightsOnDashboard: boolean;
  showFinancialHealthScore: boolean;
  reportChartType: 'bar' | 'pie' | 'line';
  automationThreshold: number;
  autoBackup: 'off' | 'daily' | 'weekly';
  enableRealtime: boolean;
}

export interface CategoryBudget {
  categoryId: string;
  amount: number;
}

export interface UserProfile {
  id: string;
  email: string | null;
  name: string;
  address?: string;
  photoURL?: string;
  createdAt: string;
  lastSignIn?: string;
  emailVerified: boolean;
}

export interface Wallet {
  id: string;
  name: string;
  currency: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at?: string;
  is_shared: boolean;
}

export interface WalletMember {
  user_id: string;
  wallet_id: string;
  role: 'owner' | 'editor' | 'viewer';
  email?: string;
  full_name?: string;
  photo_url?: string;
}

export interface SyncState {
  isLoggedIn: boolean;
  user: UserProfile | null;
  lastSync: string | null;
  backupSize: string | null;
  pendingRestoreAvailable: boolean;
  isOnline: boolean; 
  pendingActionsCount: number; 
  isSyncing?: boolean; 
  syncStatusMessage?: string | null;
  isRealtimeConnected: boolean;
  unsyncedChanges: boolean; // Track if we have offline changes
  activeWalletId: string | null; // null = Personal
}

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface AppState {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budget: number;
  categoryBudgets: CategoryBudget[];
  settings: AppSettings;
  syncState: SyncState;
  alerts: Alert[]; 
  automationRules: AutomationRule[]; 
  aiInsight?: string;
  notification: Notification | null;
  wallets: Wallet[];
}