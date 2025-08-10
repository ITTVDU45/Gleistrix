"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AuthApi } from '@/lib/api/auth'
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '../lib/utils';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Truck, 
  Clock, 
  Settings,
  Menu,
  X,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from './ui/button';
import Image from 'next/image';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projekte', href: '/projekte', icon: Building2 },
  { name: 'Mitarbeiter', href: '/mitarbeiter', icon: Users },
  { name: 'Fahrzeuge', href: '/fahrzeuge', icon: Truck },
  { name: 'Zeiterfassung', href: '/timetracking', icon: Clock },
  { name: 'Einstellungen', href: '/einstellungen', icon: Settings },
];

interface CurrentUser {
  name: string;
  email: string;
  role: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Benutzerdaten aus Session laden
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const data = await AuthApi.me();
        if (data?.user) {
          setCurrentUser(data.user as any);
        } else {
          // Nicht angemeldet, zur Login-Seite weiterleiten
          router.push('/login');
        }
      } catch (error) {
        console.error('Fehler beim Laden der Benutzerdaten:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  // Sidebar-Collapse Zustand aus/localStorage lesen
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved === '1') setIsCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // Nach erfolgreichem Render den Event senden, damit andere Komponenten (z. B. Layout) reagieren können
  React.useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('sidebar-collapsed-changed', { detail: { collapsed: isCollapsed } }));
    } catch {}
  }, [isCollapsed]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await AuthApi.logout()
      if ((response as any).ok !== false) {
        // Weiterleitung zur Login-Seite
        router.push('/login');
      } else {
        console.error('Logout fehlgeschlagen');
        // Trotzdem zur Login-Seite weiterleiten
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout-Fehler:', error);
      // Bei Fehler trotzdem zur Login-Seite weiterleiten
      router.push('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Loading-Zustand
  if (isLoading) {
    return (
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback wenn keine Benutzerdaten verfügbar
  if (!currentUser) {
    return null;
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn('hidden md:flex md:flex-col md:fixed md:inset-y-0 transition-all duration-300', isCollapsed ? 'md:w-20' : 'md:w-64')}>
        <div className="flex flex-col flex-grow bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
          {/* Logo */}
          <div className={cn('flex items-center px-4 transition-all duration-300', isCollapsed ? 'h-16 justify-center' : 'h-28 px-6') }>
            <div className={cn('flex flex-col transition-all duration-300', isCollapsed ? 'items-center' : 'items-start')}>
              <div className="rounded-lg overflow-hidden mt-1 mb-2">
                <Image src="/mwd-logo.png" alt="Mülheimer Wachdienst" width={isCollapsed ? 48 : 140} height={isCollapsed ? 48 : 84} className="object-contain" priority />
              </div>
            </div>
            <Button
              onClick={toggleCollapsed}
              variant="ghost"
              size="sm"
              className={cn('ml-auto hidden md:inline-flex', isCollapsed ? 'p-1' : '')}
              aria-label={isCollapsed ? 'Sidebar öffnen' : 'Sidebar schließen'}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
          {/* Trennlinie unter dem Logo */}
          <div className="border-b border-slate-200 dark:border-slate-700" />

          {/* Navigation */}
          <nav className={cn('flex-1 py-6 space-y-2 transition-all duration-300', isCollapsed ? 'px-2' : 'px-4') }>
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={item.name}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                    isCollapsed ? 'justify-center' : 'justify-start',
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  <item.icon 
                    className={cn(
                      'h-5 w-5 transition-colors duration-200',
                      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    )} 
                  />
                  <span className={cn('whitespace-nowrap transition-all duration-200', isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto')}>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Benutzer-Bereich und Abmeldung */}
          <div className={cn('p-4 border-t border-slate-200 dark:border-slate-700 space-y-3 transition-all duration-300', isCollapsed ? 'items-center' : '')}>
            {/* Benutzer-Info */}
            <div className={cn('flex items-center px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700 transition-all duration-300', isCollapsed ? 'justify-center' : 'gap-3') }>
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-0">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0 ml-3">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {currentUser.email}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 capitalize">
                    {currentUser.role}
                  </p>
                </div>
              )}
            </div>

            {/* Abmelde-Button */}
            <Button
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="ghost"
              className={cn('w-full gap-3 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300', isCollapsed ? 'justify-center' : 'justify-start')}
            >
              <LogOut className="h-5 w-5" />
              {!isCollapsed && (isLoggingOut ? 'Abmelden...' : 'Abmelden')}
            </Button>

            {/* Copyright */}
            {!isCollapsed && (
              <div className="text-xs text-slate-500 dark:text-slate-400 text-center pt-2">
                © 2025 Gleistrix
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-white dark:bg-slate-800 shadow-lg border-slate-200 dark:border-slate-600"
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-800 shadow-xl">
            <div className="flex flex-col h-full">
              {/* Logo */}
              <div className="flex items-center h-24 px-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex flex-col items-start">
                  <div className="rounded-lg overflow-hidden">
                    <Image src="/mwd-logo.png" alt="Mülheimer Wachdienst" width={140} height={84} className="object-contain" priority />
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-4 py-6 space-y-2">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 shadow-sm'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                      )}
                    >
                      <item.icon 
                        className={cn(
                          'h-5 w-5 transition-colors duration-200',
                          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                        )} 
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              {/* Mobile Benutzer-Bereich und Abmeldung */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                {/* Benutzer-Info */}
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {currentUser.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {currentUser.email}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 capitalize">
                      {currentUser.role}
                    </p>
                  </div>
                </div>

                {/* Abmelde-Button */}
                <Button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  disabled={isLoggingOut}
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300"
                >
                  <LogOut className="h-5 w-5" />
                  {isLoggingOut ? 'Abmelden...' : 'Abmelden'}
                </Button>

                {/* Copyright */}
                <div className="text-xs text-slate-500 dark:text-slate-400 text-center pt-2">
                  © 2025 Gleistrix
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}