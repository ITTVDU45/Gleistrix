import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs'
import dbConnect from '../../../lib/dbConnect';
import ActivityLog from '../../../lib/models/ActivityLog';
import mongoose from 'mongoose';
import { getToken } from 'next-auth/jwt';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    // NextAuth Token lesen
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Datenbankverbindung nicht verfügbar' }, { status: 500 });
    }
    const usersCollection = db.collection('users');
    const currentUserId = token.id as string | undefined;
    if (!currentUserId) {
      return NextResponse.json({ error: "Ungültiges Token" }, { status: 401 });
    }
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(String(currentUserId));
    } catch (e) {
      return NextResponse.json({ error: "Ungültige Benutzer-ID" }, { status: 401 });
    }
    const currentUser = await usersCollection.findOne({ _id: objectId });
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    // Query-Parameter auslesen
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const module = searchParams.get('module');
    const actionType = searchParams.get('actionType');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    // Filter-Objekt erstellen
    const filter: any = {};

    if (module) {
      // Unterstütze mehrere Module (komma-getrennt)
      const modules = module.split(',');
      if (modules.length > 1) {
        filter.module = { $in: modules };
      } else {
        filter.module = module;
      }
    }

    if (actionType) {
      // Unterstütze mehrere ActionTypes (komma-getrennt)
      const actionTypes = actionType.split(',');
      if (actionTypes.length > 1) {
        filter.actionType = { $in: actionTypes };
      } else {
        filter.actionType = actionType;
      }
    }

    if (userId) {
      try {
        filter['performedBy.userId'] = new mongoose.Types.ObjectId(String(userId));
      } catch (e) {
        return NextResponse.json({ error: 'Ungültige Benutzer-ID' }, { status: 400 });
      }
    }

    if (dateFrom || dateTo) {
      filter.timestamp = {};
      if (dateFrom) {
        filter.timestamp.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.timestamp.$lte = new Date(dateTo);
      }
    }

    if (search) {
      filter.$or = [
        { 'performedBy.name': { $regex: search, $options: 'i' } },
        { 'details.description': { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Activity Logs abrufen (ohne populate, um fehlendes User-Model zu vermeiden)
    const logs = await ActivityLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    // Gesamtanzahl für Pagination
    const total = await ActivityLog.countDocuments(filter);

    // Daten formatieren
    const formattedLogs = logs.map(log => {
      let userIdStr: string | null = null;
      const raw = (log as any).performedBy?.userId;
      if (typeof raw === 'string') userIdStr = raw;
      else if (raw && typeof raw.toString === 'function') userIdStr = raw.toString();
      else if (raw && raw._id && typeof raw._id.toString === 'function') userIdStr = raw._id.toString();

      return ({
        id: log._id,
        timestamp: log.timestamp,
        actionType: log.actionType,
        module: log.module,
        performedBy: {
          userId: userIdStr,
          name: log.performedBy.name,
          role: log.performedBy.role
        },
        details: log.details
      });
    });

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ 
      error: "Fehler beim Laden der Aktivitäts-Logs" 
    }, { status: 500 });
  }
} 