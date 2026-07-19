import { describe, expect, test } from 'vitest'
import {
  canTransition,
  requiresMessage,
  isEditableBySubcontractor,
  isDeletableBySubcontractor,
} from './invoiceStatus'

describe('canTransition', () => {
  test('Subunternehmen darf Entwurf einreichen oder stornieren', () => {
    expect(canTransition('DRAFT', 'SUBMITTED', 'subcontractor')).toBe(true)
    expect(canTransition('DRAFT', 'CANCELLED', 'subcontractor')).toBe(true)
  })

  test('Subunternehmen darf keine internen Statuswechsel durchführen', () => {
    expect(canTransition('SUBMITTED', 'APPROVED', 'subcontractor')).toBe(false)
    expect(canTransition('SUBMITTED', 'UNDER_REVIEW', 'subcontractor')).toBe(false)
    expect(canTransition('APPROVED', 'PAID', 'subcontractor')).toBe(false)
  })

  test('nur intern darf freigeben, ablehnen und bezahlen', () => {
    expect(canTransition('SUBMITTED', 'UNDER_REVIEW', 'internal')).toBe(true)
    expect(canTransition('UNDER_REVIEW', 'APPROVED', 'internal')).toBe(true)
    expect(canTransition('UNDER_REVIEW', 'REJECTED', 'internal')).toBe(true)
    expect(canTransition('APPROVED', 'SCHEDULED_FOR_PAYMENT', 'internal')).toBe(true)
    expect(canTransition('SCHEDULED_FOR_PAYMENT', 'PAID', 'internal')).toBe(true)
  })

  test('Rückfrage erlaubt erneutes Einreichen durch das Subunternehmen', () => {
    expect(canTransition('CHANGES_REQUESTED', 'SUBMITTED', 'subcontractor')).toBe(true)
  })

  test('Rückfrage erlaubt Revision (zurück in den Entwurf) nur durch das Subunternehmen', () => {
    expect(canTransition('CHANGES_REQUESTED', 'DRAFT', 'subcontractor')).toBe(true)
    expect(canTransition('CHANGES_REQUESTED', 'DRAFT', 'internal')).toBe(false)
    expect(canTransition('SUBMITTED', 'DRAFT', 'subcontractor')).toBe(false)
  })

  test('finale Status sind unveränderbar', () => {
    expect(canTransition('PAID', 'DRAFT', 'internal')).toBe(false)
    expect(canTransition('REJECTED', 'APPROVED', 'internal')).toBe(false)
    expect(canTransition('CANCELLED', 'SUBMITTED', 'subcontractor')).toBe(false)
  })

  test('freigegebene/bezahlte Rechnung kann vom Subunternehmen nicht verändert werden', () => {
    expect(canTransition('APPROVED', 'DRAFT', 'subcontractor')).toBe(false)
    expect(canTransition('APPROVED', 'CANCELLED', 'subcontractor')).toBe(false)
    expect(canTransition('PAID', 'CANCELLED', 'subcontractor')).toBe(false)
  })
})

describe('requiresMessage', () => {
  test('Rückfrage und Ablehnung benötigen eine Begründung', () => {
    expect(requiresMessage('CHANGES_REQUESTED')).toBe(true)
    expect(requiresMessage('REJECTED')).toBe(true)
    expect(requiresMessage('APPROVED')).toBe(false)
  })
})

describe('Editier-/Löschregeln', () => {
  test('nur Entwürfe sind editier- und löschbar', () => {
    expect(isEditableBySubcontractor('DRAFT')).toBe(true)
    expect(isDeletableBySubcontractor('DRAFT')).toBe(true)
    for (const s of ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED'] as const) {
      expect(isEditableBySubcontractor(s)).toBe(false)
      expect(isDeletableBySubcontractor(s)).toBe(false)
    }
  })
})
