import mongoose from 'mongoose';

interface ILock {
  resourceType: string;
  resourceId: string; // Geändert von mongoose.Types.ObjectId zu string
  lockedBy: {
    userId: mongoose.Types.ObjectId;
    name: string;
    role: string;
  };
  lockedAt: Date;
  lastActivity: Date;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
}

interface ILockModel extends mongoose.Model<ILock> {
  isLocked(resourceType: string, resourceId: string): Promise<ILock | null>;
  createLock(
    resourceType: string,
    resourceId: string,
    userId: string,
    userName: string,
    userRole: string,
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<ILock>;
  releaseLock(resourceType: string, resourceId: string, userId: string): Promise<boolean>;
  updateActivity(resourceType: string, resourceId: string, userId: string): Promise<boolean>;
  cleanupExpiredLocks(): Promise<number>;
}

const LockSchema = new mongoose.Schema<ILock>({
  // Welche Ressource wird gesperrt
  resourceType: {
    type: String,
    required: true,
    enum: ['project', 'employee', 'vehicle']
  },
  
  // ID der gesperrten Ressource (kann ObjectId oder String sein)
  resourceId: {
    type: String,
    required: true
  },
  
  // Benutzer, der die Sperre hält
  lockedBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true
    }
  },
  
  // Zeitpunkt der Sperrung
  lockedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // Zeitpunkt der letzten Aktivität (wird regelmäßig aktualisiert)
  lastActivity: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // Session-ID für zusätzliche Sicherheit
  sessionId: {
    type: String,
    required: true
  },
  
  // IP-Adresse des Benutzers
  ipAddress: {
    type: String,
    required: true
  },
  
  // Benutzer-Agent für zusätzliche Identifikation
  userAgent: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Index für schnelle Abfragen
LockSchema.index({ resourceType: 1, resourceId: 1 });
LockSchema.index({ lockedAt: 1 });
LockSchema.index({ lastActivity: 1 });

// Automatisches Löschen abgelaufener Sperren (nach 15 Minuten Inaktivität)
// Nur EIN Index definieren, um Duplicate-Index-Warnungen zu vermeiden
try {
  LockSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 900 });
} catch (e) {
  // Ignorieren, falls bereits vorhanden (Mongoose meldet sonst Duplicate Warning)
}

// Statische Methode zum Prüfen, ob eine Ressource gesperrt ist
LockSchema.statics.isLocked = async function(resourceType: string, resourceId: string) {
  // Kein populate verwenden, um Abhängigkeit von registriertem User-Model zu vermeiden
  const lock = await this.findOne({
    resourceType,
    resourceId,
    lastActivity: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Nur aktive Sperren (letzte 15 Min)
  });
  
  return lock;
};

// Statische Methode zum Erstellen einer Sperre
LockSchema.statics.createLock = async function(
  resourceType: string, 
  resourceId: string, 
  userId: string, 
  userName: string, 
  userRole: string,
  sessionId: string,
  ipAddress: string,
  userAgent: string
) {
  // Atomische Operation: Prüfen und Erstellen in einer Transaktion
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Prüfen, ob bereits eine Sperre existiert
      const existingLock = await this.findOne({
        resourceType,
        resourceId,
        lastActivity: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
      }).session(session);
      
      if (existingLock) {
        // Wenn die Sperre vom gleichen Benutzer ist, aktualisieren wir sie
        if (existingLock.lockedBy.userId.toString() === userId) {
          existingLock.lastActivity = new Date();
          await existingLock.save({ session });
          return existingLock;
        } else {
          throw new Error('Ressource ist bereits von einem anderen Benutzer gesperrt');
        }
      }
      
      // Alle bestehenden Sperren für diese Ressource löschen (Cleanup)
      await this.deleteMany({
        resourceType,
        resourceId
      }).session(session);
      
      // Neue Sperre erstellen
      const lock = new this({
        resourceType,
        resourceId,
        lockedBy: {
          userId,
          name: userName,
          role: userRole
        },
        sessionId,
        ipAddress,
        userAgent
      });
      
      await lock.save({ session });
      return lock;
    });
    
    // Nach erfolgreicher Transaktion die Sperre zurückgeben
    const lock = await this.findOne({
      resourceType,
      resourceId,
      'lockedBy.userId': userId
    });
    
    return lock;
  } catch (error) {
    console.error('Fehler beim Erstellen der Sperre:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};

// Statische Methode zum Freigeben einer Sperre
LockSchema.statics.releaseLock = async function(resourceType: string, resourceId: string, userId: string) {
  console.log(`=== SPERRE FREIGEBEN ===`);
  console.log(`Ressource: ${resourceType}/${resourceId}`);
  console.log(`Benutzer-ID: ${userId}`);
  
  // Alle Sperren für diese Ressource finden
  const existingLocks = await this.find({
    resourceType,
    resourceId
  });
  
  console.log(`Gefundene Sperren: ${existingLocks.length}`);
  
  if (existingLocks.length > 0) {
    // Alle Sperren für diese Ressource löschen (nicht nur die des aktuellen Benutzers)
    const result = await this.deleteMany({
      resourceType,
      resourceId
    });
    
    console.log(`Freigegebene Sperren: ${result.deletedCount} für ${resourceType}/${resourceId}`);
    console.log(`===========================`);
    
    return result.deletedCount > 0;
  } else {
    console.log(`Keine Sperren gefunden für ${resourceType}/${resourceId}`);
    console.log(`===========================`);
    
    return false;
  }
};

// Statische Methode zum Aktualisieren der Aktivität
LockSchema.statics.updateActivity = async function(resourceType: string, resourceId: string, userId: string) {
  const lock = await this.findOne({
    resourceType,
    resourceId,
    'lockedBy.userId': userId
  });
  
  if (lock) {
    lock.lastActivity = new Date();
    await lock.save();
    return true;
  }
  
  return false;
};

// Statische Methode zum Bereinigen abgelaufener Sperren
LockSchema.statics.cleanupExpiredLocks = async function() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const result = await this.deleteMany({
    lastActivity: { $lt: thirtyMinutesAgo }
  });
  
  console.log(`Bereinigt: ${result.deletedCount} abgelaufene Sperren`);
  return result.deletedCount;
};

type LockModelType = mongoose.Model<ILock> & ILockModel;

const Lock = (mongoose.models.Lock as LockModelType) || (mongoose.model<ILock>('Lock', LockSchema) as LockModelType);

export default Lock;