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
    return {
      projects: projects.map((project: any) => ({
        ...project,
        id: project._id?.toString() || project.id,
        _id: project._id?.toString(),
        createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
        updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : project.updatedAt,
        datumBeginn: project.datumBeginn instanceof Date ? project.datumBeginn.toISOString() : project.datumBeginn,
        datumEnde: project.datumEnde instanceof Date ? project.datumEnde.toISOString() : project.datumEnde
      })),
      employees: employees.map((employee: any) => ({
        ...employee,
        id: employee._id?.toString() || employee.id,
        _id: employee._id?.toString(),
        createdAt: employee.createdAt instanceof Date ? employee.createdAt.toISOString() : employee.createdAt,
        updatedAt: employee.updatedAt instanceof Date ? employee.updatedAt.toISOString() : employee.updatedAt
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