import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, PieChart, Settings, Plus, User, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LayoutProps {
  onOpenAddModal: () => void;
}

const Layout: React.FC<LayoutProps> = ({ onOpenAddModal }) => {
  const location = useLocation();
  const { isActionSheetOpen, t, notification } = useApp();

  const navItemClass = (isActive: boolean) =>
    `flex flex-col items-center justify-center w-full h-full text-[10px] font-black uppercase tracking-tight transition-all duration-300 ${
      isActive 
        ? 'text-blue-600 dark:text-blue-400 scale-110' 
        : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
    }`;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden transition-colors duration-200">
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        <div className="max-w-md mx-auto min-h-full">
           <Outlet />
        </div>
      </main>

      {/* FAB - Elegant floating button */}
      {location.pathname === '/' && !isActionSheetOpen && (
        <button
          onClick={onOpenAddModal}
          className="fixed bottom-24 right-6 md:right-[calc(50%-14rem)] z-50 p-4 bg-blue-600 text-white rounded-2xl shadow-2xl shadow-blue-500/40 hover:bg-blue-700 active:scale-90 transition-all duration-200 ring-4 ring-white dark:ring-gray-800"
          aria-label="Add Transaction"
        >
          <Plus size={24} strokeWidth={3} />
        </button>
      )}

      {/* GLOBAL NOTIFICATION TOAST (New Professional Top-Center Design) */}
      {notification && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-full shadow-2xl shadow-black/10 animate-in slide-in-from-top duration-300 border border-white/10 backdrop-blur-md max-w-[90vw] whitespace-nowrap ${
          notification.type === 'error' ? 'bg-red-500 text-white' : 
          notification.type === 'info' ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-900' : 'bg-green-500 text-white'
        }`}>
          {notification.type === 'error' ? <AlertTriangle size={18} fill="currentColor" className="text-red-200" /> : 
           notification.type === 'info' ? <Info size={18} className="text-gray-400 dark:text-gray-500" /> : 
           <CheckCircle size={18} fill="currentColor" className="text-green-200"/>}
          <span className="text-xs font-bold tracking-wide">{notification.message}</span>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full h-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-t border-gray-100 dark:border-gray-700 z-40 safe-area-bottom">
        <div className="flex justify-around items-center h-full max-w-md mx-auto px-4">
          <NavLink to="/" className={({ isActive }) => navItemClass(isActive)}>
            <LayoutDashboard size={20} className="mb-1" />
            {t('home')}
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => navItemClass(isActive)}>
            <PieChart size={20} className="mb-1" />
            {t('reports')}
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => navItemClass(isActive)}>
            <Settings size={20} className="mb-1" />
            {t('settings')}
          </NavLink>
          <NavLink to="/account" className={({ isActive }) => navItemClass(isActive)}>
            <User size={20} className="mb-1" />
            {t('account')}
          </NavLink>
        </div>
      </nav>
    </div>
  );
};

export default Layout;