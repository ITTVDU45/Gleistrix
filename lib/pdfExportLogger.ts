export interface PDFExportData {
  module: string;
  entityId?: string;
  entityName?: string;
  exportType: string;
  details?: any;
}

import { ActivityLogApi } from '@/lib/api/activityLog'

export async function logPDFExport(data: PDFExportData): Promise<void> {
  try {
    const res = await ActivityLogApi.createPDFExport(data)
    if (!res.success) {
      console.error('Error logging PDF export:', res.error)
    } else {
      console.log(`PDF Export logged: ${data.module} - ${data.entityName || 'Übersicht'}`)
    }
  } catch (error) {
    console.error('Error logging PDF export:', error)
  }
}

// Convenience functions for common PDF exports
export async function logProjectPDFExport(
  entityId: string,
  entityName: string,
  exportType: string = 'project_details',
  details?: any
): Promise<void> {
  await logPDFExport({
    module: 'project',
    entityId,
    entityName,
    exportType,
    details
  });
}

export async function logEmployeePDFExport(
  entityId: string,
  entityName: string,
  exportType: string = 'employee_details',
  details?: any
): Promise<void> {
  await logPDFExport({
    module: 'employee',
    entityId,
    entityName,
    exportType,
    details
  });
}

export async function logVehiclePDFExport(
  entityId: string,
  entityName: string,
  exportType: string = 'vehicle_details',
  details?: any
): Promise<void> {
  await logPDFExport({
    module: 'vehicle',
    entityId,
    entityName,
    exportType,
    details
  });
}

export async function logTimeTrackingPDFExport(
  exportType: string = 'time_tracking_overview',
  details?: any
): Promise<void> {
  await logPDFExport({
    module: 'time_tracking',
    exportType,
    details
  });
}

export async function logStatisticsPDFExport(
  exportType: string = 'dashboard_statistics',
  details?: any
): Promise<void> {
  await logPDFExport({
    module: 'statistics',
    exportType,
    details
  });
} 