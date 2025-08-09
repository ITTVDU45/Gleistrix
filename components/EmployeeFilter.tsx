import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Filter, X } from 'lucide-react';

interface EmployeeFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
}

export default function EmployeeFilter({ searchTerm, onSearchChange, onClearFilters }: EmployeeFilterProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="relative flex-1 max-w-md">
        <Input
          type="text"
          placeholder="Mitarbeiter suchen..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
      </div>
      
      {searchTerm && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-slate-500 hover:text-slate-700"
        >
          <X className="h-4 w-4 mr-1" />
          Filter löschen
        </Button>
      )}
    </div>
  );
} 