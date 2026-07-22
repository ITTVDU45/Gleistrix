import { describe, expect, test } from 'vitest'
import { shouldUseSubcontractorEstimate, uniqueAssignmentKeys } from './subcontractorCosts'

describe('Subunternehmerkosten', () => {
  test('freigegebene Rechnung ersetzt die Einsatzschätzung', () => {
    const approved = uniqueAssignmentKeys([{ assignmentKey: 'p1::row1' }, { assignmentKey: 'p1::row1' }])
    expect(approved.size).toBe(1)
    expect(shouldUseSubcontractorEstimate('p1::row1', approved)).toBe(false)
    expect(shouldUseSubcontractorEstimate('p1::row2', approved)).toBe(true)
  })
})
