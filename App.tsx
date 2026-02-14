
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Account from './pages/Account';
import TransactionModal from './components/TransactionModal';
import { Transaction, TransactionType } from './types';
import { CloudDownload, Database, HardDrive, RefreshCw, X, Check, ArrowRightLeft, Loader2 } from 'lucide-react';

const RestorePromptModal = () => {
  const { syncState, restoreBackup, t } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!syncState.pendingRestoreAvailable) return null;

  const handleStrategy = async (strategy: 'merge' | 'replace' | 'skip') => {
    setIsProcessing(true);
    await restoreBackup(strategy);
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-md p-6 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 flex flex-col items-center animate-in zoom-in duration-300">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
           <CloudDownload size={32} />
        </div>
        
        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight text-center">{t('syncConflict')}</h3>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-8 leading-relaxed font-medium text-center">
          {t('foundBackup')}
        </p>
        
        <div className="w-full space-y-3">
          <button 
            onClick={() => handleStrategy('merge')} 
            disabled={isProcessing}
            className="w-full p-4 bg-blue-600 text-white rounded-2xl flex items-center gap-4 active:scale-95 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            <div className="p-2 bg-white/20 rounded-xl"><ArrowRightLeft size={18} /></div>
            <div className="text-left">
              <p className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">{t('mergeData')}</p>
              <p className="text-[9px] font-bold text-blue-100 leading-none">{t('keepBoth')}</p>
            </div>
          </button>

          <button 
            onClick={() => handleStrategy('replace')} 
            disabled={isProcessing}
            className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-2xl flex items-center gap-4 active:scale-95 transition-all disabled:opacity-50"
          >
            <div className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 rounded-xl"><RefreshCw size={18} /></div>
            <div className="text-left">
              <p className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">{t('cloudOnly')}</p>
              <p className="text-[9px] font-bold text-gray-400 leading-none">{t('overwriteLocal')}</p>
            </div>
          </button>

          <button 
            onClick={() => handleStrategy('skip')} 
            disabled={isProcessing}
            className="w-full p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl flex items-center gap-4 active:scale-95 transition-all disabled:opacity-50"
          >
            <div className="p-2 bg-gray-100 dark:get-gray-700 text-gray-400 rounded-xl"><HardDrive size={18} /></div>
            <div className="text-left">
              <p className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">{t('keepLocal')}</p>
              <p className="text-[9px] font-bold text-gray-400 leading-none">{t('ignoreCloud')}</p>
            </div>
          </button>
        </div>
        
        {isProcessing && (
          <div className="mt-6 flex items-center gap-2 text-blue-600">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">{t('synchronizing')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { syncState, settings, isResetting, t } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalType, setModalType] = useState<TransactionType>('expense');

  // Handle Theme, Font Size, and Language Direction
  useEffect(() => {
    const root = window.document.documentElement;
    
    // 1. Theme Logic
    const isDark = settings.theme === 'dark' || 
                  (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      root.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    
    // Update theme-color for PWA header experience
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#111827' : '#3b82f6');
    }
    
    // 2. High-Fidelity Font Scaling
    const scaleMap: Record<string, string> = { small: '0.85', medium: '1.0', large: '1.15' };
    const scale = scaleMap[settings.fontSize] || '1.0';
    (root.style as any).zoom = scale;

    // 3. RTL Support for Arabic
    if (settings.language === 'ar') {
      root.setAttribute('dir', 'rtl');
    } else {
      root.setAttribute('dir', 'ltr');
    }
    
    // Handle Browser Auto-Theme Listeners
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      if (settings.theme === 'auto') {
        const autoIsDark = mediaQuery.matches;
        root.classList.toggle('dark', autoIsDark);
        document.body.classList.toggle('dark', autoIsDark);
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);
    
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, [settings.theme, settings.fontSize, settings.language]);

  const handleOpenAdd = (type: TransactionType = 'expense') => {
    setEditingTransaction(null);
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setModalType(tx.type);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setEditingTransaction(null);
      setModalType('expense');
    }, 300);
  };

  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout onOpenAddModal={() => handleOpenAdd('expense')} />}>
            <Route index element={<Dashboard onEditTransaction={handleEdit} onQuickAction={handleOpenAdd} />} />
            <Route path="reports" element={<Reports onEditTransaction={handleEdit} />} />
            <Route path="settings" element={<Settings />} />
            <Route path="account" element={<Account />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        
        <TransactionModal 
          isOpen={isModalOpen} 
          onClose={handleClose} 
          editTransaction={editingTransaction}
          initialType={modalType}
        />
      </HashRouter>
      <RestorePromptModal />
    </>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
