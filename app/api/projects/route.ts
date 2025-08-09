import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/dbConnect';
import { Project } from '../../../lib/models/Project';
import ActivityLog from '../../../lib/models/ActivityLog';
import User from '../../../lib/models/User';
import { getCurrentUser } from '../../../lib/auth/getCurrentUser';
import { requireAuth } from '../../../lib/security/requireAuth';
import { z } from 'zod';

export async function GET() {
  try {
    await dbConnect();
    const projects = await Project.find({});
    
    // Projekte zu JSON konvertieren
    const projectsJson = projects.map((project: any) => ({
      ...project.toObject(),
      id: project._id?.toString(),
      _id: project._id?.toString(),
      createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
      updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : project.updatedAt,
      datumBeginn: project.datumBeginn instanceof Date ? project.datumBeginn.toISOString() : project.datumBeginn,
      datumEnde: project.datumEnde instanceof Date ? project.datumEnde.toISOString() : project.datumEnde
    }));
    
    // Debug-Log für Technik-Daten
    projectsJson.forEach((project: any, index: number) => {
      console.log(`Project ${index + 1} (${project._id}):`, {
        name: project.name,
        technikKeys: project.technik ? Object.keys(project.technik) : [],
        technikSize: project.technik ? Object.keys(project.technik).length : 0,
        technikData: project.technik
      });
    });
    
    return NextResponse.json({ 
      success: true,
      projects: projectsJson 
    });
  } catch (error) {
    console.error('Fehler beim Laden der Projekte:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Fehler beim Laden der Projekte' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'projects:create') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['admin','superadmin']);
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