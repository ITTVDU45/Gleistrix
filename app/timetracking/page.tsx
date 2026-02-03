import TimeTrackingWithFilter from '../../components/TimeTrackingWithFilter';
import dbConnect from '../../lib/dbConnect';
import { Project as ProjectModel } from '../../lib/models/Project';
import { Employee as EmployeeModel } from '../../lib/models/Employee';

// Server-seitige Datenabfrage
async function getTimeTrackingData() {
  try {
    await dbConnect();
    const [projects, employees] = await Promise.all([
      ProjectModel.find({}).lean(),
      EmployeeModel.find({}).lean()
    ]);
    // Convert Mongoose _id (ObjectId/Buffer) to string for client-safe serialization
    const toPlainId = (v: any): string | undefined =>
      v == null ? undefined : typeof v === 'object' && typeof v.toString === 'function' ? v.toString() : String(v);

    return {
      projects: projects.map((project: any) => {
        const mitarbeiterZeiten = project.mitarbeiterZeiten || {};
        const serializedMitarbeiterZeiten: Record<string, any[]> = {};
        for (const [day, entries] of Object.entries(mitarbeiterZeiten)) {
          serializedMitarbeiterZeiten[day] = (entries as any[]).map((entry: any) => ({
            ...entry,
            _id: entry._id != null ? toPlainId(entry._id) : undefined
          }));
        }
        return {
          ...project,
          id: project._id?.toString() || project.id,
          _id: project._id?.toString(),
          createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
          updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : project.updatedAt,
          datumBeginn: project.datumBeginn instanceof Date ? project.datumBeginn.toISOString() : project.datumBeginn,
          datumEnde: project.datumEnde instanceof Date ? project.datumEnde.toISOString() : project.datumEnde,
          mitarbeiterZeiten: serializedMitarbeiterZeiten
        };
      }),
      employees: employees.map((employee: any) => ({
        ...employee,
        id: employee._id?.toString() || employee.id,
        _id: employee._id?.toString(),
        createdAt: employee.createdAt instanceof Date ? employee.createdAt.toISOString() : employee.createdAt,
        updatedAt: employee.updatedAt instanceof Date ? employee.updatedAt.toISOString() : employee.updatedAt,
        // Serialize einsaetze so _id (ObjectId/Buffer) is not passed to Client Components
        einsaetze: (employee.einsaetze || []).map((e: any) => ({
          projektId: e.projektId,
          datum: e.datum,
          stunden: e.stunden,
          fahrtstunden: e.fahrtstunden,
          funktion: e.funktion,
          entryId: e.entryId,
          _id: e._id != null ? (typeof e._id === 'object' && typeof (e._id as any).toString === 'function' ? (e._id as any).toString() : String(e._id)) : undefined
        }))
      }))
    };
  } catch (error) {
    console.error('Fehler beim Laden der Zeiterfassungsdaten:', error);
    return { projects: [], employees: [] };
  }
}

export default async function TimeTrackingPage() {
  const { projects, employees } = await getTimeTrackingData();
  return <TimeTrackingWithFilter projects={projects} employees={employees} />;
} 