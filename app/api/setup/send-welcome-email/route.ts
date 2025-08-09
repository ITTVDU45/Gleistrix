import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import User from "../../../../lib/models/User"
import { sendWelcomeEmail } from "../../../../lib/mailer"

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    // Superadmin in der Datenbank finden
    const superadmin = await User.findOne({ role: 'superadmin' });
    
    if (!superadmin) {
      return NextResponse.json({ 
        error: "Kein Superadmin in der Datenbank gefunden" 
      }, { status: 404 });
    }

    // Prüfen ob E-Mail bereits gesendet wurde
    if (superadmin.welcomeEmailSent) {
      return NextResponse.json({ 
        error: "Willkommens-E-Mail wurde bereits gesendet",
        message: `E-Mail wurde bereits am ${superadmin.welcomeEmailSentAt?.toLocaleDateString('de-DE')} um ${superadmin.welcomeEmailSentAt?.toLocaleTimeString('de-DE')} gesendet.`,
        user: {
          email: superadmin.email,
          name: superadmin.name,
          role: superadmin.role,
          welcomeEmailSent: superadmin.welcomeEmailSent,
          welcomeEmailSentAt: superadmin.welcomeEmailSentAt
        }
      }, { status: 409 });
    }

    // E-Mail an Superadmin senden
    const emailSent = await sendWelcomeEmail(superadmin.email, superadmin.name);

    if (emailSent) {
      // Markieren dass E-Mail gesendet wurde
      superadmin.welcomeEmailSent = true;
      superadmin.welcomeEmailSentAt = new Date();
      await superadmin.save();

      return NextResponse.json({ 
        message: "Willkommens-E-Mail erfolgreich an Superadmin gesendet",
        user: {
          email: superadmin.email,
          name: superadmin.name,
          role: superadmin.role,
          welcomeEmailSent: true,
          welcomeEmailSentAt: superadmin.welcomeEmailSentAt
        }
      }, { status: 200 });
    } else {
      return NextResponse.json({ 
        error: "E-Mail-Versand fehlgeschlagen" 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Send welcome email error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." 
    }, { status: 500 });
  }
} 