/**
 * Service-Layer für „Statistiken & Reports".
 *
 * Mock-basiert, async/Promise-basiert vorbereitet für den späteren Austausch
 * durch echte API-Endpunkte. Die spezifischen Getter (getProjectReports etc.)
 * liefern das jeweilige `ReportSectionData` des passenden Tabs.
 */

import type { ReportSectionData, ReportTabId, ReportOverview } from '@/types/reports'
import { MOCK_REPORT_OVERVIEW, getMockReportSection } from '@/lib/mock/reports'

function resolve<T>(data: T): Promise<T> {
  return Promise.resolve(data)
}

export const ReportsApi = {
  /** Komplette Übersicht aller Tabs (z.B. für Vorabladen). */
  getReportOverview: (): Promise<ReportOverview> => resolve(MOCK_REPORT_OVERVIEW),

  /** Daten eines einzelnen Report-Tabs. */
  getReportSection: (tabId: ReportTabId): Promise<ReportSectionData> =>
    resolve(getMockReportSection(tabId)),

  // Fachliche Convenience-Getter (später eigene Endpunkte)
  getProjectReports: (): Promise<ReportSectionData> => resolve(getMockReportSection('projekte')),
  getEmployeeReports: (): Promise<ReportSectionData> => resolve(getMockReportSection('mitarbeiter')),
  getClientReports: (): Promise<ReportSectionData> => resolve(getMockReportSection('auftraggeber')),
  getVehicleReports: (): Promise<ReportSectionData> => resolve(getMockReportSection('fahrzeuge')),
  getWarehouseReports: (): Promise<ReportSectionData> => resolve(getMockReportSection('lager')),
  getBillingReports: (): Promise<ReportSectionData> => resolve(getMockReportSection('abrechnung')),
  getAssignmentReports: (): Promise<ReportSectionData> => resolve(getMockReportSection('einsaetze')),
  getDocumentReports: (): Promise<ReportSectionData> => resolve(getMockReportSection('dokumente')),
  getQualityReports: (): Promise<ReportSectionData> => resolve(getMockReportSection('qualitaet')),
}
