'use client';
import React from 'react';
import type { Vehicle, Project } from '../types';
import DynamicVehicleStats from './DynamicVehicleStats';
import VehicleFilterSection from './VehicleFilterSection';
import VehicleTableClient from './VehicleTableClient';

interface VehicleListWithFilterProps {
  vehicles: Vehicle[];
  projects: Project[];
}

export default function VehicleListWithFilter({ vehicles, projects }: VehicleListWithFilterProps) {
  const [filteredVehicles, setFilteredVehicles] = React.useState<Vehicle[]>(vehicles);

  React.useEffect(() => {
    setFilteredVehicles(vehicles);
  }, [vehicles]);

  const handleFilterChange = (newFilteredVehicles: Vehicle[]) => {
    setFilteredVehicles(newFilteredVehicles);
  };

  return (
    <div className="space-y-6">
      <DynamicVehicleStats vehicles={filteredVehicles} projects={projects} />

      <VehicleFilterSection
        vehicles={vehicles}
        onFilterChange={handleFilterChange}
      />

      <VehicleTableClient
        vehicles={filteredVehicles}
        projects={projects}
        allVehicles={vehicles}
      />
    </div>
  );
}
