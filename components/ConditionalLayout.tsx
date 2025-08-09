"use client";
import React from 'react';
import { usePathname } from 'next/navigation';

// Seiten, auf denen KEINE Sidebar angezeigt wird
const noSidebarRoutes = [
  '/login',
  '/passwort-vergessen',
  '/auth/set-password',
  '/setup',
  '/send-email',
];

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  
  // Prüfe, ob die aktuelle Route eine Sidebar hat
  const hasSidebar = !noSidebarRoutes.includes(pathname);

  // Reagiere auf Collapse-Änderungen der Sidebar
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      setIsCollapsed(saved === '1');
    } catch {}

    const handler = (e: any) => {
      setIsCollapsed(Boolean(e?.detail?.collapsed));
    };
    window.addEventListener('sidebar-collapsed-changed', handler as any);
    return () => window.removeEventListener('sidebar-collapsed-changed', handler as any);
  }, []);
  
  return (
    <main className={`flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 transition-all duration-300 ${hasSidebar ? (isCollapsed ? 'md:ml-20' : 'md:ml-64') : ''}`}>
      <div className="min-h-full p-4 md:p-6">
        {children}
      </div>
    </main>
  );
} 