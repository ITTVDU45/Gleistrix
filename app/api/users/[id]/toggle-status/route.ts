import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../../lib/dbConnect"
import User from "../../../../../lib/models/User"
import { getCurrentUser } from "../../../../../lib/auth/getCurrentUser"
import ActivityLog from "../../../../../lib/models/ActivityLog"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    // Einheitliche Auth
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    // Prüfen ob eingeloggter Benutzer Admin oder Superadmin ist
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    // Benutzer finden
    const { id } = await params;
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Verhindern, dass sich der aktuelle Benutzer selbst deaktiviert
    if (user._id.toString() === currentUser._id.toString()) {
      return NextResponse.json({ error: "Sie können sich nicht selbst deaktivieren" }, { status: 400 });
    }

    // Verhindern, dass Superadmins deaktiviert werden
    if (user.role === 'superadmin') {
      return NextResponse.json({ error: "Superadmins können nicht deaktiviert werden" }, { status: 400 });
    }

    // Request-Body parsen
    const body = await req.json();
    const { isActive } = body;

    // Alten Status speichern für Activity Log
    const oldStatus = user.isActive;

    // Status aktualisieren
    user.isActive = isActive;
    await user.save();

    // Activity Log erstellen
    try {
      const activityLog = new ActivityLog({
        timestamp: new Date(),
        actionType: 'user_status_changed',
        module: 'settings',
        performedBy: {
          userId: currentUser._id,
          name: currentUser.name,
          role: currentUser.role
        },
        details: {
          entityId: id,
          description: `Status von "${user.name}" von "${oldStatus ? 'Aktiv' : 'Inaktiv'}" auf "${isActive ? 'Aktiv' : 'Inaktiv'}" geändert`,
          before: {
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: oldStatus
          },
          after: {
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: isActive
          }
        }
      });
      
      await activityLog.save();
      console.log('Activity Log erstellt für Benutzer-Status-Änderung');
    } catch (logError) {
      console.error('Fehler beim Erstellen des Activity Logs:', logError);
      // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
    }

    console.log('=== BENUTZER-STATUS GEÄNDERT ===');
    console.log(`Benutzer: ${user.name} (${user.email})`);
    console.log(`Neuer Status: ${isActive ? 'Aktiv' : 'Inaktiv'}`);
    console.log(`Geändert von: ${currentUser.name} (${currentUser.role})`);
    console.log('==================================');

    return NextResponse.json({ 
      message: `Benutzer erfolgreich ${isActive ? 'aktiviert' : 'deaktiviert'}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('Toggle user status error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten" 
    }, { status: 500 });
  }
} 