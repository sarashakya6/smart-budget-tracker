
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  FileText, FileSpreadsheet, Search, Upload, BarChart2, 
  PieChart as PieChartIcon, Calendar, Clock, CalendarRange, 
  Layers, Settings2, TrendingUp, Info, Sparkles, X,
  ArrowDownRight, ArrowUpRight, LayoutGrid, Edit2, Trash2, Loader2,
  ArrowUp, ArrowDown, Scale, Calculator, Minus, Bot, RefreshCw, AlignLeft
} from 'lucide-react';
import { exportToExcel, exportToPDF, parseExcelImport } from '../services/exportService';
import { FlowBarChart, FinancialOverviewChart, TrendLineChart, SpendingHeatmap } from '../components/Charts';
import { Transaction } from '../types';
import { GoogleGenAI } from "@google/genai";

type FilterType = 'today' | 'week' | 'month' | 'custom' | 'all';
type ChartType = 'bar' | 'pie' | 'line' | 'heatmap';
type ReportMode = 'standard' | 'advanced';
type ComparisonPreset = 'weekly' | 'monthly' | '3month' | '6month' | 'custom';

interface DrillDownState {
  type: 'category' | 'date';
  value: string; // Category Name or Date String
  label: string; // Display label
}

interface ReportsProps {
  onEditTransaction: (t: Transaction) => void;
}

const COLORS = ['#ff3b30', '#0072d6', '#ff9500', '#75d9ff', '#af52de', '#ffcc00', '#001d3d', '#4cd9c0', '#32d74b'];

