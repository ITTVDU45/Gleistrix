export const APP_MODULES = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', alwaysVisible: true },
  { id: 'projekte', label: 'Projekte', href: '/projekte' },
  { id: 'abrechnung', label: 'Abrechnung', href: '/abbrechnung' },
  { id: 'mitarbeiter', label: 'Mitarbeiter', href: '/mitarbeiter' },
  { id: 'fahrzeuge', label: 'Fahrzeuge', href: '/fahrzeuge' },
  { id: 'lager', label: 'Lager', href: '/lager' },
  { id: 'zeiterfassung', label: 'Zeiterfassung', href: '/timetracking' },
] as const

export type ModuleId = (typeof APP_MODULES)[number]['id']

export const ALL_MODULE_IDS: ModuleId[] = APP_MODULES.map((m) => m.id)

export const SELECTABLE_MODULES = APP_MODULES.filter(
  (m) => !('alwaysVisible' in m && m.alwaysVisible)
)

export const DEFAULT_USER_MODULES: ModuleId[] = [
  'dashboard',
  'projekte',
  'mitarbeiter',
  'zeiterfassung',
]

export const MODULE_ID_ENUM = [
  'dashboard',
  'projekte',
  'abrechnung',
  'mitarbeiter',
  'fahrzeuge',
  'lager',
  'zeiterfassung',
] as const

export function moduleByHref(href: string): ModuleId | null {
  const found = APP_MODULES.find((m) => m.href === href)
  return found ? found.id : null
}
