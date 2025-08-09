import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

// Einfache Datenbankverbindung mit Atlas
async function dbConnect() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  return mongoose.connect(process.env.MONGODB_URI || '');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Ungültige Mitarbeiter-ID' },
        { status: 400 }
      );
    }

    // Lade den Mitarbeiter direkt aus der Datenbank
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Datenbankverbindung nicht verfügbar');
    }

    const employee = await db.collection('employees').findOne({
    _id: new mongoose.Types.ObjectId(String(id))
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Mitarbeiter nicht gefunden' },
        { status: 404 }
      );
    }

    console.log('=== DEBUG: MITARBEITER AUS ATLAS DATENBANK ===');
    console.log('Raw employee from database:', JSON.stringify(employee, null, 2));
    console.log('vacationDays field:', employee.vacationDays);
    console.log('vacationDays type:', typeof employee.vacationDays);
    console.log('vacationDays length:', employee.vacationDays ? employee.vacationDays.length : 'undefined');

    return NextResponse.json({ 
      success: true, 
      employee: employee,
      debug: {
        vacationDays: employee.vacationDays,
        vacationDaysType: typeof employee.vacationDays,
        vacationDaysLength: employee.vacationDays ? employee.vacationDays.length : 'undefined'
      }
    });
  } catch (error) {
    console.error('Debug-Fehler:', error);
    return NextResponse.json(
      { error: 'Debug-Fehler: ' + error },
      { status: 500 }
    );
  }
} 