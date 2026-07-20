"use client";
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { AuthApi } from '@/lib/api/auth'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Building2,
  Clock,
  FileText,
  FolderOpen,
  Settings,
  LogOut,
  Menu,
  X,
  User,
} from 'lucide-react'

const portalNavigation = [
  { name: 'Übersicht', href: '/', icon: LayoutDashboard },
  { name: 'Meine Projekte', href: '/projekte', icon: Building2 },
  { name: 'Einsätze & Stunden', href: '/einsaetze', icon: Clock },
  { name: 'Rechnungen', href: '/rechnungen', icon: FileText },
  { name: 'Dokumente', href: '/dokumente', icon: FolderOpen },
  { name: 'Unternehmensprofil', href: '/unternehmen', icon: Settings },
]

interface PortalUser {
  name: string
  email: string
  role?: string
}

/**
 * Eingeschränkte Portal-Navigation für Subunternehmen.
 * Interne Admin-Routen sind hier bewusst nicht verlinkt – und zusätzlich
 * über Middleware und Server-APIs gesperrt.
 */
export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<PortalUser | null>(null)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await AuthApi.me()
        if (data?.user) {
          setUser(data.user as PortalUser)
        } else {
          router.push('/login')
        }
      } catch (error) {
        logger.error('Portal: Benutzerdaten konnten nicht geladen werden', error)
        router.push('/login')
      }
    }
    load()
  }, [router])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut({ redirect: false })
    } catch (error) {
      logger.error('Logout-Fehler:', error)
    } finally {
      router.push('/login')
      setIsLoggingOut(false)
    }
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === href : pathname.startsWith(href)

  const nav = (onNavigate?: () => void) => (
    <nav className="flex-1 px-4 py-6 space-y-2">
      {portalNavigation.map((item) => (
        <Link
          key={item.name}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
            isActive(item.href)
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 shadow-sm'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <item.icon
            className={cn(
              'h-5 w-5 transition-colors duration-200',
              isActive(item.href)
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
            )}
          />
          {item.name}
        </Link>
      ))}
    </nav>
  )

  const userBox = (
    <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700">
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Subunternehmen-Portal</p>
        </div>
      </div>
      <Button
        onClick={handleLogout}
        disabled={isLoggingOut}
        variant="ghost"
        className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
      >
        <LogOut className="h-5 w-5" />
        {isLoggingOut ? 'Abmelden…' : 'Abmelden'}
      </Button>
      <div className="text-xs text-slate-500 dark:text-slate-400 text-center pt-2">© 2026 Gleistrix</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center h-24 px-6">
            <div className="rounded-lg overflow-hidden">
              <Image src="/mwd-logo.png" alt="Gleistrix" width={120} height={72} className="object-contain" priority />
            </div>
          </div>
          <div className="border-b border-slate-200 dark:border-slate-700" />
          {nav()}
          {userBox}
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileOpen((v) => !v)}
          className="bg-white dark:bg-slate-800 shadow-lg border-slate-200 dark:border-slate-600"
        >
          {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-800 shadow-xl flex flex-col">
            <div className="flex items-center h-20 px-6 border-b border-slate-200 dark:border-slate-700">
              <Image src="/mwd-logo.png" alt="Gleistrix" width={110} height={66} className="object-contain" priority />
            </div>
            {nav(() => setIsMobileOpen(false))}
            {userBox}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="md:ml-64 min-h-screen">
        <div className="p-4 md:p-6 pt-16 md:pt-6">{children}</div>
      </main>
    </div>
  )
}
