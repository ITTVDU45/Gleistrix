'use client'

import {
  PackageSearch,
  FileSpreadsheet,
  Building2,
  Users,
  Briefcase,
  Truck,
  Package,
  Receipt,
  CalendarRange,
  FileText,
  ShieldAlert,
  LayoutDashboard,
  Bot,
  BarChart3,
  Activity,
  Wrench,
  ClipboardList,
  FolderKanban,
  Calculator,
  UserCog,
  CalendarClock,
  Boxes,
  Files,
  CreditCard,
  Handshake,
  Sparkles,
  BadgeCheck,
  HardHat,
  Mail,
  LineChart,
  type LucideIcon,
} from 'lucide-react'

/**
 * Auflösung von lucide-Icons per Name (aus Mock-/API-Daten).
 * Nur explizit registrierte Icons werden gebündelt – kein Tree-Shaking-Problem.
 */
const ICONS: Record<string, LucideIcon> = {
  PackageSearch,
  FileSpreadsheet,
  Building2,
  Users,
  Briefcase,
  Truck,
  Package,
  Receipt,
  CalendarRange,
  FileText,
  ShieldAlert,
  LayoutDashboard,
  Bot,
  BarChart3,
  Activity,
  Wrench,
  ClipboardList,
  FolderKanban,
  Calculator,
  UserCog,
  CalendarClock,
  Boxes,
  Files,
  CreditCard,
  Handshake,
  Sparkles,
  BadgeCheck,
  HardHat,
  Mail,
  LineChart,
}

interface DynamicIconProps {
  name?: string
  className?: string
  fallback?: LucideIcon
}

export default function DynamicIcon({ name, className, fallback = Activity }: DynamicIconProps) {
  const Icon = (name && ICONS[name]) || fallback
  return <Icon className={className} />
}
