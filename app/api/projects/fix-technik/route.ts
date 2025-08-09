import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/dbConnect';
import { Project } from '../../../../lib/models/Project';

export async function POST() {
  try {
    await dbConnect();
    
    // Alle Projekte laden
    const projects = await Project.find({});
    let fixedCount = 0;
    
    for (const project of projects) {
      let needsUpdate = false;
      
      // Technik-Feld bereinigen
      if (project.technik && project.technik instanceof Map) {
        console.log(`Fixing technik for project ${project._id}:`, {
          before: project.technik,
          size: project.technik.size
        });
        
        // Map zu Objekt konvertieren
        const technikObject: any = {};
        project.technik.forEach((value: any, key: any) => {
          technikObject[key] = value;
        });
        
        project.technik = technikObject;
        needsUpdate = true;
        console.log(`Converted technik to:`, technikObject);
      }
      
      // MitarbeterZeiten-Feld bereinigen
      if (project.mitarbeiterZeiten && project.mitarbeiterZeiten instanceof Map) {
        console.log(`Fixing mitarbeiterZeiten for project ${project._id}`);
        
        const zeitenObject: any = {};
        project.mitarbeiterZeiten.forEach((value: any, key: any) => {
          zeitenObject[key] = value;
        });
        
        project.mitarbeiterZeiten = zeitenObject;
        needsUpdate = true;
      }
      
      // Fahrzeuge-Feld bereinigen
      if (project.fahrzeuge && project.fahrzeuge instanceof Map) {
        console.log(`Fixing fahrzeuge for project ${project._id}`);
        
        const fahrzeugeObject: any = {};
        project.fahrzeuge.forEach((value: any, key: any) => {
          fahrzeugeObject[key] = value;
        });
        
        project.fahrzeuge = fahrzeugeObject;
        needsUpdate = true;
      }
      
      // Projekt speichern wenn Änderungen vorgenommen wurden
      if (needsUpdate) {
        project.markModified('technik');
        project.markModified('mitarbeiterZeiten');
        project.markModified('fahrzeuge');
        await project.save();
        fixedCount++;
        console.log(`Fixed project ${project._id}`);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `${fixedCount} Projekte wurden bereinigt`,
      fixedCount 
    });
    
  } catch (error) {
    console.error('Fehler beim Bereinigen der Projekte:', error);
    return NextResponse.json(
      { error: 'Serverfehler', details: error },
      { status: 500 }
    );
  }
} 