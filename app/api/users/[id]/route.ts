import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import User from "../../../../lib/models/User"
import { getCurrentUser } from "../../../../lib/auth/getCurrentUser"
import ActivityLog from "../../../../lib/models/ActivityLog"
import { z } from "zod"
import { MODULE_ID_ENUM } from "@/lib/constants/modules"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()

    const currentUser = await getCurrentUser(req)
    if (!currentUser) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 })
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'superadmin') {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })
    }

    const { id } = await params
    const user = await User.findById(id)
    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 })
    }

    if (user.role === 'superadmin' && currentUser.role !== 'superadmin') {
      return NextResponse.json({ error: "Superadmins können nur von anderen Superadmins bearbeitet werden" }, { status: 403 })
    }

    const schema = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      role: z.enum(['admin', 'user', 'lager']).optional(),
      modules: z.array(z.enum(MODULE_ID_ENUM)).optional(),
      isActive: z.boolean().optional(),
    })

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Validierungsfehler", issues: parsed.error.flatten() }, { status: 400 })
    }

    const body = parsed.data
    const before = {
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      modules: user.modules,
    }

    if (body.email && body.email !== user.email) {
      const existing = await User.findOne({ email: body.email })
      if (existing && existing._id.toString() !== id) {
        return NextResponse.json({ error: "Ein Benutzer mit dieser E-Mail existiert bereits" }, { status: 409 })
      }
      user.email = body.email
    }

    if (body.firstName !== undefined) user.firstName = body.firstName
    if (body.lastName !== undefined) user.lastName = body.lastName
    if (body.firstName !== undefined || body.lastName !== undefined) {
      user.name = `${body.firstName ?? user.firstName ?? ''} ${body.lastName ?? user.lastName ?? ''}`.trim()
    }
    if (body.phone !== undefined) user.phone = body.phone
    if (body.role !== undefined && user.role !== 'superadmin') user.role = body.role
    if (body.modules !== undefined) user.modules = body.modules
    if (body.isActive !== undefined && user.role !== 'superadmin') user.isActive = body.isActive

    await user.save()

    try {
      await new ActivityLog({
        timestamp: new Date(),
        actionType: 'user_updated',
        module: 'settings',
        performedBy: {
          userId: currentUser._id,
          name: currentUser.name,
          role: currentUser.role
        },
        details: {
          entityId: id,
          description: `Benutzer "${user.name}" bearbeitet`,
          before,
          after: {
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            isActive: user.isActive,
            modules: user.modules,
          }
        }
      }).save()
    } catch (logError) {
      console.error('Activity Log Fehler:', logError)
    }

    return NextResponse.json({
      message: "Benutzer aktualisiert",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        modules: user.modules ?? [],
      }
    })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: "Ein Fehler ist aufgetreten" }, { status: 500 })
  }
}

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