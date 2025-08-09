"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Badge } from './badge';

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  renderTagsBelow?: boolean;
}

export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = "Optionen wählen",
  renderTagsBelow = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string) => {
    onChange(selected.filter(item => item !== value));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-semibold mb-1">{label}</label>
      <div className="relative">
        <div
          className="w-full border border-slate-200 dark:border-slate-600 rounded-xl h-10 min-h-[40px] bg-white dark:bg-slate-800 flex items-center justify-between px-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selected.length === 0 ? (
              <span className="text-slate-500">{placeholder}</span>
            ) : renderTagsBelow ? (
              <span className="text-slate-700 dark:text-slate-300 text-sm">{selected.length} ausgewählt</span>
            ) : (
              selected.map((value) => (
                <Badge
                  key={value}
                  variant="secondary"
                  className="text-[11px] leading-[18px] px-2 py-0 rounded-md font-normal"
                  data-badge=""
                >
                  {value}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(value);
                    }}
                    className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {renderTagsBelow && selected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selected.map((value) => (
              <Badge
                key={value}
                variant="secondary"
                className="text-[11px] leading-[18px] px-2 py-0 rounded-md font-normal"
              >
                {value}
                <button
                  type="button"
                  onClick={() => handleRemove(value)}
                  className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {isOpen && (
          <div
            className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2">
              {selected.length > 0 && (
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    Alle entfernen
                  </button>
                </div>
              )}
              
              {options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-500">
                  Keine Optionen verfügbar
                </div>
              ) : (
                options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between ${
                      selected.includes(option) ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''
                    }`}
                    onClick={(e) => { e.stopPropagation(); handleToggle(option); }}
                  >
                    <span className="truncate">{option}</span>
                    {selected.includes(option) && (
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 