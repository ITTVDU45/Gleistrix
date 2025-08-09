import nodemailer from 'nodemailer';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>; 
}

function firstEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k as keyof NodeJS.ProcessEnv];
    if (v && String(v).length > 0) return String(v);
  }
  return undefined;
}

export async function sendEmailResult(emailData: EmailData): Promise<{ ok: boolean; error?: string }>{
  try {
    // Basiskonfig prüfen
    const missing: string[] = [];
    const host = firstEnv('EMAIL_HOST', 'EMAIL_SERVER', 'SMTP_HOST', 'MAIL_HOST');
    const portStr = firstEnv('EMAIL_PORT', 'SMTP_PORT');
    const user = firstEnv('EMAIL_FROM', 'EMAIL_USER'); // bevorzugt Absenderadresse, sonst USER
    const pass = firstEnv('EMAIL_PASS');
    if (!host) missing.push('EMAIL_HOST');
    if (!portStr) missing.push('EMAIL_PORT');
    if (!user) missing.push('EMAIL_USER/EMAIL_FROM');
    if (!pass) missing.push('EMAIL_PASS');
    if (missing.length) {
      return { ok: false, error: `SMTP Konfiguration fehlt: ${missing.join(', ')}` };
    }

    const port = parseInt(portStr || '587', 10);
    const secure = firstEnv('EMAIL_SECURE') ? firstEnv('EMAIL_SECURE') === 'true' : port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    // Verbindung testen für genauere Fehler
    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      const vm = typeof verifyErr?.message === 'string' ? verifyErr.message : String(verifyErr);
      return { ok: false, error: `SMTP Verify fehlgeschlagen (${host}:${port}${secure ? ' secure' : ''}): ${vm}` };
    }

    const fromDisplay = firstEnv('EMAIL_FROM_NAME') || firstEnv('EMAIL_FROM') || 'Gleistrix';
    const fromEmail = (firstEnv('EMAIL_FROM') && /@/.test(firstEnv('EMAIL_FROM')!)) ? firstEnv('EMAIL_FROM')! : (firstEnv('EMAIL_USER')!);

    const mailOptions: any = {
      from: `${fromDisplay} <${fromEmail}>`,
      replyTo: process.env.EMAIL_REPLY_TO || fromEmail,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    };

    if (emailData.attachments && emailData.attachments.length > 0) {
      mailOptions.attachments = emailData.attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    if (process.env.NODE_ENV !== 'production') {
      console.log('=== E-MAIL ERFOLGREICH GESENDET ===');
      console.log(`Message ID: ${info.messageId}`);
      console.log(`Von: ${mailOptions.from}`);
      console.log(`An: ${emailData.to}`);
      console.log(`Betreff: ${emailData.subject}`);
      console.log('=====================================');
    }
    return { ok: true };
  } catch (error: any) {
    console.error('E-Mail-Versand fehlgeschlagen:', error);
    const message = typeof error?.message === 'string' ? error.message : 'Unbekannter SMTP-Fehler';
    if (process.env.NODE_ENV !== 'production') {
      console.log('=== E-MAIL DEMO-LOGGING (Fallback) ===');
      console.log(`An: ${emailData.to}`);
      console.log(`Betreff: ${emailData.subject}`);
      console.log(`Fehler: ${message}`);
      console.log('========================================');
    }
    return { ok: false, error: message };
  }
}