const Reports: React.FC<ReportsProps> = ({ onEditTransaction }) => {
  const { transactions, categories, accounts, settings, formatPrice, t, importTransactions, deleteTransaction } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [reportMode, setReportMode] = useState<ReportMode>('standard');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);

  // Advanced Comparison State
  const [comparisonPreset, setComparisonPreset] = useState<ComparisonPreset>('monthly');
  const [customPeriodA, setCustomPeriodA] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [customPeriodB, setCustomPeriodB] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });
  
  // AI Analysis State
  const [reportInsight, setReportInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (settings.defaultReportView) {
      const map: Record<string, FilterType> = { 'daily': 'today', 'weekly': 'week', 'monthly': 'month', 'custom': 'custom', 'all': 'all' };
      setFilterType(map[settings.defaultReportView] || 'all');
    }
    // Only set default chart type if valid
    if (settings.reportChartType && ['bar', 'pie', 'line'].includes(settings.reportChartType)) {
        setChartType(settings.reportChartType as ChartType);
    }
  }, [settings.defaultReportView, settings.reportChartType]);

  // Reset drilldown when main filter changes
  useEffect(() => {
    setDrillDown(null);
  }, [filterType, customStart, customEnd, reportMode, searchTerm]);

  // Reset AI insight when periods change
  useEffect(() => {
    setReportInsight(null);
  }, [comparisonPreset, customPeriodA, customPeriodB]);

  const smartFormatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (d.getTime() === today.getTime()) return t('today');
    if (d.getTime() === yesterday.getTime()) return t('yesterday');
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Helper: robustly find category even if ID is missing (orphaned import), by checking subcategory
  const getTxCategory = (tx: Transaction) => {
    let cat = categories.find(c => c.id === tx.categoryId);
    if (!cat && tx.subCategory) {
        // Fallback: Try to find category that contains this subcategory
        cat = categories.find(c => c.subCategories.includes(tx.subCategory || ''));
    }
    return cat;
  };

  // --- STANDARD MODE DATA ---
  const baseFilteredTransactions = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Sort descending by date
    const sortedSource = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return sortedSource.filter(tx => {
      // 1. Search Filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const cat = getTxCategory(tx);
        const matches = (tx.note || '').toLowerCase().includes(term) || 
                       (tx.amount.toString().includes(term)) ||
                       (cat?.name.toLowerCase().includes(term)) ||
                       (tx.subCategory?.toLowerCase().includes(term));
        if (!matches) return false;
      }

      // 2. Time Filter
      if (filterType === 'all') return true;
      const d = new Date(tx.date);
      const txMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

      if (filterType === 'today') return txMidnight === todayMidnight;
      if (filterType === 'week') {
         const weekAgo = todayMidnight - (7 * 24 * 60 * 60 * 1000);
         return txMidnight >= weekAgo;
      }
      if (filterType === 'month') {
         return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (filterType === 'custom' && customStart && customEnd) {
         const start = new Date(customStart).getTime();
         const end = new Date(customEnd).getTime();
         return txMidnight >= start && txMidnight <= end;
      }
      return true;
    });
  }, [transactions, searchTerm, filterType, customStart, customEnd, categories]);

  // Drill-Down Filtered Transactions - Feeds List
  const displayedTransactions = useMemo(() => {
    if (!drillDown) return baseFilteredTransactions;

    return baseFilteredTransactions.filter(tx => {
      if (drillDown.type === 'category') {
        const cat = getTxCategory(tx);
        // If category found, check name. If not found, check subcategory (orphaned case)
        const catName = cat ? t(cat.name) : (tx.subCategory || 'Uncategorized');
        return catName === drillDown.value;
      }
      if (drillDown.type === 'date') {
        // Match Date String (YYYY-MM-DD)
        return tx.date.startsWith(drillDown.value);
      }
      return true;
    });
  }, [baseFilteredTransactions, drillDown, categories, t]);

  const chartData = useMemo(() => {
    if (chartType === 'pie') {
      const catMap: Record<string, number> = {};
      baseFilteredTransactions.filter(tx => tx.type === 'expense').forEach(tx => {
        const cat = getTxCategory(tx);
        // Improved Fallback: Use category name if found, otherwise use subCategory if available, else 'Uncategorized'
        const rawName = cat ? cat.name : (tx.subCategory || 'cat_uncategorized');
        
        // If it's a known translation key, use it, otherwise show raw (e.g. custom import)
        const displayKey = t(rawName); 
        catMap[displayKey] = (catMap[displayKey] || 0) + tx.amount;
      });
      return Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    } 
    else if (chartType === 'bar') {
      const dateMap: Record<string, { income: number; expense: number; date: string }> = {};
      baseFilteredTransactions.forEach(tx => {
         const dateKey = tx.date.split('T')[0]; 
         if (!dateMap[dateKey]) dateMap[dateKey] = { income: 0, expense: 0, date: tx.date };
         if (tx.type === 'income') dateMap[dateKey].income += tx.amount;
         else if (tx.type === 'expense') dateMap[dateKey].expense += tx.amount;
      });
      return Object.values(dateMap).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-14); 
    } 
    else if (chartType === 'line') {
       const monthlyData: Record<string, { income: number; expense: number; month: string }> = {};
       baseFilteredTransactions.forEach(tx => {
         const d = new Date(tx.date);
         const key = d.toLocaleString('default', { month: 'short' });
         if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0, month: key };
         if (tx.type === 'income') monthlyData[key].income += tx.amount;
         else if (tx.type === 'expense') monthlyData[key].expense += tx.amount;
       });
       return Object.values(monthlyData);
    }
    return [];
  }, [baseFilteredTransactions, chartType, categories, t]);

  // --- ADVANCED COMPARISON LOGIC ---
  const comparisonRanges = useMemo(() => {
    const now = new Date();
    const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const getEndOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

    let startA: Date, endA: Date, startB: Date, endB: Date;
    let labelA = '', labelB = '';

    if (comparisonPreset === 'weekly') {
        endA = now;
        startA = new Date(now); startA.setDate(now.getDate() - 6);
        endB = new Date(startA); endB.setDate(startA.getDate() - 1);
        startB = new Date(endB); startB.setDate(endB.getDate() - 6);
        labelA = 'Last 7 Days'; labelB = 'Previous 7 Days';
    } else if (comparisonPreset === 'monthly') {
        startA = getStartOfMonth(now); endA = now;
        startB = new Date(now); startB.setMonth(now.getMonth() - 1); startB.setDate(1);
        endB = new Date(startB.getFullYear(), startB.getMonth() + 1, 0);
        labelA = 'Current Month'; labelB = 'Last Month';
    } else if (comparisonPreset === '3month') {
        endA = now; startA = new Date(now); startA.setMonth(now.getMonth() - 3);
        endB = new Date(startA); endB.setDate(endB.getDate() - 1);
        startB = new Date(endB); startB.setMonth(endB.getMonth() - 3);
        labelA = 'Last 3 Months'; labelB = 'Previous 3 Months';
    } else if (comparisonPreset === '6month') {
        endA = now; startA = new Date(now); startA.setMonth(now.getMonth() - 6);
        endB = new Date(startA); endB.setDate(endB.getDate() - 1);
        startB = new Date(endB); startB.setMonth(endB.getMonth() - 6);
        labelA = 'Last 6 Months'; labelB = 'Previous 6 Months';
    } else {
        const dA = new Date(customPeriodA); startA = getStartOfMonth(dA); endA = getEndOfMonth(dA);
        const dB = new Date(customPeriodB); startB = getStartOfMonth(dB); endB = getEndOfMonth(dB);
        labelA = customPeriodA; labelB = customPeriodB;
    }

    return { rangeA: { start: startA, end: endA, label: labelA }, rangeB: { start: startB, end: endB, label: labelB } };
  }, [comparisonPreset, customPeriodA, customPeriodB]);

  const getPeriodMetrics = (range: { start: Date, end: Date }) => {
     const txs = transactions.filter(t => { const d = new Date(t.date); return d >= range.start && d <= range.end; });
     const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
     const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
     const savings = income - expense;
     const savingsRate = income > 0 ? (savings / income) * 100 : 0;
     const catMap: Record<string, number> = {};
     txs.filter(t => t.type === 'expense').forEach(t => {
         const cat = getTxCategory(t);
         const catName = cat?.name || 'Unknown';
         catMap[catName] = (catMap[catName] || 0) + t.amount;
     });
     const topCat = Object.entries(catMap).sort((a,b) => b[1] - a[1])[0];
     return { income, expense, savings, savingsRate, topCategory: topCat ? `${topCat[0]} (${formatPrice(topCat[1])})` : 'None' };
  };

  const metricsA = useMemo(() => getPeriodMetrics(comparisonRanges.rangeA), [transactions, comparisonRanges, categories, formatPrice]);
  const metricsB = useMemo(() => getPeriodMetrics(comparisonRanges.rangeB), [transactions, comparisonRanges, categories, formatPrice]);

  const comparisonData = useMemo(() => {
     return { diffIncome: metricsA.income - metricsB.income, diffExpense: metricsA.expense - metricsB.expense, diffSavings: metricsA.savings - metricsB.savings };
  }, [metricsA, metricsB]);
  
  const categoryComparison = useMemo(() => {
    const getMap = (range: { start: Date, end: Date }) => {
        const map: Record<string, { amount: number, type: string }> = {};
        transactions.filter(t => {
            const d = new Date(t.date);
            return d >= range.start && d <= range.end && (t.type === 'income' || t.type === 'expense');
        }).forEach(t => {
            const cat = getTxCategory(t);
            const cid = cat?.id || 'uncategorized';
            if (!map[cid]) map[cid] = { amount: 0, type: t.type };
            map[cid].amount += t.amount;
            if (t.type !== 'transfer') map[cid].type = t.type;
        });
        return map;
    };
    const mapA = getMap(comparisonRanges.rangeA);
    const mapB = getMap(comparisonRanges.rangeB);
    const allIds = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
    const list = Array.from(allIds).map(id => {
      const cat = categories.find(c => c.id === id);
      const type = cat?.type || mapA[id]?.type || mapB[id]?.type || 'expense';
      const name = cat ? t(cat.name) : (id === 'uncategorized' ? t('cat_uncategorized') : t('cat_other'));
      const valA = mapA[id]?.amount || 0;
      const valB = mapB[id]?.amount || 0;
      const diff = valA - valB;
      const maxRowVal = Math.max(valA, valB);
      return { id, name, type, valA, valB, diff, maxRowVal };
    });
    return list.sort((a,b) => b.valA - a.valA);
  }, [transactions, comparisonRanges, categories, t]);

  const maxCategoryAmount = useMemo(() => Math.max(...categoryComparison.map(c => Math.max(c.valA, c.valB)), 1), [categoryComparison]);

  const handleGenerateAnalysis = async () => {
    setIsAnalyzing(true); setReportInsight(null);
    try {
        // Fix: Use process.env.API_KEY directly and create a new instance right before making an API call as per GenAI guidelines
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Act as a professional financial analyst. Compare these two time periods. Range A: Income ${metricsA.income}, Expense ${metricsA.expense}. Range B: Income ${metricsB.income}, Expense ${metricsB.expense}. Provide 3 distinct, professional insights. Keep it concise. Currency: ${settings.currency}.`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        setReportInsight(response.text || "Analysis complete but no insights returned.");
    } catch (e: any) { setReportInsight("Unable to generate analysis."); } finally { setIsAnalyzing(false); }
  };

  const handlePieClick = (data: any) => {
    if (drillDown?.type === 'category' && drillDown.value === data.name) { setDrillDown(null); } 
    else { setDrillDown({ type: 'category', value: data.name, label: data.name }); }
  };

  const handleBarClick = (data: any) => {
    if (!data.date) return;
    const dateStr = data.date.split('T')[0];
    if (drillDown?.type === 'date' && drillDown.value === dateStr) { setDrillDown(null); } 
    else {
        const displayDate = new Date(data.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        setDrillDown({ type: 'date', value: dateStr, label: displayDate });
    }
  };

  const handleHeatmapClick = (dateStr: string) => {
    if (drillDown?.type === 'date' && drillDown.value === dateStr) { setDrillDown(null); } 
    else {
        const displayDate = new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        setDrillDown({ type: 'date', value: dateStr, label: displayDate });
    }
  };

  const handleExport = (type: 'excel' | 'pdf') => {
      const context = { transactions: displayedTransactions, accounts, categories, currency: settings.currency, dateRangeTitle: `Filter: ${filterType}` };
      if (type === 'excel') exportToExcel(context); else exportToPDF(context);
  };

  const handlePerformDelete = async () => {
    if (!selectedTx || isDeleting) return;
    setIsDeleting(true);
    const txId = selectedTx.id;
    setSelectedTx(null);
    try { await deleteTransaction(txId); } catch (e) { console.error(e); } finally { setIsDeleting(false); }
  };

  const ComparisonBadge = ({ val, inverse = false }: { val: number, inverse?: boolean }) => {
     if (Math.abs(val) < 0.01) return <span className="text-gray-400 text-[10px] font-bold">-</span>;
     const isPositive = val > 0;
     const isGood = inverse ? !isPositive : isPositive; 
     return (
       <div className={`flex items-center gap-0.5 text-[10px] font-black ${isGood ? 'text-green-500' : 'text-red-500'}`}>
         {isPositive ? <ArrowUp size={10} strokeWidth={4} /> : <ArrowDown size={10} strokeWidth={4} />}
         {formatPrice(Math.abs(val))}
       </div>
     );
  };

  return (
    <div className="p-4 space-y-4 pb-24 relative max-w-lg mx-auto">
      <div className="flex flex-col gap-3 pt-1 px-1">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter uppercase leading-none">{t('reports')}</h1>
            <div className="flex gap-1.5">
              <input type="file" ref={fileInputRef} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) { try { importTransactions(await parseExcelImport(file, categories, accounts)); } catch (err) { alert('Import failed'); } }
                  if (fileInputRef.current) fileInputRef.current.value = '';
              }} className="hidden" accept=".xlsx,.xls" />
              <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-xl border border-gray-100 dark:border-gray-700 active:scale-95 transition-all shadow-sm"><Upload size={18}/></button>
              <button onClick={() => handleExport('excel')} className="w-9 h-9 flex items-center justify-center bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl border border-green-100 dark:border-green-900/30 active:scale-95 transition-all shadow-sm"><FileSpreadsheet size={18}/></button>
              <button onClick={() => handleExport('pdf')} className="w-9 h-9 flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl border border-red-100 dark:border-red-900/30 active:scale-95 transition-all shadow-sm"><FileText size={18}/></button>
            </div>
          </div>
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl shadow-inner border border-gray-100 dark:border-gray-800">
             <button onClick={() => setReportMode('standard')} className={`flex-1 py-2 text-[11px] font-black uppercase rounded-xl transition-all ${reportMode === 'standard' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-md' : 'text-gray-400'}`}>Standard</button>
             <button onClick={() => setReportMode('advanced')} className={`flex-1 py-2 text-[11px] font-black uppercase rounded-xl transition-all ${reportMode === 'advanced' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-md' : 'text-gray-400'}`}>Advanced</button>
          </div>
      </div>

      <div className="space-y-4 animate-in fade-in duration-500">
        
        {/* === STANDARD REPORT COMPONENTS === */}
        {reportMode === 'standard' && (
          <>
             <div className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                <div className="relative">
                    <Search className="absolute left-4 top-3.5 text-gray-300 dark:text-gray-600" size={18} />
                    <input type="text" placeholder={t('findTransaction')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-transparent focus:border-blue-500 rounded-[1.25rem] text-sm font-bold outline-none dark:text-white transition-all shadow-inner" />
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-900/50 p-1.5 rounded-[1.5rem] overflow-x-auto no-scrollbar gap-1.5 border border-gray-100 dark:border-gray-800">
                  {[
                    { label: t('all'), val: 'all', icon: Layers },
                    { label: t('today'), val: 'today', icon: Clock },
                    { label: t('week'), val: 'week', icon: CalendarRange },
                    { label: t('month'), val: 'month', icon: Calendar },
                    { label: t('custom'), val: 'custom', icon: Settings2 },
                  ].map((opt) => (
                    <button key={opt.val} onClick={() => setFilterType(opt.val as any)} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${filterType === opt.val ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-md border border-gray-50 dark:border-gray-700' : 'text-gray-400 dark:text-gray-500'}`}>
                      <opt.icon size={15} /> {opt.label}
                    </button>
                  ))}
                </div>
                {filterType === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 animate-in zoom-in duration-200">
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="p-3.5 bg-gray-50 dark:bg-gray-900 border rounded-2xl text-xs font-bold outline-none dark:text-white" />
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="p-3.5 bg-gray-50 dark:bg-gray-900 border rounded-2xl text-xs font-bold outline-none dark:text-white" />
                  </div>
                )}
            </div>

            {baseFilteredTransactions.length > 0 && (
              <section className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 space-y-4 animate-in slide-in-from-right duration-300">
                 <div className="flex items-center justify-between px-1">
                   <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">Visual Analytics</h3>
                   <div className="flex gap-2 bg-gray-50 dark:bg-gray-900/50 p-1 rounded-2xl">
                     <button onClick={() => setChartType('bar')} className={`p-2 rounded-xl transition-all ${chartType === 'bar' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-400'}`}><BarChart2 size={16}/></button>
                     <button onClick={() => setChartType('pie')} className={`p-2 rounded-xl transition-all ${chartType === 'pie' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-400'}`}><PieChartIcon size={16}/></button>
                     <button onClick={() => setChartType('line')} className={`p-2 rounded-xl transition-all ${chartType === 'line' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-400'}`}><TrendingUp size={16}/></button>
                     <button onClick={() => setChartType('heatmap')} className={`p-2 rounded-xl transition-all ${chartType === 'heatmap' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-400'}`}><LayoutGrid size={16}/></button>
                   </div>
                 </div>
                 
                 <div className="text-[9px] text-gray-400 text-center uppercase font-bold tracking-widest flex items-center justify-center gap-1.5 opacity-60">
                    <Info size={10} />
                    {chartType === 'heatmap' ? 'Tap a day to view details' : 'Tap chart elements to filter list'}
                 </div>

                 <div className="h-64 w-full bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] p-4 border border-gray-100 dark:border-gray-800 shadow-inner overflow-hidden">
                    {chartType === 'pie' ? (
                      <FinancialOverviewChart data={chartData} colors={COLORS} currency={settings.currency} isDark={settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)} remaining={0} totalIncome={0} t={t} onClick={handlePieClick} />
                    ) : chartType === 'bar' ? (
                      // Added missing colors prop to satisfy ChartProps requirements
                      <FlowBarChart data={chartData} colors={COLORS} currency={settings.currency} isDark={settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)} onClick={handleBarClick} />
                    ) : chartType === 'heatmap' ? (
                      <SpendingHeatmap transactions={baseFilteredTransactions} currency={settings.currency} isDark={settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)} onClick={handleHeatmapClick} />
                    ) : (
                      <TrendLineChart data={chartData} colors={COLORS} currency={settings.currency} isDark={settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)} onClick={handleBarClick} />
                    )}
                 </div>
              </section>
            )}

            {/* Transaction List */}
            <section className="space-y-3">
               <div className="flex items-center justify-between ml-2">
                  <div className="flex items-center gap-2">
                      <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">Transactions ({displayedTransactions.length})</h3>
                      {drillDown && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded-lg shadow-sm animate-in fade-in">
                              <span className="text-[9px] font-black uppercase tracking-wide">{drillDown.type === 'category' ? 'Cat' : 'Date'}: {drillDown.label}</span>
                              <button onClick={() => setDrillDown(null)} className="hover:bg-white/20 rounded-md p-0.5 transition-colors"><X size={10} /></button>
                          </div>
                      )}
                  </div>
               </div>
               
               <div className="space-y-2.5">
                  {displayedTransactions.map(tx => {
                    const cat = getTxCategory(tx);
                    // Match Dashboard logic: If cat matches, show it. If not, show Type or 'Transfer'.
                    const categoryLabel = cat 
                        ? t(cat.name) 
                        : (tx.type === 'transfer' ? t('transfer') : t(tx.type));
                    
                    // Match Dashboard logic: If subCategory exists, append it.
                    const displayLabel = tx.subCategory 
                        ? `${categoryLabel} > ${t(tx.subCategory)}` 
                        : categoryLabel;
                    
                    return (
                      <div key={tx.id} onClick={() => setSelectedTx(tx)} className="bg-white dark:bg-gray-800 p-5 rounded-[1.75rem] border border-gray-100 dark:border-gray-700 flex justify-between items-center shadow-sm cursor-pointer active:scale-[0.98] transition-all">
                          <div className="flex items-center gap-4 min-w-0">
                              <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${tx.type === 'income' ? 'bg-green-500' : tx.type === 'expense' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                              <div className="min-w-0">
                                  <p className="font-black text-[15px] text-gray-800 dark:text-gray-100 truncate leading-tight flex items-center gap-2">
                                      {displayLabel}
                                  </p>
                                  <p className="text-[10px] font-bold text-gray-400 mt-1.5 uppercase tracking-tight">
                                      {smartFormatDate(tx.date)} {tx.note ? `• ${tx.note}` : ''}
                                  </p>
                              </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                              <p className={`font-black text-[15px] leading-none ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                  {tx.type === 'expense' ? '-' : '+'}{formatPrice(tx.amount)}
                              </p>
                          </div>
                      </div>
                    );
                  })}
                  {displayedTransactions.length === 0 && (
                    <div className="text-center py-24 text-gray-400 text-xs font-black uppercase tracking-[0.2em] bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-700/50">
                       {drillDown ? 'No data for this selection' : t('noActivity')}
                    </div>
                  )}
               </div>
            </section>
          </>
        )}

        {/* === ADVANCED REPORT VIEW (RESTORED) === */}
        {reportMode === 'advanced' && (
           <div className="space-y-4 animate-in slide-in-from-right duration-300">
             
             {/* 1. Comparison Control Panel */}
             <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
                <div className="flex items-center gap-2">
                    <Scale size={18} className="text-purple-600" />
                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">Period Comparison</h3>
                </div>

                {/* Range Selectors */}
                <div className="flex bg-gray-100 dark:bg-gray-900/50 p-1.5 rounded-2xl overflow-x-auto no-scrollbar gap-1">
                   {[
                      { id: 'weekly', label: 'Week' },
                      { id: 'monthly', label: 'Month' },
                      { id: '3month', label: '3 Mo' },
                      { id: '6month', label: '6 Mo' },
                      { id: 'custom', label: 'Custom' },
                   ].map(opt => (
                     <button 
                        key={opt.id} 
                        onClick={() => setComparisonPreset(opt.id as ComparisonPreset)}
                        className={`flex-1 min-w-[60px] py-2 rounded-xl text-[10px] font-black uppercase transition-all ${comparisonPreset === opt.id ? 'bg-white dark:bg-gray-800 text-purple-600 shadow-sm' : 'text-gray-400'}`}
                     >
                        {opt.label}
                     </button>
                   ))}
                </div>
                
                {/* Custom Date Inputs (Only visible when Custom is selected) */}
                {comparisonPreset === 'custom' && (
                  <div className="flex items-center gap-3 animate-in zoom-in duration-300">
                     <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase ml-2">Period A</label>
                        <input type="month" value={customPeriodA} onChange={e => setCustomPeriodA(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-black outline-none" />
                     </div>
                     <div className="pt-4 text-gray-300"><ArrowDownRight size={20} /></div>
                     <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase ml-2">Period B</label>
                        <input type="month" value={customPeriodB} onChange={e => setCustomPeriodB(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-black outline-none" />
                     </div>
                  </div>
                )}
             </div>
             
             {/* 2. AI Professional Analysis (MOVED TO TOP) */}
             <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bot size={20} className="text-indigo-200" />
                            <h3 className="text-[11px] font-black text-indigo-100 uppercase tracking-widest leading-none">AI Smart Analysis</h3>
                        </div>
                        <button 
                            onClick={handleGenerateAnalysis} 
                            disabled={isAnalyzing}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all active:scale-90 disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={isAnalyzing ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="min-h-[60px]">
                        {isAnalyzing ? (
                            <div className="flex flex-col items-center justify-center py-4 gap-2 opacity-80">
                                <Loader2 size={20} className="animate-spin" />
                                <span className="text-[9px] font-bold uppercase tracking-widest">Analyzing Trend Data...</span>
                            </div>
                        ) : reportInsight ? (
                            <div className="space-y-2 animate-in fade-in duration-500">
                                {reportInsight.includes('-') || reportInsight.includes('•') ? (
                                    reportInsight.split(/[-•]/).filter(s => s.trim().length > 0).map((line, i) => (
                                        <div key={i} className="flex gap-2 items-start bg-white/10 p-3 rounded-xl border border-white/5">
                                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-300 flex-shrink-0"></div>
                                            <p className="text-[11px] font-medium leading-relaxed opacity-90">{line.trim()}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[11px] font-medium leading-relaxed opacity-90">{reportInsight}</p>
                                )}
                            </div>
                        ) : (
                            <div onClick={handleGenerateAnalysis} className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-white/20 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
                                <Sparkles size={20} className="mb-2 opacity-60" />
                                <p className="text-top-center font-bold uppercase tracking-widest opacity-60">Tap to Generate Professional Insights</p>
                            </div>
                        )}
                    </div>
                </div>
             </div>

             {/* 3. Detailed Category Comparison (Include Income/Expense) */}
             <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <AlignLeft size={18} className="text-teal-500" />
                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">Category Wise Breakdown</h3>
                </div>
                
                <div className="space-y-6">
                   {categoryComparison.length === 0 ? (
                       <p className="text-center text-xs text-gray-400 font-bold uppercase py-4">{t('noActivity')}</p>
                   ) : (
                       categoryComparison.map(cat => {
                         const isIncome = cat.type === 'income';
                         return (
                           <div key={cat.id} className="space-y-2">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-1 h-3 rounded-full ${isIncome ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className="text-xs font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">{cat.name}</span>
                                  </div>
                                  <span className={`text-xs font-black ${isIncome ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>{formatPrice(cat.valA)}</span>
                              </div>
                              
                              {/* Bars */}
                              <div className="space-y-1">
                                  {/* Period A Bar (Primary) */}
                                  <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden flex items-center">
                                      <div className={`h-full rounded-full ${isIncome ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${(cat.valA / maxCategoryAmount) * 100}%` }}></div>
                                  </div>
                                  {/* Period B Bar (Secondary comparison) */}
                                  <div className="h-1.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden flex items-center w-[95%]">
                                      <div className="h-full bg-gray-400 dark:bg-gray-600 rounded-full opacity-50" style={{ width: `${(cat.valB / maxCategoryAmount) * 100}%` }}></div>
                                  </div>
                              </div>
                              
                              {/* Comparison Detail Subtext */}
                              <div className="flex items-center justify-between pt-0.5">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Prev: {formatPrice(cat.valB)}</span>
                                  <div className="flex items-center gap-1">
                                      <span className="text-[9px] text-gray-300 font-bold uppercase">Diff:</span>
                                      <span className={`text-[9px] font-black uppercase ${cat.diff > 0 ? (isIncome ? 'text-green-500' : 'text-red-500') : cat.diff < 0 ? (isIncome ? 'text-red-500' : 'text-green-500') : 'text-gray-400'}`}>
                                          {cat.diff > 0 ? '+' : ''}{formatPrice(cat.diff)}
                                      </span>
                                  </div>
                              </div>
                           </div>
                         );
                       })
                   )}
                </div>
             </div>

             {/* 4. Side-by-Side Stats (MOVED TO BOTTOM) */}
             <div className="grid grid-cols-2 gap-3">
                {/* Card A */}
                <div className="bg-blue-600 text-white p-5 rounded-[2rem] shadow-xl shadow-blue-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Calendar size={64}/></div>
                    <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1">{comparisonRanges.rangeA.label}</p>
                    <div className="space-y-3 relative z-10">
                        <div>
                            <p className="text-[9px] uppercase opacity-70">Income</p>
                            <p className="text-sm font-black">{formatPrice(metricsA.income)}</p>
                        </div>
                        <div>
                            <p className="text-[9px] uppercase opacity-70">Expense</p>
                            <p className="text-sm font-black">{formatPrice(metricsA.expense)}</p>
                        </div>
                        <div className="pt-2 border-t border-white/20">
                             <p className="text-[9px] uppercase opacity-70">Savings Rate</p>
                             <p className="text-xl font-black">{metricsA.savingsRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>

                {/* Card B */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{comparisonRanges.rangeB.label}</p>
                    <div className="space-y-3 relative z-10">
                        <div>
                            <p className="text-[9px] uppercase text-gray-400">Income</p>
                            <p className="text-sm font-black text-gray-800 dark:text-white">{formatPrice(metricsB.income)}</p>
                        </div>
                        <div>
                            <p className="text-[9px] uppercase text-gray-400">Expense</p>
                            <p className="text-sm font-black text-gray-800 dark:text-white">{formatPrice(metricsB.expense)}</p>
                        </div>
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                             <p className="text-[9px] uppercase text-gray-400">Savings Rate</p>
                             <p className="text-xl font-black text-gray-800 dark:text-white">{metricsB.savingsRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>
             </div>

             {/* 5. Variance / Delta Analysis (MOVED TO BOTTOM) */}
             <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Calculator size={18} className="text-orange-500" />
                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">Variance (A - B)</h3>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Income Change</span>
                        <ComparisonBadge val={comparisonData.diffIncome} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Expense Change</span>
                        <ComparisonBadge val={comparisonData.diffExpense} inverse />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Net Savings Change</span>
                        <ComparisonBadge val={comparisonData.diffSavings} />
                    </div>
                </div>
             </div>

           </div>
        )}

      </div>

      {selectedTx && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in" onClick={() => !isDeleting && setSelectedTx(null)}>
           <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-[3rem] p-7 pb-14 space-y-5 animate-in slide-in-from-bottom duration-300 shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* Modal Content */}
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
                  className="p-6 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-700 rounded-[2.25rem] flex flex-col items-center gap-4 shadow-sm active:scale-95 transition-all group hover:border-blue-200"
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
                  className="p-6 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-700 rounded-[2.25rem] flex flex-col items-center gap-4 shadow-sm active:scale-95 transition-all group hover:border-red-500"
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

export default Reports;
