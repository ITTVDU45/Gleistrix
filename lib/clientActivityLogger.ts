export interface ActivityLogData {
  actionType: string;
  module: string;
  details: {
    entityId?: string;
    description: string;
    before?: any;
    after?: any;
    context?: any;
  };
}

import { ActivityLogApi } from '@/lib/api/activityLog'

export async function logActivity(data: ActivityLogData): Promise<void> {
  try {
    const res = await ActivityLogApi.create(data)
    if (!res.success) {
      console.error('Error logging activity:', res.error)
    } else {
      console.log(`Activity logged: ${data.actionType} - ${data.details.description}`)
    }
  } catch (error) {
    console.error('Error logging activity:', error)
  }
}

// Convenience functions for common actions
export async function logProjectAction(
  actionType: string,
  description: string,
  entityId?: string,
  before?: any,
  after?: any,
  context?: any
): Promise<void> {
  await logActivity({
    actionType,
    module: 'project',
    details: {
      entityId,
      description,
      before,
      after,
      context
    }
  });
}

export async function logEmployeeAction(
  actionType: string,
  description: string,
  entityId?: string,
  before?: any,
  after?: any,
  context?: any
): Promise<void> {
  await logActivity({
    actionType,
    module: 'employee',
    details: {
      entityId,
      description,
      before,
      after,
      context
    }
  });
}

export async function logVehicleAction(
  actionType: string,
  description: string,
  entityId?: string,
  before?: any,
  after?: any,
  context?: any
): Promise<void> {
  await logActivity({
    actionType,
    module: 'vehicle',
    details: {
      entityId,
      description,
      before,
      after,
      context
    }
  });
}

export async function logSettingsAction(
  actionType: string,
  description: string,
  entityId?: string,
  before?: any,
  after?: any,
  context?: any
): Promise<void> {
  await logActivity({
    actionType,
    module: 'settings',
    details: {
      entityId,
      description,
      before,
      after,
      context
    }
  });
}

export async function logSystemAction(
  actionType: string,
  description: string,
  context?: any
): Promise<void> {
  await logActivity({
    actionType,
    module: 'system',
    details: {
      description,
      context
    }
  });
} 