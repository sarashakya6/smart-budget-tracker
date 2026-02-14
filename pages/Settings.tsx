
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Trash2, Plus, Globe, DollarSign, LayoutDashboard, ChevronRight, ArrowLeft, X, 
  RotateCcw, ToggleLeft, ToggleRight, CloudUpload, CloudDownload, Loader2,
  Banknote, CreditCard, Wallet as WalletIcon, Check, Edit2, Target, Palette,
  Sun, Moon, Monitor, Type, Download, Library,
  Cloud, RefreshCw, Database, Shield, Share2, Copy, 
  LogOut, ArrowRightLeft, ChevronDown, Tags, AlertTriangle, Zap, Users, User, Clock,
  UserPlus, Info, Send
} from 'lucide-react';
import { LANGUAGE_NAMES, MOCK_ONLINE_LANGUAGES, MOCK_ONLINE_CURRENCIES } from '../constants';
import { Account, Category, WalletMember } from '../types';
import { cloudDrive } from '../services/cloudDrive';

const Settings: React.FC = () => {
  const { 
    settings, updateSettings, syncState, backupUserData, restoreBackup,
    budget, updateBudget, categoryBudgets, updateCategoryBudget, categories,
    addCategory, updateCategory, deleteCategory,
    accounts, addAccount, updateAccountName, deleteAccount, getAccountBalance,
    availableLanguages, installLanguage, uninstallLanguage,
    availableCurrencies, installCurrency, uninstallCurrency,
    formatPrice, resetPreferences, t, 
    setIsActionSheetOpen, transactions,
    wallets, switchWallet, createWallet, refreshWallets, showNotification, deleteWallet
  } = useApp();
  
  const [activeSubView, setActiveSubView] = useState<'main' | 'regional' | 'budgets' | 'dashboard' | 'sync' | 'accounts' | 'appearance' | 'categories' | 'wallets'>('main');
  const [regionalTab, setRegionalTab] = useState<'languages' | 'currencies'>('languages');
  const [showManager, setShowManager] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  
  // Wallet State
  const [newWalletName, setNewWalletName] = useState('');
  const [activeMembers, setActiveMembers] = useState<WalletMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [viewingMembersWalletId, setViewingMembersWalletId] = useState<string | null>(null);

  // Edit States
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccountName, setEditAccountName] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'bank' | 'cash' | 'wallet'>('bank');
  
  const [categoryType, setCategoryType] = useState<'expense' | 'income'>('expense');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandingCategoryId, setExpandingCategoryId] = useState<string | null>(null);
  const [newSubCategory, setNewSubCategory] = useState('');

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'account' | 'category' | 'wallet';
    item: Account | Category | any | null;
    message: string;
    subMessage?: string;
  }>({ isOpen: false, type: 'account', item: null, message: '' });

  useEffect(() => { setIsActionSheetOpen(showManager || deleteModal.isOpen || !!viewingMembersWalletId); }, [showManager, deleteModal.isOpen, viewingMembersWalletId, setIsActionSheetOpen]);

  // Load members when viewing a wallet
  useEffect(() => {
    if (viewingMembersWalletId) {
        cloudDrive.getWalletMembers(viewingMembersWalletId).then(setActiveMembers).catch(console.error);
    }
  }, [viewingMembersWalletId]);

  // Auto-refresh wallets when entering the view
  useEffect(() => {
    if (activeSubView === 'wallets') {
      refreshWallets();
    }
  }, [activeSubView, refreshWallets]);

  const renderHeader = (title: string) => (
    <div className="flex items-center gap-3 mb-6 animate-in slide-in-from-left duration-300 px-1">
       <button onClick={() => setActiveSubView('main')} className="p-2 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-xl active:scale-90 text-gray-500 dark:text-gray-400 transition-all"><ArrowLeft size={20} /></button>
       <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter uppercase leading-none">{title}</h1>
    </div>
  );

  const Toggle = ({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) => (
    <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 mb-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer" onClick={onToggle}>
      <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">{label}</span>
      <button className={`transition-all pointer-events-none ${active ? 'text-blue-600' : 'text-gray-300'}`}>
        {active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
      </button>
    </div>
  );

  const simulateInstall = async (type: 'lang' | 'curr', item: any) => {
    const id = item.code || item.symbol; setInstallingId(id);
    await new Promise(r => setTimeout(r, 800)); 
    if (type === 'lang') installLanguage(item.code, item.dict); else installCurrency(id);
    setInstallingId(null);
  };

  // --- ACTIONS ---
  const handleManualBackup = async () => {
    if (!syncState.isLoggedIn || !syncState.user) return;
    setIsBackingUp(true);
    try {
      await backupUserData();
      showNotification("Backup Success");
    } catch (e: any) {
      showNotification(e.message || "Backup failed", "error");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!syncState.isLoggedIn) return;
    if (!window.confirm("Restoring will overwrite current data. Settings will be restored to saved state. Continue?")) return;
    
    setIsRestoring(true);
    try {
      const success = await restoreBackup('replace');
      if (success) {
        showNotification("Settings & Data Restored");
      } else {
        showNotification("No cloud backup found", "info");
      }
    } catch (e: any) {
      showNotification("Restore failed: " + e.message, "error");
    } finally {
      setIsRestoring(false);
    }
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return t('noActivity');
    try {
      const date = new Date(dateStr);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch (e) {
      return t('noActivity');
    }
  };

  const getNextBackupTime = () => {
    if (settings.autoBackup === 'off' || !syncState.lastSync) return null;
    const last = new Date(syncState.lastSync).getTime();
    const threshold = settings.autoBackup === 'daily' ? 24 : 168;
    const next = new Date(last + (threshold * 60 * 60 * 1000));
    return next.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // --- WALLET HANDLERS ---
  const handleInvite = async () => {
    if (!viewingMembersWalletId || !inviteEmail) return;
    try {
        const user = await cloudDrive.searchUserByEmail(inviteEmail);
        if (!user) {
             showNotification("User not found (Must sign up first)", "error");
             return;
        }
        await cloudDrive.addWalletMember(viewingMembersWalletId, user.id, 'editor');
        showNotification("Member added!");
        setInviteEmail('');
        // Refresh members
        const updated = await cloudDrive.getWalletMembers(viewingMembersWalletId);
        setActiveMembers(updated);
    } catch(e: any) {
        showNotification(e.message, "error");
    }
  };

  const handleRemoveMember = async (userId: string) => {
     if (!viewingMembersWalletId) return;
     if (!window.confirm("Remove this member?")) return;
     try {
         await cloudDrive.removeWalletMember(viewingMembersWalletId, userId);
         setActiveMembers(prev => prev.filter(m => m.user_id !== userId));
     } catch(e: any) { showNotification(e.message, "error"); }
  };

  // --- DELETE HANDLERS ---
  const initiateAccountDelete = (acc: Account) => {
    const usage = transactions.filter(t => t.accountId === acc.id || t.fromAccountId === acc.id || t.toAccountId === acc.id).length;
    let message = `${t('deleteConfirm')} "${acc.name}"?`;
    let subMessage = t('thisCannotBeUndone');

    if (usage > 0) {
        const fallbackAcc = accounts.find(a => a.id !== acc.id);
        const fallbackName = fallbackAcc ? fallbackAcc.name : t('orphaned');
        subMessage = `${usage} ${t('transactionsWillBeMoved')} "${fallbackName}". ${t('thisCannotBeUndone')}`;
    }

    setDeleteModal({ isOpen: true, type: 'account', item: acc, message, subMessage });
  };

  const initiateCategoryDelete = (cat: Category) => {
    const usage = transactions.filter(t => t.categoryId === cat.id).length;
    let message = `${t('deleteConfirm')} "${cat.name}"?`;
    let subMessage = t('thisCannotBeUndone');

    if (usage > 0) {
        subMessage = `${usage} ${t('transactionsWillBeUncategorized')}. ${t('thisCannotBeUndone')}`;
    }

    setDeleteModal({ isOpen: true, type: 'category', item: cat, message, subMessage });
  };
  
  const initiateWalletDelete = (w: any) => {
      setDeleteModal({
          isOpen: true,
          type: 'wallet',
          item: w,
          message: `${t('deleteConfirm')} "${w.name}"?`,
          subMessage: "WARNING: This will permanently delete the wallet and ALL its data for ALL members. This action cannot be undone."
      });
  };

  const confirmDelete = async () => {
    if (!deleteModal.item) return;
    
    if (deleteModal.type === 'account') {
        const acc = deleteModal.item as Account;
        if (editingAccountId === acc.id) setEditingAccountId(null);
        await deleteAccount(acc.id);
    } else if (deleteModal.type === 'category') {
        const cat = deleteModal.item as Category;
        if (editingCategoryId === cat.id) setEditingCategoryId(null);
        if (expandingCategoryId === cat.id) setExpandingCategoryId(null);
        await deleteCategory(cat.id);
    } else if (deleteModal.type === 'wallet') {
        await deleteWallet(deleteModal.item.id);
    }
    setDeleteModal({ ...deleteModal, isOpen: false });
  };

  const renderSubViewContent = () => {
    switch (activeSubView) {
      case 'appearance':
        return (
          <div className="animate-in slide-in-from-right duration-300 max-w-lg mx-auto">
            {renderHeader(t('interfaceStyling'))}
            <section className="space-y-4 px-1">
               <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('theme')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {id: 'light', icon: Sun}, {id: 'dark', icon: Moon}, {id: 'auto', icon: Monitor}
                    ].map(item => (
                      <button key={item.id} onClick={() => updateSettings({ theme: item.id as any })} className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${settings.theme === item.id ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-gray-50 dark:bg-gray-900 text-gray-400 border-transparent hover:border-blue-100 dark:hover:border-blue-900/50'}`}><item.icon size={18}/><span className="text-[8px] font-black uppercase tracking-widest">{item.id}</span></button>
                    ))}
                  </div>
               </div>
               <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('fontSize')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['small', 'medium', 'large'].map(size => (
                      <button key={size} onClick={() => updateSettings({ fontSize: size as any })} className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${settings.fontSize === size ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-gray-50 dark:bg-gray-900 text-gray-400 border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50'}`}><Type size={size === 'small' ? 14 : size === 'medium' ? 18 : 22} /><span className="text-[8px] font-black uppercase tracking-widest">{size}</span></button>
                    ))}
                  </div>
               </div>
            </section>
          </div>
        );
      case 'dashboard':
        return (
          <div className="animate-in slide-in-from-right duration-300 max-w-lg mx-auto pb-10">
            {renderHeader(t('displayLayout'))}
            <section className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">{t('dashboardComponents')}</p>
              <div className="space-y-1">
                <Toggle label={t('mainBudgetForecast')} active={settings.showBudgetOnDashboard} onToggle={() => updateSettings({ showBudgetOnDashboard: !settings.showBudgetOnDashboard })} />
                <Toggle label={t('categoryBudgetProgress')} active={settings.showCategoryBudgetsOnDashboard} onToggle={() => updateSettings({ showCategoryBudgetsOnDashboard: !settings.showCategoryBudgetsOnDashboard })} />
                <Toggle label={t('financialOverviewChart')} active={settings.showFinancialOverviewChart} onToggle={() => updateSettings({ showFinancialOverviewChart: !settings.showFinancialOverviewChart })} />
                <Toggle label={t('accountsRow')} active={settings.showAccountsOnDashboard} onToggle={() => updateSettings({ showAccountsOnDashboard: !settings.showAccountsOnDashboard })} />
                <Toggle label={t('quickActionBar')} active={settings.showQuickActionsOnDashboard} onToggle={() => updateSettings({ showQuickActionsOnDashboard: !settings.showQuickActionsOnDashboard })} />
                <Toggle label={t('aiIntelligenceInsights')} active={settings.showAIInsightsOnDashboard} onToggle={() => updateSettings({ showAIInsightsOnDashboard: !settings.showAIInsightsOnDashboard })} />
                <Toggle label={t('budgetHealth')} active={settings.showFinancialHealthScore} onToggle={() => updateSettings({ showFinancialHealthScore: !settings.showFinancialHealthScore })} />
              </div>
            </section>
          </div>
        );
      case 'sync':
        if (!syncState.isLoggedIn) {
            return (
              <div className="animate-in slide-in-from-right duration-300 max-w-lg mx-auto pb-10">
                {renderHeader(t('cloudSync'))}
                <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
                   <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 mb-2">
                      <Cloud size={32} />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('notSignedIn')}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                         Sign in to backup your settings, transactions, and budgets to the cloud.
                      </p>
                   </div>
                   <button onClick={() => window.location.hash = '#/account'} className="px-8 py-4 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-500/30 active:scale-95 transition-all">
                      Go to Login
                   </button>
                </div>
              </div>
            );
        }
        return (
          <div className="animate-in slide-in-from-right duration-300 max-w-lg mx-auto pb-10">
            {renderHeader(t('cloudSync'))}
            <section className="space-y-4 px-1">
               {/* Status Card */}
               <div className="p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2rem] flex flex-col gap-1 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('syncStatus')}</p>
                    <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase flex items-center gap-1 ${syncState.lastSync ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                      {syncState.lastSync ? <Check size={10} strokeWidth={4} /> : null}
                      {syncState.lastSync ? t('upToDate') : t('never')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                        <p className="text-xs font-black uppercase text-gray-800 dark:text-white">
                            {t('lastSynced')}:
                        </p>
                        <p className="text-xs font-bold text-gray-500">
                            {formatLastSync(syncState.lastSync)}
                        </p>
                    </div>
                    {syncState.backupSize && (
                      <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-3 py-1 rounded-lg border border-blue-100 dark:border-blue-900/50">{syncState.backupSize}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <Database size={12} className="text-gray-400" />
                      <p className="text-[9px] text-gray-400 font-bold uppercase">{t('localItems')} {transactions.length} • Settings Included</p>
                  </div>
               </div>

               {/* Auto Backup Config */}
               <div className="p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2rem] space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={16} className="text-blue-500" />
                      <p className="text-[11px] font-black text-gray-700 dark:text-gray-200 uppercase tracking-widest">{t('autoBackup')}</p>
                    </div>
                    <div className="flex bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-700">
                      {['off', 'daily', 'weekly'].map((opt) => (
                        <button 
                          key={opt}
                          onClick={() => updateSettings({ autoBackup: opt as any })}
                          className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${settings.autoBackup === opt ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  {settings.autoBackup !== 'off' && syncState.lastSync && (
                    <div className="flex items-center gap-2 px-1 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
                      <Clock size={12} className="text-blue-500" />
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('nextScheduled')} <span className="text-blue-600 dark:text-blue-400 font-black">{getNextBackupTime()}</span></p>
                    </div>
                  )}
               </div>

               {/* Manual Actions */}
               <div className="grid grid-cols-2 gap-3">
                 <button 
                   onClick={handleManualBackup} 
                   disabled={isBackingUp || isRestoring} 
                   className="flex flex-col items-center justify-center gap-2 p-5 bg-blue-600 text-white rounded-[2rem] shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 hover:bg-blue-700"
                 >
                    {isBackingUp ? <Loader2 size={24} className="animate-spin" /> : <CloudUpload size={24}/>}
                    <div className="text-center">
                        <p className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">{t('backupNow')}</p>
                        <p className="text-[8px] font-medium text-blue-100 opacity-80">Save Settings & Data</p>
                    </div>
                 </button>

                 <button 
                   onClick={handleRestore} 
                   disabled={isBackingUp || isRestoring} 
                   className="flex flex-col items-center justify-center gap-2 p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2rem] shadow-sm active:scale-95 transition-all disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
                 >
                    {isRestoring ? <Loader2 size={24} className="animate-spin text-blue-600" /> : <CloudDownload size={24} className="text-blue-600" />}
                    <div className="text-center">
                        <p className="text-[11px] font-black uppercase tracking-widest leading-none text-gray-700 dark:text-gray-200">{t('restoreData')}</p>
                        <p className="text-[8px] font-medium text-gray-400">Overwrite Local</p>
                    </div>
                 </button>
               </div>
            </section>
          </div>
        );
      case 'wallets':
        if (!syncState.isLoggedIn) {
          return (
            <div className="animate-in slide-in-from-right duration-300 max-w-lg mx-auto pb-10">
              {renderHeader(t('familyManagement'))}
              <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
                 <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 mb-2">
                    <Users size={32} />
                 </div>
                 <div className="space-y-2">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('notSignedIn')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                       Please log in to access your Shared Wallets and collaborate with family or friends.
                    </p>
                 </div>
                 <button onClick={() => window.location.hash = '#/account'} className="px-8 py-4 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-500/30 active:scale-95 transition-all">
                    Go to Login
                 </button>
              </div>
            </div>
          );
        }

        return (
          <div className="animate-in slide-in-from-right duration-300 max-w-lg mx-auto pb-10">
            {renderHeader(t('familyManagement'))}
            <section className="space-y-4 px-1">
               {/* Current Context */}
               <div className="bg-blue-600 text-white p-6 rounded-[2.5rem] shadow-xl shadow-blue-500/30 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{t('yourWallets')}</p>
                    <button onClick={() => refreshWallets().then(() => showNotification(t('upToDate')))} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                        <RefreshCw size={14} />
                    </button>
                  </div>
                  <div className="space-y-2">
                     {/* Personal */}
                     <button onClick={() => switchWallet(null)} className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${!syncState.activeWalletId ? 'bg-white text-blue-600 shadow-md' : 'bg-blue-700/50 text-white hover:bg-blue-700'}`}>
                        <div className="flex items-center gap-3">
                           <div className="p-2 rounded-xl bg-white/20"><User size={16} /></div>
                           <span className="text-xs font-black uppercase">{t('personalSpace')}</span>
                        </div>
                        {!syncState.activeWalletId && <Check size={16} />}
                     </button>
                     {/* Shared Wallets */}
                     {(wallets || []).map(w => (
                       <button key={w.id} onClick={() => switchWallet(w.id)} className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${syncState.activeWalletId === w.id ? 'bg-white text-blue-600 shadow-md' : 'bg-blue-700/50 text-white hover:bg-blue-700'}`}>
                          <div className="flex items-center gap-3 min-w-0">
                             <div className="p-2 rounded-xl bg-white/20"><Users size={16} /></div>
                             <div className="flex flex-col items-start min-w-0">
                                 <span className="text-xs font-black uppercase truncate">{w.name}</span>
                                 <span className="text-[9px] opacity-80 uppercase tracking-wide">{w.role === 'owner' ? 'Owner' : 'Member'} • {w.currency}</span>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Info/Invite Button - Opens Modal */}
                            <div onClick={(e) => { e.stopPropagation(); setViewingMembersWalletId(w.id); }} className="p-2 hover:bg-white/20 rounded-xl cursor-pointer active:scale-90 transition-transform">
                                {w.role === 'owner' ? <UserPlus size={16} /> : <Info size={16} />}
                            </div>
                            
                            {/* Delete if owner */}
                            {w.role === 'owner' && (
                                <div onClick={(e) => { e.stopPropagation(); initiateWalletDelete(w); }} className="p-2 bg-red-500/20 hover:bg-red-500 text-red-200 hover:text-white rounded-xl transition-colors cursor-pointer active:scale-90">
                                    <Trash2 size={16}/>
                                </div>
                            )}
                            
                            {/* Active Indicator */}
                            {syncState.activeWalletId === w.id && <div className="pl-1"><Check size={16} /></div>}
                          </div>
                       </button>
                     ))}
                  </div>
               </div>

               {/* Create New */}
               <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('createWallet')}</p>
                  <div className="flex gap-2">
                     <input value={newWalletName} onChange={e => setNewWalletName(e.target.value)} placeholder={t('walletName')} className="flex-1 p-4 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500/20 rounded-2xl text-[12px] font-bold outline-none dark:text-white transition-all shadow-inner" />
                     <button onClick={() => { if(newWalletName) { createWallet(newWalletName, settings.currency); setNewWalletName(''); } }} className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-90"><Plus size={20}/></button>
                  </div>
               </div>
            </section>
            
            {/* Improved Wallet Management Modal */}
            {viewingMembersWalletId && (
               <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setViewingMembersWalletId(null)}>
                  <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
                     
                     {/* Header */}
                     <div className="p-6 bg-blue-600 text-white relative">
                         <button onClick={() => setViewingMembersWalletId(null)} className="absolute top-6 right-6 p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"><X size={16}/></button>
                         <div className="flex items-center gap-3 mb-2">
                             <div className="p-2 bg-white/20 rounded-xl"><WalletIcon size={20} /></div>
                             <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{t('familyManagement')}</span>
                         </div>
                         <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{wallets.find(w => w.id === viewingMembersWalletId)?.name}</h2>
                         <div className="flex gap-2 text-[10px] font-medium opacity-80 uppercase">
                            <span>{activeMembers.length} Members</span>
                            <span>•</span>
                            <span>{wallets.find(w => w.id === viewingMembersWalletId)?.currency}</span>
                         </div>
                     </div>

                     <div className="p-6 overflow-y-auto space-y-6">
                         {/* Invite Section */}
                         <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-[2rem] border border-blue-100 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-400">
                               <UserPlus size={18} />
                               <h3 className="text-[11px] font-black uppercase tracking-widest">{t('inviteMember')}</h3>
                            </div>
                            <div className="flex gap-2">
                               <input 
                                  value={inviteEmail} 
                                  onChange={e => setInviteEmail(e.target.value)} 
                                  placeholder={t('emailPlaceholder')} 
                                  className="flex-1 px-4 py-3 bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900/50 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
                               />
                               <button onClick={handleInvite} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/30 active:scale-90 transition-transform hover:bg-blue-700">
                                  <Send size={18} />
                               </button>
                            </div>
                            <p className="text-[9px] text-gray-400 mt-2 px-1">User must already be registered with this email.</p>
                         </div>

                         {/* Members List */}
                         <div>
                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">{t('members')}</h3>
                            <div className="space-y-2.5">
                                {(activeMembers || []).map(m => (
                                   <div key={m.user_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                      <div className="flex items-center gap-3">
                                         <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-500 font-bold text-sm overflow-hidden border border-white dark:border-gray-600 shadow-sm">
                                            {m.photo_url ? <img src={m.photo_url} className="w-full h-full object-cover" alt="User"/> : m.full_name?.[0]}
                                         </div>
                                         <div>
                                            <p className="text-xs font-black text-gray-800 dark:text-white leading-tight">{m.full_name}</p>
                                            <p className="text-[9px] text-gray-400 uppercase font-bold">{m.role}</p>
                                         </div>
                                      </div>
                                      {m.role !== 'owner' && (
                                        <button onClick={() => handleRemoveMember(m.user_id)} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><X size={14} /></button>
                                      )}
                                   </div>
                                ))}
                            </div>
                         </div>
                     </div>
                  </div>
               </div>
            )}
          </div>
        );
      case 'regional':
        return (
          <div className="animate-in slide-in-from-right duration-300 max-w-lg mx-auto pb-10">
            {renderHeader(t('languageCurrency'))}
            <section className="space-y-4 px-1">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 space-y-6 shadow-sm">
                <div className="space-y-3">
                   <div className="flex items-center justify-between ml-1">
                     <div className="flex items-center gap-2">
                        <Globe size={14} className="text-blue-500" />
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('selectedLanguage')}</label>
                     </div>
                   </div>
                   <div className="flex gap-2">
                     <select value={settings.language} onChange={e => updateSettings({ language: e.target.value })} className="flex-1 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-black dark:text-white outline-none shadow-inner appearance-none">
                        {(availableLanguages || ['en']).map(l => <option key={l} value={l}>{LANGUAGE_NAMES[l] || l}</option>)}
                     </select>
                     {settings.language !== 'en' && (
                       <button onClick={() => uninstallLanguage(settings.language)} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl border border-red-100 dark:border-red-900/30 transition-all active:scale-90"><Trash2 size={20} /></button>
                     )}
                   </div>
                </div>
                <div className="space-y-3">
                   <div className="flex items-center justify-between ml-1">
                     <div className="flex items-center gap-2">
                        <DollarSign size={14} className="text-blue-500" />
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('mainCurrency')}</label>
                     </div>
                   </div>
                   <div className="flex gap-2">
                     <select value={settings.currency} onChange={e => updateSettings({ currency: e.target.value })} className="flex-1 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-black dark:text-white outline-none shadow-inner appearance-none">
                        {(settings.currencies || ['$']).map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     {settings.currency !== '$' && (
                       <button onClick={() => uninstallCurrency(settings.currency)} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl border border-red-100 dark:border-red-900/30 transition-all active:scale-90"><Trash2 size={20} /></button>
                     )}
                   </div>
                </div>
              </div>

              <button onClick={() => setShowManager(true)} className="w-full py-5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-[2rem] shadow-2xl shadow-blue-500/30 flex items-center justify-center gap-3 active:scale-95 transition-all group">
                <Library size={18} /> {t('manageLibrary')}
              </button>

              {showManager && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in" onClick={() => setShowManager(false)}>
                  <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 flex flex-col max-h-[85vh] animate-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-center gap-2 mb-6">
                       <Library size={32} className="text-blue-600 mb-2" />
                       <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none">{t('resourceManager')}</h3>
                       <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl shadow-inner mt-2 border border-gray-200 dark:border-gray-700">
                         <button onClick={() => setRegionalTab('languages')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${regionalTab === 'languages' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-md' : 'text-gray-400'}`}>{t('languages')}</button>
                         <button onClick={() => setRegionalTab('currencies')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${regionalTab === 'currencies' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-md' : 'text-gray-400'}`}>{t('currencies')}</button>
                       </div>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-3">
                      {(regionalTab === 'languages' ? MOCK_ONLINE_LANGUAGES : MOCK_ONLINE_CURRENCIES).map(item => {
                          const code = item.code || (item as any).symbol;
                          const isInstalled = (regionalTab === 'languages' ? (availableLanguages || []) : (settings.currencies || [])).includes(code);
                          return (
                            <div key={code} className="flex items-center justify-between p-5 bg-gray-50 dark:bg-gray-900/50 rounded-[1.75rem] border-2 border-transparent hover:border-blue-100 dark:hover:border-blue-900/50 transition-all">
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-black dark:text-white uppercase leading-none truncate">{item.name}</p>
                                <p className="text-[8px] font-bold text-gray-400 uppercase mt-2 leading-none tracking-widest">ID: {code}</p>
                              </div>
                              {!isInstalled ? (
                                <button onClick={() => simulateInstall(regionalTab === 'languages' ? 'lang' : 'curr', item)} disabled={!!installingId} className="flex items-center gap-2 py-3 px-5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-50 shadow-xl shadow-blue-500/20 active:scale-90 transition-all">
                                  {installingId === code ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                  {t('get')}
                                </button>
                              ) : (
                                <span className="flex items-center gap-1.5 text-[9px] font-black text-green-500 uppercase px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/30">
                                  <Check size={14} strokeWidth={4} /> {t('installed')}
                                </span>
                              )}
                            </div>
                          );
                      })}
                    </div>
                    <button onClick={() => setShowManager(false)} className="w-full mt-6 py-5 bg-gray-100 dark:bg-gray-900 text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl active:scale-95 transition-all">{t('done')}</button>
                  </div>
                </div>
              )}
            </section>
          </div>
        );
      case 'accounts':
        return (
          <div className="animate-in slide-in-from-right duration-300 max-w-lg mx-auto pb-10">
            {renderHeader(t('manageAccounts'))}
            <section className="space-y-4 px-1">
                {accounts.map(acc => (
                  <div key={acc.id} className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all">
                     {editingAccountId === acc.id ? (
                       <div className="flex gap-2"><input value={editAccountName} onChange={e => setEditAccountName(e.target.value)} className="flex-1 p-3.5 text-xs font-black bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none" autoFocus /><button onClick={() => { if(editAccountName) { updateAccountName(acc.id, editAccountName); setEditingAccountId(null); } }} className="p-4 bg-blue-600 text-white rounded-xl shadow-lg"><Check size={20}/></button></div>
                     ) : (
                       <div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">{acc.key === 'bank' ? <CreditCard size={20}/> : acc.key === 'cash' ? <Banknote size={20}/> : <WalletIcon size={20}/>}</div><div><p className="text-[13px] font-black text-gray-800 dark:text-gray-100 uppercase leading-none mb-1.5">{t(acc.name)}</p><p className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none">{formatPrice(getAccountBalance(acc.id))}</p></div></div><div className="flex gap-1"><button onClick={() => { setEditingAccountId(acc.id); setEditAccountName(acc.name); }} className="p-2.5 text-gray-400 hover:text-blue-600 transition-all active:scale-90"><Edit2 size={18}/></button><button onClick={(e) => { e.stopPropagation(); initiateAccountDelete(acc); }} className="p-2.5 text-red-400 hover:text-red-600 transition-all active:scale-90"><Trash2 size={18}/></button></div></div>
                     )}
                  </div>
                ))}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm mt-4 space-y-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('openProfessionalAccount')}</p>
                  <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl gap-1">
                    {['bank', 'cash', 'wallet'].map(type => (
                      <button key={type} onClick={() => setNewAccountType(type as any)} className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-lg transition-all ${newAccountType === type ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-400'}`}>{type}</button>
                    ))}
                  </div>
                  <div className="flex gap-2"><input value={newAccountName} onChange={e => setNewAccountName(e.target.value)} placeholder={t('mySavingsExample')} className="flex-1 p-4 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500/20 rounded-2xl text-[12px] font-bold outline-none dark:text-white shadow-inner" /><button onClick={() => { if(newAccountName) { addAccount({key: newAccountType, name: newAccountName}); setNewAccountName(''); } }} className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-90"><Plus size={20}/></button></div>
                </div>
            </section>
          </div>
        );
      case 'categories':
        const filteredCategories = categories.filter(c => c.type === categoryType);
        return (
          <div className="animate-in slide-in-from-right duration-300 max-w-lg mx-auto pb-10">
            {renderHeader(t('categoriesLabels'))}
            <section className="space-y-4 px-1">
               <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl shadow-inner">
                 <button onClick={() => setCategoryType('expense')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${categoryType === 'expense' ? 'bg-white dark:bg-gray-800 text-red-500 shadow-md border dark:border-gray-700' : 'text-gray-400'}`}>{t('expense')}</button>
                 <button onClick={() => setCategoryType('income')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${categoryType === 'income' ? 'bg-white dark:bg-gray-800 text-green-500 shadow-md border dark:border-gray-700' : 'text-gray-400'}`}>{t('income')}</button>
               </div>
               <div className="space-y-3">
                 {filteredCategories.map(cat => (
                   <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                     <div className="p-5 flex items-center justify-between">
                       {editingCategoryId === cat.id ? (
                          <div className="flex-1 flex gap-2"><input value={editCategoryName} onChange={e => setEditCategoryName(e.target.value)} className="flex-1 p-3 text-sm font-black bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white outline-none" autoFocus /><button onClick={() => { updateCategory({...cat, name: editCategoryName}); setEditingCategoryId(null); }} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg"><Check size={18}/></button></div>
                       ) : (
                         <>
                           <div className="flex-1 cursor-pointer group" onClick={() => setExpandingCategoryId(expandingCategoryId === cat.id ? null : cat.id)}>
                              <p className="text-[13px] font-black text-gray-800 dark:text-gray-100 uppercase leading-none group-hover:text-blue-600 transition-colors">{t(cat.name)}</p>
                              <div className="flex items-center gap-2 mt-2"><span className="text-[9px] text-gray-400 font-bold uppercase leading-none">{cat.subCategories?.length || 0} {t('subCategories')}</span><ChevronDown size={10} className={`text-gray-400 transition-transform ${expandingCategoryId === cat.id ? 'rotate-180' : ''}`} /></div>
                           </div>
                           <div className="flex gap-1"><button onClick={() => { setEditingCategoryId(cat.id); setEditCategoryName(cat.name); }} className="p-2.5 text-gray-400 hover:text-blue-600 active:scale-90"><Edit2 size={16}/></button><button onClick={(e) => { e.stopPropagation(); initiateCategoryDelete(cat); }} className="p-2.5 text-red-400 hover:text-red-600 active:scale-90"><Trash2 size={16}/></button></div>
                         </>
                       )}
                     </div>
                     {expandingCategoryId === cat.id && (
                       <div className="bg-gray-50 dark:bg-gray-900/50 p-5 border-t border-gray-50 dark:border-gray-800 animate-in slide-in-from-top duration-300">
                          <div className="flex flex-wrap gap-2 mb-4">
                             {(cat.subCategories || []).map((sub, idx) => (
                               <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm animate-in zoom-in"><span className="text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase">{t(sub)}</span><button onClick={() => { const next = cat.subCategories.filter((_, i) => i !== idx); updateCategory({ ...cat, subCategories: next }); }} className="text-gray-400 hover:text-red-500"><X size={12} /></button></div>
                             ))}
                          </div>
                          <div className="flex gap-2"><input value={newSubCategory} onChange={e => setNewSubCategory(e.target.value)} placeholder={t('addLabel')} className="flex-1 p-3 text-[10px] font-bold bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl outline-none" /><button onClick={() => { if(newSubCategory) { updateCategory({...cat, subCategories: [...(cat.subCategories || []), newSubCategory]}); setNewSubCategory(''); } }} className="px-4 bg-gray-800 dark:bg-blue-600 text-white rounded-xl active:scale-90 transition-all"><Plus size={16}/></button></div>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
               <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm mt-4"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">{t('newCategoryGroup')}</p><div className="flex gap-2"><input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder={t('healthFitnessExample')} className="flex-1 p-4 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500/20 rounded-2xl text-[12px] font-bold outline-none dark:text-white transition-all shadow-inner" /><button onClick={() => { if(newCategoryName) { addCategory({name: newCategoryName, type: categoryType, subCategories: []}); setNewCategoryName(''); } }} className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-90"><Plus size={20}/></button></div></div>
            </section>
          </div>
        );
      case 'budgets':
        return (
          <div className="animate-in slide-in-from-right duration-300 max-w-lg mx-auto pb-10">
            {renderHeader(t('setBudget'))}
            <section className="space-y-4 px-1">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 leading-none">{t('globalMonthlyBudget')}</p>
                    <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-gray-400 text-xl">{settings.currency}</span>
                        <input type="number" value={budget || ''} onChange={e => updateBudget(parseFloat(e.target.value) || 0)} className="w-full pl-24 p-5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-3xl text-3xl font-black dark:text-white outline-none shadow-inner" placeholder="0.00" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-5">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 leading-none">{t('categorySpecificLimits')}</h3>
                    <div className="space-y-2">
                      {categories.filter(c => c.type === 'expense').map(cat => {
                        const currentLimit = categoryBudgets.find(b => b.categoryId === cat.id)?.amount || 0;
                        return (
                          <div key={cat.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-transparent hover:border-blue-50 dark:hover:border-blue-900/20 transition-all group">
                             <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-black dark:text-white uppercase leading-none truncate">{t(cat.name)}</p>
                             </div>
                             <div className="w-32 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-gray-400 text-[10px]">{settings.currency}</span>
                                <input type="number" value={currentLimit || ''} onChange={e => updateCategoryBudget(cat.id, parseFloat(e.target.value) || 0)} className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-black dark:text-white outline-none shadow-sm focus:border-blue-500 transition-colors" />
                             </div>
                          </div>
                        );
                      })}
                    </div>
                </div>
            </section>
          </div>
        );
      default:
        return (
          <div className="space-y-6 max-w-lg mx-auto pb-10">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter uppercase leading-none pt-2 px-2">{t('appPrefs')}</h1>
            <div className="grid grid-cols-1 gap-3 px-1">
               {[
                 { id: 'wallets', label: t('familyManagement'), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
                 { id: 'regional', label: t('languageCurrency'), icon: Globe, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                 { id: 'appearance', label: t('interfaceStyling'), icon: Palette, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                 { id: 'categories', label: t('categoriesLabels'), icon: Tags, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
                 { id: 'accounts', label: t('bankAccounts'), icon: Banknote, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                 { id: 'sync', label: t('cloudSync'), icon: CloudUpload, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
                 { id: 'dashboard', label: t('displayLayout'), icon: LayoutDashboard, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                 { id: 'budgets', label: t('setBudget'), icon: Target, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
               ].map((item) => (
                 <button key={item.id} onClick={() => setActiveSubView(item.id as any)} className="w-full flex items-center justify-between p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-50 dark:border-gray-700/50 active:scale-[0.98] transition-all group shadow-sm hover:shadow-md"><div className="flex items-center gap-4 text-left"><div className={`p-3.5 ${item.bg} ${item.color} rounded-2xl shadow-sm group-hover:scale-105 transition-transform`}><item.icon size={22} /></div><div><p className="text-[14px] font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight leading-none">{item.label}</p></div></div><ChevronRight size={20} className="text-gray-300 dark:text-gray-600 group-hover:translate-x-1 transition-transform" /></button>
               ))}
            </div>
            <div className="pt-4 px-4"><button onClick={() => { if(window.confirm("WARNING: Clear all local data?")) resetPreferences(); }} className="w-full py-5 text-gray-400 hover:text-red-500 transition-colors text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 bg-gray-50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 active:scale-95 transition-all"><RotateCcw size={16}/> {t('factoryReset')}</button></div>
          </div>
        );
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24 min-h-full overflow-x-hidden">
      {renderSubViewContent()}

      {/* --- CUSTOM DELETE CONFIRMATION MODAL --- */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in" onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 flex flex-col items-center animate-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl flex items-center justify-center mb-6">
               <Trash2 size={32} />
            </div>
            
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tight text-center leading-none">
              {t('deleteConfirm')}?
            </h3>
            
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 text-center mb-1">
              {deleteModal.message}
            </p>
            
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 text-center mb-8 leading-relaxed max-w-[240px]">
              {deleteModal.subMessage}
            </p>
            
            <div className="grid grid-cols-2 gap-3 w-full">
              <button 
                onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                className="py-4 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="py-4 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-red-500/20 active:scale-95 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
