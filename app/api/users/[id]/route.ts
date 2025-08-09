import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import User from "../../../../lib/models/User"
import { getCurrentUser } from "../../../../lib/auth/getCurrentUser"
import ActivityLog from "../../../../lib/models/ActivityLog"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
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

    // Verhindern, dass sich der aktuelle Benutzer selbst löscht
    if (user._id.toString() === currentUser._id.toString()) {
      return NextResponse.json({ error: "Sie können sich nicht selbst löschen" }, { status: 400 });
    }

    // Verhindern, dass Superadmins gelöscht werden
    if (user.role === 'superadmin') {
      return NextResponse.json({ error: "Superadmins können nicht gelöscht werden" }, { status: 400 });
    }

    // Activity Log erstellen
    try {
      const activityLog = new ActivityLog({
        timestamp: new Date(),
        actionType: 'user_deleted',
        module: 'settings',
        performedBy: {
          userId: currentUser._id,
          name: currentUser.name,
          role: currentUser.role
        },
        details: {
          entityId: id,
          description: `Benutzer "${user.name}" gelöscht`,
          before: {
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive
          }
        }
      });
      
      await activityLog.save();
      console.log('Activity Log erstellt für Benutzer-Löschung');
    } catch (logError) {
      console.error('Fehler beim Erstellen des Activity Logs:', logError);
      // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
    }

    // Benutzer löschen
    await User.findByIdAndDelete(id);

    console.log('=== BENUTZER GELÖSCHT ===');
    console.log(`Benutzer: ${user.name} (${user.email})`);
    console.log(`Rolle: ${user.role}`);
    console.log(`Gelöscht von: ${currentUser.name} (${currentUser.role})`);
    console.log('==========================');

    return NextResponse.json({ 
      message: "Benutzer erfolgreich gelöscht"
    }, { status: 200 });
    
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten" 
    }, { status: 500 });
  }
} 