// Abwärtskompatibel: boolesches Ergebnis
export async function sendEmail(emailData: EmailData): Promise<boolean> {
  const res = await sendEmailResult(emailData);
  return res.ok;
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const emailData: EmailData = {
    to: email,
    subject: 'Willkommen bei MH-ZEITERFASSUNG - Superadmin-Account erstellt',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #114F6B; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">${process.env.EMAIL_FROM || 'Mülheimer Wachdienst'}</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">MH-ZEITERFASSUNG</p>
        </div>
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #114F6B; margin-bottom: 20px;">Willkommen bei MH-ZEITERFASSUNG!</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #333;">Hallo ${name},</p>
          <p style="font-size: 16px; line-height: 1.6; color: #333;">Ihr Superadmin-Account wurde erfolgreich erstellt.</p>
          <p style="font-size: 16px; line-height: 1.6; color: #333;">Sie können sich jetzt mit Ihrer E-Mail-Adresse und dem von Ihnen gewählten Passwort anmelden.</p>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #1976d2;">Anmeldedaten:</p>
            <p style="margin: 5px 0 0 0; color: #333;"><strong>E-Mail:</strong> ${email}</p>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; color: #333;">Viele Grüße<br>Ihr ${process.env.EMAIL_FROM || 'Mülheimer Wachdienst'} Team</p>
        </div>
      </div>
    `,
    text: `
      Willkommen bei MH-ZEITERFASSUNG!
      
      Hallo ${name},
      
      Ihr Superadmin-Account wurde erfolgreich erstellt.
      Sie können sich jetzt mit Ihrer E-Mail-Adresse und dem von Ihnen gewählten Passwort anmelden.
      
      Anmeldedaten:
      E-Mail: ${email}
      
      Viele Grüße
      Ihr ${process.env.EMAIL_FROM || 'Mülheimer Wachdienst'} Team
    `
  };
  
  return sendEmail(emailData);
} 

export async function sendInviteEmail(email: string, name: string, role: string, inviteLink: string, expiresAt: Date): Promise<boolean> {
  const roleDisplayName = role === 'admin' ? 'Administrator' : 'Benutzer';
  
  const emailData: EmailData = {
    to: email,
    subject: `Einladung zu MH-ZEITERFASSUNG - ${roleDisplayName} Account`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #114F6B; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">${process.env.EMAIL_FROM || 'Mülheimer Wachdienst'}</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">MH-ZEITERFASSUNG</p>
        </div>
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #114F6B; margin-bottom: 20px;">Einladung zu MH-ZEITERFASSUNG</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #333;">Hallo ${name},</p>
          <p style="font-size: 16px; line-height: 1.6; color: #333;">Sie wurden eingeladen, sich bei MH-ZEITERFASSUNG als ${roleDisplayName} zu registrieren.</p>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #1976d2;">Ihre Einladung:</p>
            <p style="margin: 5px 0 0 0; color: #333;"><strong>Rolle:</strong> ${roleDisplayName}</p>
            <p style="margin: 5px 0 0 0; color: #333;"><strong>Gültig bis:</strong> ${expiresAt.toLocaleString('de-DE')}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" style="background-color: #114F6B; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Passwort setzen und Account aktivieren
            </a>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6; color: #666; margin-top: 20px;">
            <strong>Wichtig:</strong> Dieser Link ist nur 24 Stunden gültig. Falls der Link nicht funktioniert, 
            kopieren Sie diese URL in Ihren Browser: <br>
            <span style="word-break: break-all; color: #1976d2;">${inviteLink}</span>
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #333;">Viele Grüße<br>Ihr ${process.env.EMAIL_FROM || 'Mülheimer Wachdienst'} Team</p>
        </div>
      </div>
    `,
    text: `
      Einladung zu MH-ZEITERFASSUNG
      
      Hallo ${name},
      
      Sie wurden eingeladen, sich bei MH-ZEITERFASSUNG als ${roleDisplayName} zu registrieren.
      
      Ihre Einladung:
      Rolle: ${roleDisplayName}
      Gültig bis: ${expiresAt.toLocaleString('de-DE')}
      
      Klicken Sie auf den folgenden Link, um Ihr Passwort zu setzen und Ihren Account zu aktivieren:
      ${inviteLink}
      
      Wichtig: Dieser Link ist nur 24 Stunden gültig.
      
      Viele Grüße
      Ihr ${process.env.EMAIL_FROM || 'Mülheimer Wachdienst'} Team
    `
  };
  
  return sendEmail(emailData);
} 