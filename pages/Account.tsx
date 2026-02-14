
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  Cloud, ShieldCheck, Loader2, AlertCircle, Mail, 
  LogOut, User, Lock, CheckCircle, Eye, EyeOff, 
  Camera, Edit2, History, Smartphone, AlertTriangle, 
  BadgeCheck, Users, Share2, Plus, Copy, ChevronRight,
  Trash2, CloudUpload, CloudDownload, RefreshCw, ArrowLeft, KeyRound,
  Calendar, RotateCcw, Clock, Database
} from 'lucide-react';
import { getAuthErrorMessage } from '../services/errorService';
import { cloudDrive } from '../services/cloudDrive';

const Account: React.FC = () => {
  const { 
    syncState, logout, login, signup, resetPassword, 
    backupUserData, restoreBackup, settings, updateSettings, t, updateUserProfilePhoto, transactions, showNotification
  } = useApp();

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const validateEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email) { setErrorMsg("Please enter your email."); return; }
    if (!validateEmail(email)) { setErrorMsg("Please enter a valid email address."); return; }
    
    if (authMode !== 'forgot' && !password) { setErrorMsg("Please enter your password."); return; }
    
    if (authMode === 'signup') {
      if (!fullName) { setErrorMsg("Please enter your full name."); return; }
      if (password.length < 6) { setErrorMsg("Password must be at least 6 characters."); return; }
      if (password !== confirmPass) { setErrorMsg("Passwords do not match."); return; }
    }

    setIsLoading(true);
    try {
      if (authMode === 'login') {
        await login(email, password);
        // Explicitly redirect to dashboard after login success
        navigate('/', { replace: true });
      } else if (authMode === 'signup') {
        await signup(email, password, fullName);
        showNotification("Check your email for confirmation.", "info");
        setAuthMode('login');
      } else if (authMode === 'forgot') {
        await resetPassword(email);
        showNotification("Reset link sent if account exists.", "info");
        setAuthMode('login');
      }
    } catch (e: any) { 
      setErrorMsg(getAuthErrorMessage(e)); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleManualBackup = async () => {
    if (!syncState.isLoggedIn || !syncState.user) return;
    setIsBackingUp(true);
    try {
      await backupUserData();
      showNotification("Backup Success");
    } catch (e: any) {
      const msg = e.message || getAuthErrorMessage(e);
      showNotification(msg, "error");
      if (msg.includes("not found")) {
        alert("SQL Error: The 'backups' table is missing. Please run the SQL creation script in Supabase.");
      }
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!syncState.isLoggedIn) return;
    if (!window.confirm("Restoring a backup will overwrite your current data. Continue?")) return;
    
    setIsRestoring(true);
    try {
      const success = await restoreBackup('replace');
      if (success) {
        showNotification("Data Restored Successfully");
      } else {
        showNotification("No backup found to restore", "info");
      }
    } catch (e: any) {
      showNotification("Restore Failed: " + getAuthErrorMessage(e), "error");
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !syncState.user) return;

    setIsUploadingPhoto(true);
    try {
      const url = await cloudDrive.uploadProfilePicture(syncState.user.id, file);
      updateUserProfilePhoto(url);
      showNotification(t('profileUpdated'));
    } catch (err: any) {
      showNotification(err.message || t('uploadFailed'), "error");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return t('noActivity');
    try {
      const date = new Date(dateStr);
      return `${t('lastSynced')} ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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

  // Logged In View
  if (syncState.isLoggedIn && syncState.user) {
    return (
      <div className="p-4 space-y-6 pb-24 relative min-h-full max-w-lg mx-auto animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-2 pt-1 px-1">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600">
            <User size={20} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter uppercase leading-none">{t('account')}</h1>
        </div>

        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex gap-4 items-center">
            <div className="relative group cursor-pointer">
                <div className="relative w-20 h-20 rounded-[2rem] bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden border-2 shadow-md">
                    {syncState.user.photoURL ? (
                    <img src={syncState.user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                    <span className="text-3xl font-black text-blue-600">{syncState.user.name.charAt(0)}</span>
                    )}
                </div>
                {/* Camera Overlay */}
                <div onClick={() => !isUploadingPhoto && fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 rounded-[2rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   {isUploadingPhoto ? <Loader2 className="text-white animate-spin" size={24}/> : <Camera className="text-white" size={24}/>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-gray-800 dark:text-white truncate text-xl tracking-tight leading-tight">{syncState.user.name}</h3>
              <p className="text-xs text-gray-400 font-bold truncate tracking-tight">{syncState.user.email}</p>
              <div className="flex gap-2 mt-2">
                 {syncState.user.emailVerified ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 text-[8px] font-black uppercase rounded-full">
                      <ShieldCheck size={10} /> {t('verified')}
                    </span>
                 ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-black uppercase rounded-full">
                      <AlertCircle size={10} /> {t('notVerified')}
                    </span>
                 )}
              </div>
            </div>

            <button onClick={logout} className="p-3 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-2xl active:scale-90 transition-all border border-red-100 dark:border-red-900/30">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Cloud Infrastructure */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4 px-1">
             <Cloud size={14} className="text-blue-500" />
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('cloudInfrastructure')}</p>
          </div>
          
          <div className="space-y-3">
             <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('syncStatus')}</p>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${syncState.lastSync ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                    {syncState.lastSync ? t('upToDate') : t('never')}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-xs font-black uppercase ${syncState.lastSync ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>
                    {formatLastSync(syncState.lastSync)}
                  </p>
                  {syncState.backupSize && (
                    <span className="text-[9px] font-black bg-blue-100 dark:bg-blue-900/50 text-blue-600 px-2 py-0.5 rounded-md">{syncState.backupSize}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <Database size={10} className="text-gray-400" />
                    <p className="text-[9px] text-gray-400 font-bold uppercase">{t('localItems')} {transactions.length}</p>
                </div>
             </div>

             {/* Auto Backup Toggle */}
             <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={14} className="text-blue-500" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('autoBackup')}</p>
                  </div>
                  <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                    {['off', 'daily', 'weekly'].map((opt) => (
                      <button 
                        key={opt}
                        onClick={() => updateSettings({ autoBackup: opt as any })}
                        className={`px-3 py-1 text-[8px] font-black uppercase rounded-md transition-all ${settings.autoBackup === opt ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                {settings.autoBackup !== 'off' && syncState.lastSync && (
                  <div className="flex items-center gap-2 px-1">
                    <Clock size={10} className="text-gray-400" />
                    <p className="text-[9px] font-bold text-gray-400 uppercase">{t('nextScheduled')} <span className="text-blue-500">{getNextBackupTime()}</span></p>
                  </div>
                )}
             </div>

             <div className="grid grid-cols-2 gap-3">
               <button 
                 onClick={handleManualBackup} 
                 disabled={isBackingUp || isRestoring} 
                 className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
               >
                  {isBackingUp ? <Loader2 size={20} className="animate-spin" /> : <CloudUpload size={20}/>}
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none">{t('backupNow')}</p>
               </button>

               <button 
                 onClick={handleRestore} 
                 disabled={isBackingUp || isRestoring} 
                 className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm active:scale-95 transition-all disabled:opacity-50"
               >
                  {isRestoring ? <Loader2 size={20} className="animate-spin text-blue-600" /> : <CloudDownload size={20} className="text-blue-600" />}
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none text-gray-600 dark:text-gray-300">{t('restoreData')}</p>
               </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // Auth Forms
  return (
    <div className="p-4 space-y-6 pb-24 min-h-full flex flex-col justify-center animate-in fade-in max-w-md mx-auto">
      <div className="text-center space-y-2 mb-4">
        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter leading-tight uppercase">{t('appTitle')}</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-gray-700 transition-all">
        
        {/* Auth Mode Tabs */}
        {authMode !== 'forgot' && (
          <div className="flex bg-gray-50 dark:bg-gray-900 p-1.5 rounded-2xl mb-8 gap-2 border dark:border-gray-700 shadow-inner">
            <button 
              onClick={() => { setAuthMode('login'); setErrorMsg(''); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'login' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-lg border border-gray-100 dark:border-gray-700' : 'text-gray-400'}`}
            >
              {t('logIn')}
            </button>
            <button 
              onClick={() => { setAuthMode('signup'); setErrorMsg(''); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'signup' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-lg border border-gray-100 dark:border-gray-700' : 'text-gray-400'}`}
            >
              {t('signUp')}
            </button>
          </div>
        )}

        {authMode === 'forgot' && (
           <button onClick={() => setAuthMode('login')} className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 active:scale-95 transition-all">
              <ArrowLeft size={16} /> {t('backToLogin')}
           </button>
        )}

        <h2 className="text-xl font-black text-gray-800 dark:text-white mb-6 uppercase tracking-tight">
          {authMode === 'login' ? t('welcomeBack') : authMode === 'signup' ? t('createAccount') : t('resetPassword')}
        </h2>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 animate-in shake duration-300">
            <AlertCircle size={20} className="flex-shrink-0" />
            <p className="text-xs font-bold leading-tight">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                value={fullName} 
                onChange={e => setFullName(e.target.value)} 
                placeholder={t('fullName')}
                className="w-full pl-12 pr-5 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder={t('emailAddress')}
              className="w-full pl-12 pr-5 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
            />
          </div>

          {authMode !== 'forgot' && (
            <>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder={t('password')}
                  className="w-full pl-12 pr-5 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
                />
              </div>

              {authMode === 'signup' && (
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="password" 
                    value={confirmPass} 
                    onChange={e => setConfirmPass(e.target.value)} 
                    placeholder={t('confirmPassword')}
                    className="w-full pl-12 pr-5 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
                  />
                </div>
              )}
            </>
          )}

          {authMode === 'login' && (
            <div className="flex justify-end px-1">
              <button 
                type="button" 
                onClick={() => { setAuthMode('forgot'); setErrorMsg(''); }}
                className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
              >
                {t('forgotPassword')}
              </button>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading} 
            className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-[1.75rem] shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20}/>
            ) : (
              authMode === 'login' ? t('logIn') : authMode === 'signup' ? t('signUp') : t('sendResetLink')
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-50 dark:border-gray-700 pt-6">
          {authMode === 'login' ? (
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {t('noAccount')}{' '}
              <button onClick={() => setAuthMode('signup')} className="text-blue-600 hover:underline ml-1">{t('signUp')}</button>
            </p>
          ) : (
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {t('alreadyAccount')}{' '}
              <button onClick={() => setAuthMode('login')} className="text-blue-600 hover:underline ml-1">{t('logIn')}</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Account;
