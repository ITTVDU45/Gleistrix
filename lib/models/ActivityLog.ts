import mongoose, { Schema, Document } from 'mongoose';

export interface IActivityLog extends Document {
  timestamp: Date;
  actionType: string;
  module: string;
  performedBy: {
    userId: mongoose.Types.ObjectId;
    name: string;
    role: string;
  };
  details: {
    entityId?: mongoose.Types.ObjectId;
    description: string;
    before?: any;
    after?: any;
    context?: any;
  };
}

const ActivityLogSchema = new Schema<IActivityLog>({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  actionType: {
    type: String,
    required: true,
    enum: [
      // Projekt Aktionen
      'project_created', 'project_updated', 'project_deleted', 'project_status_changed',
      'project_technology_added', 'project_technology_updated', 'project_technology_removed',
      'project_time_entry_added', 'project_time_entry_updated', 'project_time_entry_deleted',
      'project_vehicle_assigned', 'project_vehicle_updated', 'project_vehicle_unassigned',
      'project_export_pdf', 'project_export_csv',
      
      // Mitarbeiter Aktionen
      'employee_created', 'employee_updated', 'employee_deleted', 'employee_status_changed',
      'employee_vacation_added', 'employee_vacation_deleted', 'employee_export_pdf',
      
      // Fahrzeug Aktionen
      'vehicle_created', 'vehicle_updated', 'vehicle_deleted', 'vehicle_export_pdf',
      
      // Zeiterfassung Aktionen
      'time_tracking_export_pdf', 'time_tracking_export_csv',
      
      // Einstellungen Aktionen
      'settings_updated', 'user_created', 'user_invited', 'user_status_changed',
      'user_role_changed', 'user_deleted',
      
      // System Aktionen
      'login', 'logout', 'password_changed', 'profile_updated'
    ]
  },
  module: {
    type: String,
    required: true,
    enum: ['project', 'employee', 'vehicle', 'time_tracking', 'settings', 'system']
  },
  performedBy: {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: ['superadmin', 'admin', 'user']
    }
  },
  details: {
    entityId: {
      type: Schema.Types.ObjectId,
      required: false
    },
    description: {
      type: String,
      required: true
    },
    before: {
      type: Schema.Types.Mixed,
      required: false
    },
    after: {
      type: Schema.Types.Mixed,
      required: false
    },
    context: {
      type: Schema.Types.Mixed,
      required: false
    }
  }
}, {
  timestamps: true
});

// Index für bessere Performance bei Abfragen
ActivityLogSchema.index({ timestamp: -1 });
ActivityLogSchema.index({ 'performedBy.userId': 1 });
ActivityLogSchema.index({ module: 1 });
ActivityLogSchema.index({ actionType: 1 });
ActivityLogSchema.index({ 'details.entityId': 1 });

export default mongoose.models.ActivityLog || mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema); 