import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/dbConnect';
import { Project } from '../../../lib/models/Project';
import ActivityLog from '../../../lib/models/ActivityLog';
import User from '../../../lib/models/User';
import { getCurrentUser } from '../../../lib/auth/getCurrentUser';
import { requireAuth } from '../../../lib/security/requireAuth';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // Pagination + optional search
    const url = new URL(request.url);
    const page = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10));
    const limitRaw = parseInt(url.searchParams.get('limit') || '50', 10);
    const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 50 : limitRaw), 200); // clamp 1..200
    const skip = page * limit;

    const q = (url.searchParams.get('q') || '').trim();
    // Optional includes for heavy fields
    const includeTimesParam = (url.searchParams.get('includeTimes') || '').toLowerCase();
    const includeVehiclesParam = (url.searchParams.get('includeVehicles') || '').toLowerCase();
    const includeTechnikParam = (url.searchParams.get('includeTechnik') || '').toLowerCase();
    const includeTimes = includeTimesParam === '1' || includeTimesParam === 'true';
    const includeVehicles = includeVehiclesParam === '1' || includeVehiclesParam === 'true';
    const includeTechnik = includeTechnikParam === '1' || includeTechnikParam === 'true';
    const filter: any = {};
    if (q) {
      // simple text search on name or auftragsnummer
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { auftragsnummer: { $regex: q, $options: 'i' } }
      ];
    }

    // Only select lightweight fields to reduce payload and memory
    const projection: any = {
      name: 1,
      auftragsnummer: 1,
      datumBeginn: 1,
      datumEnde: 1,
      status: 1,
      atwsImEinsatz: 1,
      anzahlAtws: 1,
      gesamtMeterlaenge: 1,
      createdAt: 1,
      updatedAt: 1
    };

    // Conditionally include heavy fields
    if (includeTimes) {
      projection.mitarbeiterZeiten = 1;
    }
    if (includeVehicles) {
      projection.fahrzeuge = 1;
    }
    if (includeTechnik) {
      projection.technik = 1;
    }

    const [projects, total] = await Promise.all([
      Project.find(filter).select(projection).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Project.countDocuments(filter)
    ]);

    // Map ids to string
    const projectsJson = projects.map((p: any) => ({
      ...p,
      id: (p._id || p.id)?.toString(),
      _id: (p._id || p.id)?.toString(),
      datumBeginn: p.datumBeginn instanceof Date ? p.datumBeginn.toISOString() : p.datumBeginn,
      datumEnde: p.datumEnde instanceof Date ? p.datumEnde.toISOString() : p.datumEnde
    }));

    // Lightweight debug: only log counts
    console.log(`Fetched projects page=${page} limit=${limit} returned=${projectsJson.length} total=${total}`);

    return NextResponse.json({
      success: true,
      projects: projectsJson,
      meta: { total, page, limit }
    });
  } catch (error) {
    console.error('Fehler beim Laden der Projekte:', error);
    return NextResponse.json({ success: false, message: 'Fehler beim Laden der Projekte' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'projects:create') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });

    const schema = z.object({
      name: z.string().min(1),
      status: z.string().optional(),
      auftraggeber: z.string().optional(),
      baustelle: z.string().optional(),
      auftragsnummer: z.string().optional(),
      datumBeginn: z.string().optional(),
      datumEnde: z.string().optional(),
    }).passthrough();
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const body = parseResult.data;
    const currentUser = await getCurrentUser(request);
    
    const project = await Project.create(body);
    
    // Activity Log erstellen
    if (currentUser) {
      try {
        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType: 'project_created',
          module: 'project',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name,
            role: currentUser.role
          },
          details: {
            entityId: project._id,
            description: `Projekt "${body.name}" erstellt`,
            after: {
              name: body.name,
              status: body.status,
              datumBeginn: body.datumBeginn,
              datumEnde: body.datumEnde
            }
          }
        });
        
        await activityLog.save();
        console.log('Activity Log erstellt für Projekt-Erstellung');
      } catch (logError) {
        console.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }
    
    return NextResponse.json({ 
      success: true,
      project: project 
    }, { status: 201 });
  } catch (error) {
    console.error('Fehler beim Erstellen des Projekts:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Fehler beim Erstellen des Projekts' 
      },
      { status: 500 }
    );
  }
} 