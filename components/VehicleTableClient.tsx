'use client';
import React from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Truck } from 'lucide-react';
import type { Vehicle, Project } from '../types';
import VehicleActions from './VehicleActions';
import VehiclePDFExport from './VehiclePDFExport';
import { getVehicleStatus } from '../lib/utils/vehicleStatus';

interface VehicleTableClientProps {
  vehicles: Vehicle[];
  projects: Project[];
  allVehicles: Vehicle[]; // Für PDF Export
}

export default function VehicleTableClient({ vehicles, projects, allVehicles }: VehicleTableClientProps) {
  const [filteredVehicles, setFilteredVehicles] = React.useState<Vehicle[]>(vehicles);

  // Aktualisiere gefilterte Fahrzeuge wenn sich vehicles ändert
  React.useEffect(() => {
    setFilteredVehicles(vehicles);
  }, [vehicles]);

  const handleFilterChange = (newFilteredVehicles: Vehicle[]) => {
    setFilteredVehicles(newFilteredVehicles);
  };

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Fahrzeugflotte</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {filteredVehicles.length} von {allVehicles.length} Fahrzeugen
            </p>
          </div>
          <VehiclePDFExport vehicles={allVehicles} />
        </div>
      </CardHeader>
      <CardContent>
        {filteredVehicles.length > 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-700">
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Typ</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Kennzeichen</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Status</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Kilometer</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Manueller Status</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle: Vehicle, idx: number) => {
                  const rowKey = vehicle.id || (vehicle as any)._id || `${vehicle.licensePlate || vehicle.type || 'veh'}-${idx}`;
                  return (
                  <TableRow key={rowKey} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <TableCell className="font-medium dark:text-white">{vehicle.type}</TableCell>
                    <TableCell className="dark:text-slate-300">{vehicle.licensePlate}</TableCell>
                    <TableCell>
                      <Badge className={getVehicleStatus(vehicle, projects).color}>
                        {getVehicleStatus(vehicle, projects).message}
                      </Badge>
                    </TableCell>
                    <TableCell className="dark:text-slate-300">{vehicle.kilometers || 'N/A'}</TableCell>
                    <TableCell className="dark:text-slate-300">{vehicle.manualStatus || '-'}</TableCell>
                    <TableCell className="text-right">
                      <VehicleActions vehicle={vehicle} />
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Truck className="h-12 w-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Keine Fahrzeuge gefunden</p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Passen Sie Ihre Filter an</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 