import { describe, expect, test } from 'vitest'
import {
  effectivePermissions,
  hasSubcontractorPermission,
  OWNER_PERMISSIONS,
  DEFAULT_USER_PERMISSIONS,
} from './permissions'

describe('effectivePermissions', () => {
  test('OWNER hat immer alle Permissions – unabhängig von der Auswahl', () => {
    expect(effectivePermissions({ role: 'SUBCONTRACTOR_OWNER', permissions: [] })).toEqual(OWNER_PERMISSIONS)
    expect(
      effectivePermissions({ role: 'SUBCONTRACTOR_OWNER', permissions: ['subcontractor.projects.read'] })
    ).toEqual(OWNER_PERMISSIONS)
  })

  test('USER ohne explizite Auswahl erhält Defaults (ohne submit/company.update)', () => {
    const perms = effectivePermissions({ role: 'SUBCONTRACTOR_USER' })
    expect(perms).toEqual(DEFAULT_USER_PERMISSIONS)
    expect(perms).not.toContain('subcontractor.invoices.submit')
    expect(perms).not.toContain('subcontractor.company.update')
  })

  test('USER mit expliziter Auswahl erhält genau diese', () => {
    const perms = effectivePermissions({
      role: 'SUBCONTRACTOR_USER',
      permissions: ['subcontractor.projects.read', 'subcontractor.invoices.submit'],
    })
    expect(perms).toEqual(['subcontractor.projects.read', 'subcontractor.invoices.submit'])
  })

  test('unbekannte Permission-Strings werden verworfen', () => {
    const perms = effectivePermissions({
      role: 'SUBCONTRACTOR_USER',
      permissions: ['admin.everything', 'subcontractor.projects.read'],
    })
    expect(perms).toEqual(['subcontractor.projects.read'])
  })
})

describe('hasSubcontractorPermission', () => {
  test('prüft einzelne Permission', () => {
    expect(
      hasSubcontractorPermission({ role: 'SUBCONTRACTOR_USER' }, 'subcontractor.invoices.submit')
    ).toBe(false)
    expect(
      hasSubcontractorPermission({ role: 'SUBCONTRACTOR_OWNER' }, 'subcontractor.invoices.submit')
    ).toBe(true)
  })
})
