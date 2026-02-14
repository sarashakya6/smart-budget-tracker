
import React, { useState, useEffect, useRef } from 'react';
import { X, Check, AlertCircle, Calendar, Image as ImageIcon, Loader2, CreditCard, Tag, FileText, Paperclip, Trash2 } from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { useApp } from '../context/AppContext';
import { cloudDrive } from '../services/cloudDrive';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTransaction?: Transaction | null;
  initialType?: TransactionType;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, editTransaction, initialType }) => {
  const { accounts, categories, addTransaction, updateTransaction, syncState, settings, t } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  
  // Use local date string for the input to avoid timezone shifts (UTC vs Local)
  const getLocalDateStr = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(getLocalDateStr());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  
  const [accountId, setAccountId] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategory, setSubCategory] = useState('');

  const availableSubCategories = React.useMemo(() => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.subCategories || [];
  }, [categoryId, categories]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (editTransaction) {
        setType(editTransaction.type);
        setAmount(editTransaction.amount.toString());
        // Extract YYYY-MM-DD from the existing ISO string locally
        const txDate = new Date(editTransaction.date);
        setDate(getLocalDateStr(txDate));
        setNote(editTransaction.note);
        setAccountId(editTransaction.accountId || '');
        setFromAccountId(editTransaction.fromAccountId || '');
        setToAccountId(editTransaction.toAccountId || '');
        setCategoryId(editTransaction.categoryId || '');
        setSubCategory(editTransaction.subCategory || '');
        setReceiptUrl(editTransaction.receiptUrl || null);
      } else {
        setType(initialType || 'expense');
        setAmount('');
        setDate(getLocalDateStr());
        setNote('');
        const defaultAcc = accounts[0]?.id || '';
        setAccountId(defaultAcc);
        setFromAccountId(defaultAcc);
        setToAccountId(accounts[1]?.id || accounts[0]?.id || '');
        setCategoryId('');
        setSubCategory('');
        setReceiptUrl(null);
      }
    }
  }, [isOpen, editTransaction, initialType, accounts]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !syncState.isLoggedIn) return;
    setIsUploading(true);
    try {
      const url = await cloudDrive.uploadReceipt(syncState.user!.id, file); 
      setReceiptUrl(url);
    } catch (err: any) {
      setError("Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter valid amount.");
      return;
    }
    if (type !== 'transfer' && !categoryId) {
      setError("Please select a category.");
      return;
    }

    // DATE LOGIC FIX:
    // If the user selects "Today", use the current timestamp to ensure it appears at the top of the list.
    // If they select a different date, use that date (defaults to midnight).
    let finalIsoDate: string;
    const todayStr = getLocalDateStr();
    
    if (date === todayStr && !editTransaction) {
       // New transaction for today: Use NOW
       finalIsoDate = new Date().toISOString();
    } else if (editTransaction && date === getLocalDateStr(new Date(editTransaction.date))) {
       // Editing without changing date: Keep original timestamp
       finalIsoDate = editTransaction.date;
    } else {
       // Changed date or past/future date: Use selected date (midnight)
       finalIsoDate = new Date(date).toISOString();
    }

    const txData: any = { type, amount: parseFloat(amount), date: finalIsoDate, note, receiptUrl };
    if (type === 'transfer') { txData.fromAccountId = fromAccountId; txData.toAccountId = toAccountId; }
    else { txData.accountId = accountId; txData.categoryId = categoryId; txData.subCategory = subCategory; }
    
    if (editTransaction) updateTransaction({ ...txData, id: editTransaction.id });
    else addTransaction(txData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom duration-300">
        
        {/* Header - Slimmer */}
        <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-sm font-black text-gray-800 dark:text-gray-100 tracking-widest uppercase">
            {editTransaction ? t('editEntry') : t('newEntry')}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto no-scrollbar">
          
          {/* Type Toggle - More Compact */}
          <div className="flex bg-gray-50 dark:bg-gray-900 p-1 rounded-xl gap-1 border border-gray-100 dark:border-gray-700">
             {['expense', 'income', 'transfer'].map(tType => (
               <button key={tType} type="button" onClick={() => setType(tType as any)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${type === tType ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm border border-gray-100 dark:border-gray-700' : 'text-gray-400'}`}>
                 {t(tType)}
               </button>
             ))}
          </div>

          {/* Row 1: Amount + Date */}
          <div className="grid grid-cols-[1fr,auto] gap-3 items-end">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('amount')} ({settings.currency})</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">{settings.currency}</span>
                <input 
                  type="number" 
                  step="0.01" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  className="w-full pl-14 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-lg font-black dark:text-white outline-none focus:ring-1 focus:ring-blue-500/30" 
                  placeholder="0.00" 
                  autoFocus 
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('date')}</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="pl-8 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold dark:text-white outline-none w-[130px]" 
                />
              </div>
            </div>
          </div>

          {/* Row 2: Account + Category */}
          {type !== 'transfer' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('account')}</label>
                <div className="relative">
                  <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <select 
                    value={accountId} 
                    onChange={e => setAccountId(e.target.value)}
                    className="w-full pl-8 pr-2 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold dark:text-white outline-none appearance-none"
                  >
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{t(acc.name)}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('category')}</label>
                <div className="relative">
                  <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <select 
                    value={categoryId} 
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full pl-8 pr-2 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold dark:text-white outline-none appearance-none"
                    required
                  >
                    <option value="">{t('select')}</option>
                    {categories.filter(c => c.type === type).map(cat => (
                      <option key={cat.id} value={cat.id}>{t(cat.name)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('from')}</label>
                <select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold dark:text-white outline-none appearance-none">
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{t(acc.name)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('to')}</label>
                <select value={toAccountId} onChange={e => setToAccountId(e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold dark:text-white outline-none appearance-none">
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{t(acc.name)}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Row 3: Sub-Category + Note */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('subCategory')}</label>
              <select 
                value={subCategory} 
                onChange={e => setSubCategory(e.target.value)}
                disabled={availableSubCategories.length === 0}
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold dark:text-white outline-none appearance-none disabled:opacity-40"
              >
                <option value="">{t('all')}</option>
                {availableSubCategories.map(sub => <option key={sub} value={sub}>{t(sub)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('note')}</label>
              <div className="relative">
                <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input 
                  type="text" 
                  value={note} 
                  onChange={e => setNote(e.target.value)} 
                  className="w-full pl-8 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold dark:text-white outline-none focus:ring-1 focus:ring-blue-500/30" 
                  placeholder="..." 
                />
              </div>
            </div>
          </div>

          {/* Compact Receipt Row - Now Slim & Optional */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600">
                <Paperclip size={16} />
              </div>
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{t('receipt')}</p>
                <p className="text-[10px] font-bold dark:text-gray-300 leading-none">
                  {isUploading ? 'Uploading...' : receiptUrl ? 'Attachment linked' : 'Optional image'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {receiptUrl ? (
                <>
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                    <img src={receiptUrl} alt="Receipt" className="w-full h-full object-cover" />
                  </div>
                  <button type="button" onClick={() => setReceiptUrl(null)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><Trash2 size={16}/></button>
                </>
              ) : (
                <button 
                  type="button" 
                  onClick={() => !isUploading && fileInputRef.current?.click()} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg text-[9px] font-black uppercase text-blue-600 shadow-sm active:scale-95 transition-all"
                >
                  {isUploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                  {t('get')}
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          </div>

          {/* Error Message - Inline */}
          {error && (
            <div className="flex items-center justify-center gap-2 text-[9px] text-red-500 font-bold uppercase tracking-wide py-1">
              <AlertCircle size={12} /> {error}
            </div>
          )}

          {/* Action Button - Compact but sturdy */}
          <button 
            type="submit" 
            disabled={isUploading} 
            className="w-full py-3.5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={16} strokeWidth={3} /> {t('saveRecord')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
