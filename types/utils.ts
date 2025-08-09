import type { 
  Project, 
  Employee, 
  Vehicle, 
  TimeEntry, 
  TechnikEntry, 
  VehicleAssignment,
  DashboardStats,
  EmployeeStats,
  ProjectStats,
  ChartData,
  MonthlyHoursData,
  EmployeeUtilizationData,
  ATWUsageData,
  ProjectStatus,
  TimeTrackingFilters,
  ProjectFilters,
  ProjectFormData,
  EmployeeFormData,
  VehicleFormData
} from './main';

// ===== DASHBOARD UTILITY FUNCTIONS =====
export const calculateDashboardStats = (
  projects: Project[], 
  employees: Employee[], 
  vehicles: Vehicle[]
): DashboardStats => {
  const activeProjects = projects.filter(project => project.status === 'aktiv').length;
  
  const totalHours = projects.reduce((sum, project) => {
    return sum + Object.values(project.mitarbeiterZeiten || {}).reduce((projectSum, entries) => {
      return projectSum + entries.reduce((entrySum, entry) => entrySum + entry.stunden, 0);
    }, 0);
  }, 0);

  const activeVehicles = projects.reduce((count, project) => {
    if (!project.fahrzeuge) return count;
    const vehicleIds = new Set();
    Object.values(project.fahrzeuge).forEach(vehiclesForDay => {
      vehiclesForDay.forEach(vehicle => {
        vehicleIds.add(vehicle.id);
      });
    });
    return count + vehicleIds.size;
  }, 0);

  return {
    activeProjects,
    totalHours,
    activeVehicles,
    totalEmployees: employees.length
  };
};

export const getProjectsByStatus = (projects: Project[]): ChartData[] => {
  const statusCount = projects.reduce((acc, project) => {
    acc[project.status] = (acc[project.status] || 0) + 1;
    return acc;
  }, {} as Record<ProjectStatus, number>);

  return Object.entries(statusCount).map(([status, count]) => ({
    name: status,
    value: count
  }));
};

export const getATWSUsage = (projects: Project[]): ATWUsageData[] => {
  return projects
    .filter(project => project.atwsImEinsatz)
    .map(project => ({
      name: project.name,
      anzahl: project.anzahlAtws
    }));
};

export const getMonthlyHours = (projects: Project[]): MonthlyHoursData[] => {
  const monthlyData = new Map<string, { stunden: number, fahrtstunden: number }>();
  
  projects.forEach(project => {
    Object.entries(project.mitarbeiterZeiten || {}).forEach(([date, entries]) => {
      const month = new Date(date).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' });
      const current = monthlyData.get(month) || { stunden: 0, fahrtstunden: 0 };
      
      entries.forEach(entry => {
        current.stunden += entry.stunden;
        current.fahrtstunden += entry.fahrtstunden;
      });
      
      monthlyData.set(month, current);
    });
  });

  return Array.from(monthlyData.entries())
    .map(([month, data]) => ({
      month,
      ...data
    }))
    .sort((a, b) => {
      const [aMonth, aYear] = a.month.split('.');
      const [bMonth, bYear] = b.month.split('.');
      return new Date(parseInt(aYear), parseInt(aMonth) - 1).getTime() - 
             new Date(parseInt(bYear), parseInt(bMonth) - 1).getTime();
    });
};

export const getEmployeeUtilization = (projects: Project[]): EmployeeUtilizationData[] => {
  const employeeMap = new Map<string, { stunden: number, projekte: Set<string> }>();
  
  projects.forEach(project => {
    Object.values(project.mitarbeiterZeiten || {}).forEach(entries => {
      entries.forEach(entry => {
        const current = employeeMap.get(entry.name) || { stunden: 0, projekte: new Set() };
        current.stunden += entry.stunden;
        current.projekte.add(project.name);
        employeeMap.set(entry.name, current);
      });
    });
  });

  return Array.from(employeeMap.entries())
    .map(([name, data]) => ({
      name,
      stunden: data.stunden,
      projekte: data.projekte.size
    }))
    .sort((a, b) => b.stunden - a.stunden)
    .slice(0, 10);
};

// ===== EMPLOYEE UTILITY FUNCTIONS =====
export const calculateEmployeeStats = (employee: Employee, projects: Project[]): EmployeeStats => {
  const totalHours = employee.einsaetze.reduce((sum, einsatz) => sum + einsatz.stunden, 0);
  const totalTravelHours = employee.einsaetze.reduce((sum, einsatz) => sum + (einsatz.fahrtstunden || 0), 0);
  const uniqueProjects = new Set(employee.einsaetze.map(einsatz => einsatz.projektId)).size;

  return {
    totalHours,
    totalTravelHours,
    uniqueProjects,
    totalAssignments: employee.einsaetze.length
  };
};

