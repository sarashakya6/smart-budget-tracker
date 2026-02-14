
import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Activity, Heart, Zap, Sparkles, 
  ArrowUpRight, ArrowDownRight, ArrowRightLeft, LayoutGrid,
  ChevronRight, List, RefreshCw, Edit2, Trash2, Loader2, BadgeCheck,
  Target, BarChart3, X, CloudOff, Cloud, Check
} from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { FinancialOverviewChart } from '../components/Charts';

interface DashboardProps {
  onEditTransaction: (t: Transaction) => void;
  onQuickAction: (type: TransactionType) => void;
}

const DASHBOARD_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const Dashboard: React.FC<DashboardProps> = ({ onEditTransaction, onQuickAction }) => {
  const { 
    transactions, accounts, settings, budget, categoryBudgets, formatPrice, 
    aiInsight, refreshAIInsights, syncState, deleteTransaction, isAIAnalysing,
    categories, t, getAccountBalance
  } = useApp();
  
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-load AI Insights when online, logged in, or app opens (component mounts)
  useEffect(() => {
    if (syncState.isOnline && settings.showAIInsightsOnDashboard) {
       // Pass false to use throttling (only load if expired or missing)
       refreshAIInsights(false);
    }
  }, [syncState.isOnline, syncState.isLoggedIn, settings.showAIInsightsOnDashboard, refreshAIInsights]); 

  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    const monthlyExpenses = transactions
      .filter(tx => tx.type === 'expense' && new Date(tx.date) >= startOfMonth)
      .reduce((s, tx) => s + tx.amount, 0);

    const monthlyIncome = transactions
      .filter(tx => tx.type === 'income' && new Date(tx.date) >= startOfMonth)
      .reduce((s, tx) => s + tx.amount, 0);

    const combinedTotal = transactions.reduce((acc, tx) => {
        if (tx.type === 'income') return acc + tx.amount;
        if (tx.type === 'expense') return acc - tx.amount;
        return acc;
    }, 0);

    const chartDataMap: Record<string, number> = {};
    transactions
      .filter(tx => tx.type === 'expense' && new Date(tx.date) >= thirtyDaysAgo)
      .forEach(tx => {
        const catName = categories.find(c => c.id === tx.categoryId)?.name || 'Other';
        chartDataMap[catName] = (chartDataMap[catName] || 0) + tx.amount;
    });

    const spentByCategory: Record<string, number> = {};
    transactions
      .filter(tx => tx.type === 'expense' && new Date(tx.date) >= startOfMonth)
      .forEach(tx => {
        if (tx.categoryId) {
          spentByCategory[tx.categoryId] = (spentByCategory[tx.categoryId] || 0) + tx.amount;
        }
      });

    const recent = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);

    return {
      monthlyExpenses, 
      monthlyIncome, 
      combinedTotal,
      recent,
      chartData: Object.entries(chartDataMap).map(([name, value]) => ({ name: t(name), value })),
      health: Math.round(budget > 0 ? Math.max(0, 100 - (monthlyExpenses / budget * 100)) : 100),
      spentByCategory
    };
  }, [transactions, budget, categories, t]);

  const smartFormatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (d.getTime() === today.getTime()) return t('today');
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.getTime() === yesterday.getTime()) return t('yesterday');
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handlePerformDelete = async () => {
    if (!selectedTx || isDeleting) return;
    
    setIsDeleting(true);
    const txId = selectedTx.id;
    setSelectedTx(null);
    
    try {
      await deleteTransaction(txId);
    } catch (e) {
      console.error("Delete failed in dashboard", e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24 relative max-w-lg mx-auto overflow-x-hidden">
      {/* HEADER */}
      <header className="flex items-start justify-between pt-1 px-1">
        <div className="flex flex-col items-start gap-1.5">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter uppercase leading-none">{t('appTitle')}</h1>
            
            {syncState.isLoggedIn && (
              <div className="flex items-center gap-2">
                {syncState.unsyncedChanges && (
                  <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
                    <CloudOff size={10} className="text-amber-600 dark:text-amber-400" />
                    <span className="text-[8px] font-black uppercase text-amber-600 dark:text-amber-400">Wait Upload</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700 shadow-sm">
                    <BadgeCheck size={10} className={syncState.isOnline ? 'text-blue-500' : 'text-gray-400'} />
                    <span className="text-[9px] font-black uppercase text-gray-400">{syncState.isOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            )}
        </div>
        
        <div className="w-10 h-10 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl flex items-center justify-center text-gray-400 shadow-sm active:scale-90 transition-transform cursor-pointer" onClick={() => window.location.hash = '#/settings'}>
          <LayoutGrid size={22} />
        </div>
      </header>

      {/* SUMMARY SECTION */}
      {settings.showBudgetOnDashboard && (
        <section className="bg-white dark:bg-gray-800 rounded-[1.75rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="flex divide-x divide-gray-100 dark:divide-gray-700">
            {[
              { label: t('balance'), value: stats.combinedTotal, color: 'text-gray-900 dark:text-white' },
              { label: t('income'), value: stats.monthlyIncome, color: 'text-green-600' },
              { label: t('expense'), value: stats.monthlyExpenses, color: 'text-red-600' }
            ].map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center justify-center py-4 px-2 text-center">
                <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 leading-none">{item.label}</span>
                <span className={`text-lg font-black leading-none ${item.color}`}>
                  {formatPrice(item.value)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ACCOUNTS SECTION */}
      {settings.showAccountsOnDashboard && accounts.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
           <div className="flex divide-x divide-gray-100 dark:divide-gray-700 overflow-x-auto no-scrollbar">
             {accounts.map(acc => (
               <div key={acc.id} className="flex-none min-w-[120px] flex flex-col items-center justify-center py-3.5 px-5 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 leading-none truncate w-full text-center">{t(acc.name)}</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white leading-none">{formatPrice(getAccountBalance(acc.id))}</span>
               </div>
             ))}
           </div>
        </section>
      )}

      {/* AI INSIGHTS */}
      {settings.showAIInsightsOnDashboard && (
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-4 rounded-[2rem] border border-blue-100 dark:border-blue-900/20 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
                   <Sparkles size={14} fill="currentColor" className="text-blue-500" />
                </div>
                <h3 className="text-[11px] font-black text-blue-800 dark:text-blue-200 uppercase tracking-widest leading-none">{t('aiAnalysis')}</h3>
              </div>
              <button onClick={() => refreshAIInsights(true)} disabled={isAIAnalysing} className="p-2 bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-all active:scale-90 shadow-sm disabled:opacity-50">
                <RefreshCw size={14} className={`text-blue-600 dark:text-blue-400 ${isAIAnalysing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="min-h-[50px]">
              {isAIAnalysing ? (
                <div className="flex flex-col items-center justify-center py-3 gap-2 text-blue-400/70">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Generating Insights...</span>
                </div>
              ) : aiInsight ? (
                 <div className="space-y-1.5">
                    {/* Fixed shadowing of 't' variable */}
                    {aiInsight.includes('•') ? (
                        aiInsight.split('•').filter(str => str.trim().length > 0).map((tip, idx) => (
                            <div key={idx} className="flex gap-2 items-start bg-white/60 dark:bg-black/20 p-2.5 rounded-xl border border-blue-100/50 dark:border-blue-800/30 animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                <div className="mt-0.5 w-3.5 h-3.5 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400">
                                    <Check size={8} strokeWidth={4} />
                                </div>
                                <p className="text-[11px] font-bold text-blue-900 dark:text-blue-100 leading-tight">{tip.trim()}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs font-bold text-blue-900 dark:text-blue-100 leading-relaxed italic px-1">{aiInsight}</p>
                    )}
                 </div>
              ) : (
                <div onClick={() => refreshAIInsights(true)} className="flex items-center justify-center py-5 text-blue-400/50 hover:text-blue-500 cursor-pointer transition-colors border-2 border-dashed border-blue-200 dark:border-blue-900/30 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest">Tap to analyze finances</span>
                </div>
              )}
            </div>
        </section>
      )}

      <div className="space-y-4">
        {settings.showFinancialOverviewChart && stats.chartData.length > 0 && (
          <section className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
             <div className="flex items-center gap-2 mb-3.5 px-1">
               <Zap size={16} className="text-blue-500" />
               <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] leading-none">{t('dataInsights')}</h3>
             </div>
             <div className="h-48 w-full">
                <FinancialOverviewChart 
                  data={stats.chartData} 
                  colors={DASHBOARD_COLORS} 
                  currency={settings.currency} 
                  isDark={settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)} 
                  remaining={stats.combinedTotal} 
                  totalIncome={stats.monthlyIncome} 
                  t={t} 
                />
             </div>
          </section>
        )}

        {settings.showQuickActionsOnDashboard && (
          <section className="grid grid-cols-4 gap-3.5 px-0.5">
            {[
              { icon: ArrowDownRight, label: t('income'), type: 'income', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
              { icon: ArrowUpRight, label: t('expense'), type: 'expense', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
              { icon: ArrowRightLeft, label: t('transfer'), type: 'transfer', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { icon: List, label: t('all'), type: 'reports', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' }
            ].map((action, i) => (
              <button key={i} onClick={() => action.type === 'reports' ? (window.location.hash = '#/reports') : onQuickAction(action.type as any)} className="flex flex-col items-center group">
                <div className={`w-full py-3.5 flex items-center justify-center rounded-[1.25rem] ${action.bg} ${action.color} border border-transparent active:scale-95 transition-all shadow-sm mb-2`}><action.icon size={22} /></div>
                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-tighter leading-none">{action.label}</span>
              </button>
            ))}
          </section>
        )}

        {/* FINANCIAL HEALTH */}
        <div className="space-y-4">
           {settings.showFinancialHealthScore && budget > 0 && (
             <section className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-[2rem] p-5 text-white flex items-center justify-between shadow-lg border border-white/10">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-inner"><Heart size={20} fill="currentColor" /></div>
                 <div>
                   <p className="text-[11px] font-black text-blue-100 uppercase tracking-[0.1em] mb-1 leading-none">{t('budgetHealth')}</p>
                   <p className="text-2xl font-black leading-none">{stats.health}%</p>
                 </div>
               </div>
               <div className="bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/5">
                 <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 leading-none">{stats.health > 70 ? t('safe') : t('alert')}</p>
               </div>
             </section>
           )}

           {settings.showBudgetOnDashboard && budget > 0 && (
             <section className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
               <div className="flex justify-between items-center mb-3 px-1">
                  <div className="flex items-center gap-2">
                     <Target size={16} className="text-blue-500" />
                     <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('monthlyForecast')}</span>
                  </div>
                  <span className="text-sm font-black text-gray-900 dark:text-white">{formatPrice(stats.monthlyExpenses)} / {formatPrice(budget)}</span>
               </div>
               <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full transition-all duration-1000 ${stats.health < 20 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]'}`} 
                    style={{ width: `${Math.min(100, (stats.monthlyExpenses / budget) * 100)}%` }} 
                  />
               </div>
             </section>
           )}

           {settings.showCategoryBudgetsOnDashboard && categoryBudgets.length > 0 && (
             <section className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                <div className="flex items-center gap-2 px-1">
                   <Target size={16} className="text-purple-500" />
                   <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('categoryBudgets')}</h3>
                </div>
                <div className="space-y-4">
                   {categoryBudgets.map(cb => {
                      const cat = categories.find(c => c.id === cb.categoryId);
                      if (!cat) return null;
                      const spent = stats.spentByCategory[cat.id] || 0;
                      const pct = Math.min(100, (spent / cb.amount) * 100);
                      
                      return (
                         <div key={cb.categoryId}>
                            <div className="flex justify-between text-[11px] font-bold mb-1.5">
                               <span className="text-gray-700 dark:text-gray-200">{t(cat.name)}</span>
                               <span className={spent > cb.amount ? "text-red-500" : "text-gray-500"}>{formatPrice(spent)} / {formatPrice(cb.amount)}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                               <div className={`h-full rounded-full transition-all duration-500 ${spent > cb.amount ? 'bg-red-500' : 'bg-purple-500'}`} style={{ width: `${pct}%` }}></div>
                            </div>
                         </div>
                      )
                   })}
                </div>
             </section>
           )}
        </div>

        {/* RECENT ACTIVITY */}
        <section className="space-y-4 pb-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-blue-500" />
              <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">{t('recentActivity')}</h3>
            </div>
            <button onClick={() => window.location.hash = '#/reports'} className="text-[11px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5">{t('seeAll')} <ChevronRight size={14} /></button>
          </div>
          <div className="space-y-2.5">
             {stats.recent.map(tx => {
                const cat = categories.find(c => c.id === tx.categoryId);
                const categoryLabel = cat?.name ? t(cat.name) : (tx.type === 'transfer' ? t('transfer') : t(tx.type));
                const displayLabel = tx.subCategory ? `${categoryLabel} > ${t(tx.subCategory)}` : categoryLabel;

                return (
                  <div key={tx.id} onClick={() => setSelectedTx(tx)} className="bg-white dark:bg-gray-800 py-4 px-5 rounded-[1.75rem] border border-gray-100 dark:border-gray-700 flex justify-between items-center shadow-sm active:scale-[0.99] transition-all cursor-pointer group">
                      <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${tx.type === 'income' ? 'bg-green-500' : tx.type === 'expense' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                          <div className="min-w-0">
                              <p className="font-black text-[15px] text-gray-800 dark:text-gray-100 truncate leading-tight group-hover:text-blue-600 transition-colors">
                                  {displayLabel}
                              </p>
                              <div className="flex items-center gap-2.5 mt-1.5">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-tight leading-none">{smartFormatDate(tx.date)}</span>
                                {tx.note && <span className="text-xs text-gray-400 truncate max-w-[150px] font-medium leading-none">• {tx.note}</span>}
                              </div>
                          </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                          <p className={`font-black text-[15px] leading-none ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{tx.type === 'expense' ? '-' : '+'}{formatPrice(tx.amount)}</p>
                      </div>
                  </div>
                );
             })}
          </div>
        </section>
      </div>

      {/* OPTIONS MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in" onClick={() => !isDeleting && setSelectedTx(null)}>
           <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-[3rem] p-7 pb-14 space-y-5 animate-in slide-in-from-bottom duration-300 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-2 mb-2">
                 <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                 <div className="flex items-center justify-between w-full">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none">Entry Protocol</p>
                    <button onClick={() => setSelectedTx(null)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400 hover:text-gray-900 transition-colors"><X size={18}/></button>
                 </div>
              </div>

              <div className="p-5 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700 flex justify-between items-center mb-2 shadow-inner">
                 <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${selectedTx.type === 'income' ? 'bg-green-100 text-green-600 shadow-sm' : 'bg-red-100 text-red-600 shadow-sm'}`}>
                      {selectedTx.type === 'income' ? <ArrowDownRight size={24}/> : <ArrowUpRight size={24}/>}
                    </div>
                    <div className="min-w-0">
                       <p className="text-[15px] font-black text-gray-900 dark:text-white uppercase truncate tracking-tight">
                          {categories.find(c => c.id === selectedTx.categoryId)?.name ? t(categories.find(c => c.id === selectedTx.categoryId)!.name) : t(selectedTx.type)}
                       </p>
                       <p className="text-xs font-bold text-gray-400 uppercase mt-1 tracking-widest">{smartFormatDate(selectedTx.date)}</p>
                    </div>
                 </div>
                 <p className={`text-lg font-black ${selectedTx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedTx.type === 'income' ? '+' : '-'}{formatPrice(selectedTx.amount)}
                 </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  disabled={isDeleting}
                  onClick={() => { onEditTransaction(selectedTx); setSelectedTx(null); }} 
                  className="p-6 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-[2.25rem] flex flex-col items-center gap-4 shadow-sm active:scale-95 transition-all group hover:border-blue-200"
                >
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/40 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform"><Edit2 size={28} /></div>
                  <div className="text-center">
                    <p className="text-xs font-black uppercase tracking-widest leading-none mb-1.5">Modify</p>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Change record</p>
                  </div>
                </button>
                
                <button 
                  disabled={isDeleting}
                  onClick={handlePerformDelete} 
                  className="p-6 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-[2.25rem] flex flex-col items-center gap-4 shadow-sm active:scale-95 transition-all group hover:border-red-500"
                >
                  <div className="p-4 bg-red-50 dark:bg-red-900/40 text-red-600 rounded-2xl group-hover:scale-110 transition-transform shadow-sm">
                    {isDeleting ? <Loader2 size={28} className="animate-spin" /> : <Trash2 size={28} />}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black uppercase tracking-widest leading-none mb-1.5">Destroy</p>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Remove Forever</p>
                  </div>
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
