import dbConnect from './dbConnect';
import ActivityLog from './models/ActivityLog';
import User from './models/User';

export interface ActivityLogData {
  actionType: string;
  module: string;
  performedBy: {
    userId: string;
    name: string;
    role: string;
  };
  details: {
    entityId?: string;
    description: string;
    before?: any;
    after?: any;
    context?: any;
  };
}

export async function logActivity(data: ActivityLogData): Promise<void> {
  try {
    await dbConnect();
    
    const activityLog = new ActivityLog({
      timestamp: new Date(),
      actionType: data.actionType,
      module: data.module,
      performedBy: data.performedBy,
      details: data.details
    });
    
    await activityLog.save();
    console.log(`Activity logged: ${data.actionType} - ${data.details.description}`);
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error to avoid breaking the main functionality
  }
}

// Convenience functions for common actions
export async function logProjectAction(
  actionType: string,
  performedBy: { userId: string; name: string; role: string },
  description: string,
  entityId?: string,
  before?: any,
  after?: any,
  context?: any
): Promise<void> {
  await logActivity({
    actionType,
    module: 'project',
    performedBy,
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
  performedBy: { userId: string; name: string; role: string },
  description: string,
  entityId?: string,
  before?: any,
  after?: any,
  context?: any
): Promise<void> {
  await logActivity({
    actionType,
    module: 'employee',
    performedBy,
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
  performedBy: { userId: string; name: string; role: string },
  description: string,
  entityId?: string,
  before?: any,
  after?: any,
  context?: any
): Promise<void> {
  await logActivity({
    actionType,
    module: 'vehicle',
    performedBy,
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
  performedBy: { userId: string; name: string; role: string },
  description: string,
  entityId?: string,
  before?: any,
  after?: any,
  context?: any
): Promise<void> {
  await logActivity({
    actionType,
    module: 'settings',
    performedBy,
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
  performedBy: { userId: string; name: string; role: string },
  description: string,
  context?: any
): Promise<void> {
  await logActivity({
    actionType,
    module: 'system',
    performedBy,
    details: {
      description,
      context
    }
  });
} 