// ===== PROJECT UTILITY FUNCTIONS =====
export const calculateProjectStats = (project: Project): ProjectStats => {
  const totalHours = Object.values(project.mitarbeiterZeiten || {}).reduce((sum, entries) => {
    return sum + entries.reduce((entrySum, entry) => entrySum + entry.stunden, 0);
  }, 0);

  const totalTechnik = Object.values(project.technik || {}).reduce((sum, technikEntries) => {
    return sum + technikEntries.length;
  }, 0);

  const totalVehicles = Object.values(project.fahrzeuge || {}).reduce((sum, vehicleEntries) => {
    return sum + vehicleEntries.length;
  }, 0);

  const totalEmployees = new Set(
    Object.values(project.mitarbeiterZeiten || {}).flat().map(entry => entry.name)
  ).size;

  return {
    totalHours,
    totalTechnik,
    totalVehicles,
    totalEmployees
  };
};

// ===== FILTER UTILITY FUNCTIONS =====
export const filterProjects = (projects: Project[], filters: ProjectFilters): Project[] => {
  return projects.filter(project => {
    if (filters.name && !project.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.auftraggeber && !project.auftraggeber.toLowerCase().includes(filters.auftraggeber.toLowerCase())) return false;
    if (filters.baustelle && !project.baustelle.toLowerCase().includes(filters.baustelle.toLowerCase())) return false;
    if (filters.status && project.status !== filters.status) return false;
    if (filters.dateFrom && new Date(project.datumBeginn) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(project.datumEnde) > new Date(filters.dateTo)) return false;
    return true;
  });
};

export const filterTimeEntries = (
  projects: Project[], 
  filters: TimeTrackingFilters
): Array<TimeEntry & { projectName: string; date: string; orderNumber: string; sapNumber: string; client: string; status: ProjectStatus }> => {
  const allTimeEntries = projects.flatMap(project => 
    Object.entries(project.mitarbeiterZeiten || {}).flatMap(([date, entries]) =>
      entries.map(entry => ({
        ...entry,
        projectName: project.name,
        date,
        orderNumber: project.auftragsnummer,
        sapNumber: project.sapNummer,
        client: project.auftraggeber,
        status: project.status
      }))
    )
  );

  return allTimeEntries.filter(entry => {
    const entryDate = new Date(entry.date);
    const matchesProject = !filters.projects || filters.projects.length === 0 || filters.projects.includes(entry.projectName);
    const matchesEmployee = !filters.employees || filters.employees.length === 0 || filters.employees.includes(entry.name);
    const matchesDateRange = !filters.dateRange || 
      (!filters.dateRange.from || entryDate >= filters.dateRange.from) &&
      (!filters.dateRange.to || entryDate <= filters.dateRange.to);
    const matchesOrderNumber = !filters.orderNumbers || filters.orderNumbers.length === 0 || filters.orderNumbers.includes(entry.orderNumber);
    const matchesSapNumber = !filters.sapNumbers || filters.sapNumbers.length === 0 || filters.sapNumbers.includes(entry.sapNumber);
    const matchesClient = !filters.clients || filters.clients.length === 0 || filters.clients.includes(entry.client);
    const matchesStatus = !filters.statuses || filters.statuses.length === 0 || filters.statuses.includes(entry.status);
    
    return matchesProject && matchesEmployee && matchesDateRange && 
           matchesOrderNumber && matchesSapNumber && matchesClient && matchesStatus;
  });
};

// ===== VALIDATION UTILITY FUNCTIONS =====
export const validateProjectForm = (data: Partial<ProjectFormData>): string[] => {
  const errors: string[] = [];
  
  if (!data.name?.trim()) errors.push('Projektname ist erforderlich');
  if (!data.auftraggeber?.trim()) errors.push('Auftraggeber ist erforderlich');
  if (!data.baustelle?.trim()) errors.push('Baustelle ist erforderlich');
  if (!data.auftragsnummer?.trim()) errors.push('Auftragsnummer ist erforderlich');
  if (!data.sapNummer?.trim()) errors.push('SAP Nummer ist erforderlich');
  if (!data.telefonnummer?.trim()) errors.push('Telefonnummer ist erforderlich');
  if (!data.datumBeginn?.trim()) errors.push('Datum Beginn ist erforderlich');
  if (!data.datumEnde?.trim()) errors.push('Datum Ende ist erforderlich');
  if (data.atwsImEinsatz && (!data.anzahlAtws || data.anzahlAtws < 1)) {
    errors.push('Anzahl ATWs muss mindestens 1 sein, wenn ATWs im Einsatz sind');
  }
  
  return errors;
};

export const validateEmployeeForm = (data: Partial<EmployeeFormData>): string[] => {
  const errors: string[] = [];
  
  if (!data.name?.trim()) errors.push('Name ist erforderlich');
  
  return errors;
};

export const validateVehicleForm = (data: Partial<VehicleFormData>): string[] => {
  const errors: string[] = [];
  
  if (!data.type?.trim()) errors.push('Fahrzeugtyp ist erforderlich');
  if (!data.licensePlate?.trim()) errors.push('Kennzeichen ist erforderlich');
  
  return errors;
}; 