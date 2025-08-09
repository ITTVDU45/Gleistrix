import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/dbConnect';
import { Project } from '../../../../../lib/models/Project';
import ActivityLog from '../../../../../lib/models/ActivityLog';
import { getCurrentUser } from '../../../../../lib/auth/getCurrentUser';
import { requireAuth } from '../../../../../lib/security/requireAuth';
import { z } from 'zod';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'project-technik:create') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const schema = z.object({
      date: z.string().min(8),
      technik: z.object({
        name: z.string().min(1),
        anzahl: z.number().int().nonnegative(),
        meterlaenge: z.number().nonnegative(),
        bemerkung: z.string().optional().or(z.literal('')),
      })
    });
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { date, technik } = parseResult.data;

    const currentUser = await getCurrentUser(request);

    console.log('Technik POST Request:', { id, date, technik });

    if (!date || !technik) {
      return NextResponse.json(
        { error: 'Datum oder Technikdaten fehlen' },
        { status: 400 }
      );
    }

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Projekt nicht gefunden' },
        { status: 404 }
      );
    }

    console.log('Vor dem Speichern - Projekt Technik:', {
      hasTechnik: !!project.technik,
      technikType: typeof project.technik,
      technikKeys: project.technik ? Object.keys(project.technik) : []
    });

    // Neue Technik erstellen
    const newTechnik = {
      id: Date.now().toString(),
      name: technik.name,
      anzahl: technik.anzahl,
      meterlaenge: technik.meterlaenge,
      bemerkung: technik.bemerkung || ''
    };

    // Technik-Objekt initialisieren falls nicht vorhanden
    if (!project.technik) {
      project.technik = {};
    }
    
    // Array für das Datum initialisieren falls nicht vorhanden
    if (!project.technik[date]) {
      project.technik[date] = [];
    }
    
    // Neue Technik hinzufügen
    project.technik[date].push(newTechnik);

    // ATW-Status und Meterlänge aktualisieren
    const allTechnik: any[] = [];
    Object.values(project.technik).forEach((technikArray: any) => {
      if (Array.isArray(technikArray)) {
        allTechnik.push(...technikArray.filter(item => item && typeof item === 'object'));
      }
    });
    
    project.atwsImEinsatz = allTechnik.length > 0;
    project.anzahlAtws = allTechnik.reduce((sum: number, t: any) => sum + (t?.anzahl || 0), 0);
    project.gesamtMeterlaenge = allTechnik.reduce((sum: number, t: any) => sum + (t?.meterlaenge || 0), 0);
    
    console.log('Saving project with technik:', {
      technikSize: Object.keys(project.technik).length,
      technikKeys: Object.keys(project.technik),
      atwsImEinsatz: project.atwsImEinsatz,
      anzahlAtws: project.anzahlAtws,
      gesamtMeterlaenge: project.gesamtMeterlaenge
    });
    
    // Projekt speichern
    project.markModified('technik');
    await project.save();
    
    // Activity Log erstellen
    if (currentUser) {
      try {
        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType: 'project_technology_added',
          module: 'project',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name,
            role: currentUser.role
          },
          details: {
            entityId: id,
            description: `Technik "${technik.name}" (${technik.anzahl}x) zum Projekt "${project.name}" hinzugefügt`,
            after: {
              projectName: project.name,
              technikName: technik.name,
              anzahl: technik.anzahl,
              meterlaenge: technik.meterlaenge,
              date: date
            }
          }
        });
        
        await activityLog.save();
        console.log('Activity Log erstellt für Technik-Hinzufügung');
      } catch (logError) {
        console.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }
    
    // Projekt als JSON konvertieren für die Rückgabe
    const projectJson = project.toObject();
    
    console.log('Nach dem Speichern - Gespeicherte Technik:', {
      hasTechnik: !!projectJson.technik,
      technikKeys: projectJson.technik ? Object.keys(projectJson.technik) : [],
      technikData: projectJson.technik
    });
    
    return NextResponse.json({ 
      success: true, 
      project: projectJson,
      addedTechnik: newTechnik
    }, { status: 201 });
  } catch (error) {
    console.error('Fehler beim Hinzufügen der Technik:', error);
    return NextResponse.json(
      { error: 'Fehler beim Hinzufügen der Technik' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'project-technik:update') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const schema = z.object({
      date: z.string().min(8),
      technikId: z.string().min(1),
      updatedTechnik: z.object({
        name: z.string().min(1),
        anzahl: z.number().int().nonnegative(),
        meterlaenge: z.number().nonnegative(),
        bemerkung: z.string().optional().or(z.literal('')),
      }),
      selectedDays: z.array(z.string()).optional(),
    });
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { date, technikId, updatedTechnik, selectedDays } = parseResult.data;

    console.log('Technik PUT Request Body:', body);
    console.log('Technik PUT Request Parsed:', { id, date, technikId, updatedTechnik, selectedDays });

    // Verbesserte Validierung
    if (!date) {
      console.error('Fehlende date in Request');
      return NextResponse.json(
        { error: 'Fehlende date zum Bearbeiten' },
        { status: 400 }
      );
    }

    if (!technikId) {
      console.error('Fehlende technikId in Request');
      return NextResponse.json(
        { error: 'Fehlende technikId zum Bearbeiten' },
        { status: 400 }
      );
    }

    if (!updatedTechnik) {
      console.error('Fehlende updatedTechnik in Request');
      return NextResponse.json(
        { error: 'Fehlende updatedTechnik zum Bearbeiten' },
        { status: 400 }
      );
    }

    // Validierung der updatedTechnik Felder
    if (!updatedTechnik.name || !updatedTechnik.anzahl || updatedTechnik.meterlaenge === undefined) {
      console.error('Ungültige updatedTechnik Felder:', updatedTechnik);
      return NextResponse.json(
        { error: 'Ungültige Technik-Daten (name, anzahl, meterlaenge erforderlich)' },
        { status: 400 }
      );
    }

    const project = await Project.findById(id);
    if (!project) {
      console.error('Projekt nicht gefunden:', id);
      return NextResponse.json(
        { error: 'Projekt nicht gefunden' },
        { status: 404 }
      );
    }

    console.log('Projekt gefunden, Technik vor Bearbeitung:', {
      hasTechnik: !!project.technik,
      technikKeys: project.technik ? Object.keys(project.technik) : []
    });

    // Wenn selectedDays vorhanden sind, bearbeite für alle ausgewählten Tage
    if (selectedDays && Array.isArray(selectedDays) && selectedDays.length > 0) {
      console.log('Bearbeite Technik für mehrere Tage:', selectedDays);
      
      for (const selectedDate of selectedDays) {
        if (!project.technik) {
          project.technik = {};
        }
        
        if (!project.technik[selectedDate]) {
          project.technik[selectedDate] = [];
        }

        const currentTechnik = project.technik[selectedDate] || [];
        const idx = currentTechnik.findIndex((t: any) => t.id === technikId);
        
        if (idx !== -1) {
          // Bestehenden Eintrag aktualisieren
          currentTechnik[idx] = { ...currentTechnik[idx], ...updatedTechnik };
          console.log(`Technik aktualisiert für ${selectedDate}:`, currentTechnik[idx]);
        } else {
          // Neuen Eintrag für diesen Tag erstellen
          const newTechnik = {
            id: technikId,
            name: updatedTechnik.name,
            anzahl: updatedTechnik.anzahl,
            meterlaenge: updatedTechnik.meterlaenge,
            bemerkung: updatedTechnik.bemerkung || ''
          };
          currentTechnik.push(newTechnik);
          console.log(`Neue Technik erstellt für ${selectedDate}:`, newTechnik);
        }
        
        project.technik[selectedDate] = currentTechnik;
      }
    } else {
      // Einzelner Tag (ursprüngliche Logik)
      console.log('Bearbeite Technik für einzelnen Tag:', date);
      
      if (!project.technik || !project.technik[date]) {
        console.error('Kein Technik-Eintrag für Datum:', date);
        return NextResponse.json(
          { error: 'Kein Technik-Eintrag für dieses Datum' },
          { status: 404 }
        );
      }

      const currentTechnik = project.technik[date] || [];
      const idx = currentTechnik.findIndex((t: any) => t.id === technikId);
      if (idx === -1) {
        console.error('Technik-Eintrag nicht gefunden für ID:', technikId);
        return NextResponse.json(
          { error: 'Technik-Eintrag nicht gefunden' },
          { status: 404 }
        );
      }

      currentTechnik[idx] = { ...currentTechnik[idx], ...updatedTechnik };
      project.technik[date] = currentTechnik;
      console.log('Technik aktualisiert für einzelnen Tag:', currentTechnik[idx]);
    }

    // ATW-Status und Meterlänge aktualisieren
    const allTechnik: any[] = [];
    Object.values(project.technik).forEach((technikArray: any) => {
      if (Array.isArray(technikArray)) {
        allTechnik.push(...technikArray.filter(item => item && typeof item === 'object'));
      }
    });
    
    project.atwsImEinsatz = allTechnik.length > 0;
    project.anzahlAtws = allTechnik.reduce((sum: number, t: any) => sum + (t?.anzahl || 0), 0);
    project.gesamtMeterlaenge = allTechnik.reduce((sum: number, t: any) => sum + (t?.meterlaenge || 0), 0);
    
    console.log('Projekt nach Bearbeitung:', {
      atwsImEinsatz: project.atwsImEinsatz,
      anzahlAtws: project.anzahlAtws,
      gesamtMeterlaenge: project.gesamtMeterlaenge,
      technikKeys: Object.keys(project.technik)
    });
    
    project.markModified('technik');
    await project.save();
    
    const projectJson = project.toObject();
    console.log('Projekt erfolgreich gespeichert');
    
    return NextResponse.json({ success: true, project: projectJson });
  } catch (error) {
    console.error('Fehler beim Bearbeiten der Technik:', error);
    return NextResponse.json(
      { error: 'Serverfehler', details: error },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'project-technik:delete') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const schema = z.object({ date: z.string().min(8), technikId: z.string().min(1) });
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { date, technikId } = parseResult.data;

    console.log('Technik DELETE Request:', { id, date, technikId });

    if (!date || !technikId) {
      return NextResponse.json(
        { error: 'Fehlende Daten zum Löschen' },
        { status: 400 }
      );
    }

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Projekt nicht gefunden' },
        { status: 404 }
      );
    }

    if (!project.technik || !project.technik[date]) {
      return NextResponse.json(
        { error: 'Kein Technik-Eintrag für dieses Datum' },
        { status: 404 }
      );
    }

    const currentTechnik = project.technik[date] || [];
    const filteredTechnik = currentTechnik.filter((t: any) => t.id !== technikId);
    
    if (filteredTechnik.length === 0) {
      delete project.technik[date];
    } else {
      project.technik[date] = filteredTechnik;
    }

    // ATW-Status und Meterlänge aktualisieren
    const allTechnik: any[] = [];
    Object.values(project.technik).forEach((technikArray: any) => {
      if (Array.isArray(technikArray)) {
        allTechnik.push(...technikArray.filter(item => item && typeof item === 'object'));
      }
    });
    
    project.atwsImEinsatz = allTechnik.length > 0;
    project.anzahlAtws = allTechnik.reduce((sum: number, t: any) => sum + (t?.anzahl || 0), 0);
    project.gesamtMeterlaenge = allTechnik.reduce((sum: number, t: any) => sum + (t?.meterlaenge || 0), 0);
    
    project.markModified('technik');
    await project.save();
    
    const projectJson = project.toObject();
    return NextResponse.json({ success: true, project: projectJson });
  } catch (error) {
    console.error('Fehler beim Löschen der Technik:', error);
    return NextResponse.json(
      { error: 'Serverfehler', details: error },
      { status: 500 }
    );
  }
} 