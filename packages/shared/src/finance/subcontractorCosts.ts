export function shouldUseSubcontractorEstimate(assignmentKey: string, approvedInvoiceAssignmentKeys: ReadonlySet<string>) {
  return !approvedInvoiceAssignmentKeys.has(assignmentKey)
}

export function uniqueAssignmentKeys(lines: Array<{ assignmentKey?: string | null }>) {
  return new Set(lines.map(line => line.assignmentKey).filter((key): key is string => Boolean(key)))
}
