import { NextResponse } from 'next/server';
import { Project } from '../../../../lib/models/Project';
import { Employee } from '../../../../lib/models/Employee';
import ActivityLog from '../../../../lib/models/ActivityLog';
import { getCurrentUser } from '../../../../lib/auth/getCurrentUser';
import dbConnect from '../../../../lib/dbConnect';
import { requireAuth } from '../../../../lib/security/requireAuth';

/**
 * POST /api/projects/bulk-delete
 * Löscht mehrere Projekte gleichzeitig und bereinigt Mitarbeiter-Einsätze
 * 
 * Body: { projectIds: string[] }
 * Returns: { deletedCount: number, cleanedEmployees: number }
 */
export async function POST(request: Request) {
  try {
    await dbConnect();

    // CSRF-Schutz
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'projects:bulk-delete') {
      return NextResponse.json({ message: 'Ungültige Anforderung' }, { status: 400 });
    }

    // Authentifizierung: Nur Admin/Superadmin
    const auth = await requireAuth(request as any, ['admin', 'superadmin']);
    if (!auth.ok) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    // Body parsen
    const body = await request.json();
    const { projectIds } = body;

    // Validierung
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json(
        { message: 'Ungültige Projekt-IDs: Array erforderlich' },
        { status: 400 }
      );
    }

    if (projectIds.length > 100) {
      return NextResponse.json(
        { message: 'Maximal 100 Projekte können gleichzeitig gelöscht werden' },
        { status: 400 }
      );
    }

    // Projekte vor dem Löschen laden (für Activity Log)
    const projects = await Project.find({ _id: { $in: projectIds } });
    
    if (projects.length === 0) {
      return NextResponse.json(
        { message: 'Keine Projekte gefunden' },
        { status: 404 }
      );
    }

    const currentUser = await getCurrentUser(request as any);

    // 1. Mitarbeiter-Einsätze für alle Projekte entfernen
    let cleanedEmployees = 0;
    try {
      const cleanupResult = await Employee.updateMany(
        { 'einsaetze.projektId': { $in: projectIds } },
        { $pull: { einsaetze: { projektId: { $in: projectIds } } } }
      );
      cleanedEmployees = cleanupResult.modifiedCount;
      console.log(`Bulk-Delete: ${cleanedEmployees} Mitarbeiter-Einsätze bereinigt`);
    } catch (cleanupError) {
      console.error('Fehler beim Bereinigen der Mitarbeiter-Einsätze:', cleanupError);
      // Fortfahren trotz Fehler
    }

    // 2. Activity Logs erstellen (parallel, non-blocking)
    const logPromises = projects.map((project: any) =>
      ActivityLog.create({
        timestamp: new Date(),
        actionType: 'project_deleted',
        module: 'project',
        performedBy: {
          userId: currentUser?._id || 'unknown',
          name: currentUser?.name || 'Unbekannt',
          role: currentUser?.role || 'unknown'
        },
        details: {
          entityId: project._id,
          description: `Projekt "${project.name}" gelöscht (Bulk-Delete)`,
          before: {
            name: project.name,
            status: project.status,
            datumBeginn: project.datumBeginn,
            datumEnde: project.datumEnde
          }
        }
      }).catch((err: any) => {
        console.warn(`Activity Log für Projekt ${project._id} fehlgeschlagen:`, err.message);
      })
    );

    // Logs parallel erstellen (nicht auf Ergebnis warten)
    Promise.all(logPromises).catch(() => {});

    // 3. Projekte löschen
    const deleteResult = await Project.deleteMany({ _id: { $in: projectIds } });

    console.log(`Bulk-Delete abgeschlossen: ${deleteResult.deletedCount} Projekte gelöscht`);

    return NextResponse.json({
      message: `${deleteResult.deletedCount} Projekte erfolgreich gelöscht`,
      deletedCount: deleteResult.deletedCount,
      cleanedEmployees
    });

  } catch (error) {
    console.error('Fehler beim Bulk-Delete:', error);
    return NextResponse.json(
      { message: 'Fehler beim Löschen der Projekte' },
      { status: 500 }
    );
  }
}
