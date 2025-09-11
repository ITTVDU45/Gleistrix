"use client";
import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import type { Project, Employee, Vehicle } from '../types';
import { ChartContainer } from './ui/chart';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area, LabelList } from 'recharts';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';
import MultiSelectDropdown from './ui/MultiSelectDropdown';

interface ProjectStatisticsProps {
  projects: Project[];
  employees: Employee[];
  vehicles: Vehicle[];
}

export default function ProjectStatistics({ projects, employees, vehicles }: ProjectStatisticsProps) {
  // Hilfsfunktion zur Formatierung von Stunden in HH:MM Format
  const formatHours = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
  };

  const handleExportStatisticsPDF = async () => {
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString('de-DE');
      
      // Titel
      doc.setFontSize(20);
      doc.text('Dashboard Statistiken', 14, 20);
      doc.setFontSize(12);
      doc.text(`Exportiert am: ${timestamp}`, 14, 30);
      
      // Filter-Information hinzufügen
      let filterInfo = '';
      if (filter.selectedMonth) {
        const monthNames = [
          'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
          'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        const [year, month] = filter.selectedMonth.split('-');
        const monthName = monthNames[parseInt(month) - 1];
        filterInfo = `Gefiltert nach: ${monthName} ${year}`;
      }
      if (filter.mitarbeiter.length > 0) {
        filterInfo += filterInfo ? `, Mitarbeiter: ${filter.mitarbeiter.join(', ')}` : `Gefiltert nach Mitarbeiter: ${filter.mitarbeiter.join(', ')}`;
      }
      if (filter.fahrzeug.length > 0) {
        filterInfo += filterInfo ? `, Fahrzeuge: ${filter.fahrzeug.join(', ')}` : `Gefiltert nach Fahrzeuge: ${filter.fahrzeug.join(', ')}`;
      }
      if (filter.atwsOnly) {
        filterInfo += filterInfo ? ', nur ATWS-Einsatz' : 'Gefiltert nach: nur ATWS-Einsatz';
      }
      
      if (filterInfo) {
        doc.setFontSize(10);
        doc.text(filterInfo, 14, 35);
      }
      
      // Zusammenfassung
      doc.setFontSize(14);
      doc.text('Übersicht', 14, 45);
      doc.setFontSize(10);
      doc.text(`Aktive Projekte: ${filteredProjects.filter(p => p.status === 'aktiv').length}`, 14, 55);
      doc.text(`Mitarbeiter: ${employees.length}`, 14, 60);
      
      const totalHours = filteredProjects.reduce((sum, project) => {
        return sum + Object.values(project.mitarbeiterZeiten || {}).reduce((projectSum, entries) => {
          return projectSum + entries.reduce((entrySum, entry) => entrySum + entry.stunden, 0);
        }, 0);
      }, 0);
      
      doc.text(`Gesamtarbeitsstunden: ${formatHours(totalHours)}`, 14, 65);
      
      // Diagramme als Bilder exportieren mit Überschriften
      const chartTitles = [
        'Projektstatus',
        'Fahrzeuge im Einsatz (aktive Projekte)',
        'Fahrzeugeinsatz (Top 10)',
        'ATW Einsatz',
        'Monatliche Arbeitsstunden',
        'Mitarbeiter unter 140 Stunden',
        'Top 10 Mitarbeiter'
      ];
      if (typeof document === 'undefined') {
        console.warn('PDF-Export nur im Browser verfügbar');
        return;
      }
      const charts = document.querySelectorAll('.chart-container');
      let yOffset = 70;
      charts.forEach(async (chart, idx) => {
        try {
          // Überschrift vor jedem Diagramm
          doc.setFontSize(13);
          doc.text(chartTitles[idx] || `Diagramm ${idx + 1}`, 14, yOffset);
          yOffset += 7;
          const dataUrl = await toPng(chart as HTMLElement);
          const imgWidth = 180;
          const imgHeight = 100;
          if (yOffset + imgHeight > 250) {
            doc.addPage();
            yOffset = 20;
            doc.setFontSize(13);
            doc.text(chartTitles[idx] || `Diagramm ${idx + 1}`, 14, yOffset);
            yOffset += 7;
          }
          doc.addImage(dataUrl, 'PNG', 14, yOffset, imgWidth, imgHeight);
          yOffset += imgHeight + 10;
        } catch (error) {
          console.error('Fehler beim Exportieren des Diagramms:', error);
        }
      });
      // Speichern nach allen Diagrammen (Timeout, da toPng async ist)
      setTimeout(() => {
        doc.save(`Dashboard_Statistiken_${timestamp.replace(/[:.]/g, '-')}.pdf`);
      }, 1000);
    } catch (error) {
      console.error('Fehler beim PDF-Export:', error);
      alert('Beim Export ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.');
    }
  };

  // Hilfsfunktion: Aktueller Monat als YYYY-MM Format
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Hilfsfunktion: Monat zu Datumsbereich konvertieren
  const getMonthDateRange = (monthYear: string) => {
    if (!monthYear) return { dateFrom: '', dateTo: '' };
    const [year, month] = monthYear.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;
    return { dateFrom: startDate, dateTo: endDate };
  };

  // Hilfsfunktion: Monatsoptionen generieren
  const getMonthOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    const monthNames = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    
    // Generiere Optionen für aktuelle und vorherige Jahre
    for (let year = currentYear + 1; year >= currentYear - 2; year--) {
      for (let month = 1; month <= 12; month++) {
        const monthStr = String(month).padStart(2, '0');
        const value = `${year}-${monthStr}`;
        const label = `${monthNames[month - 1]} ${year}`;
        options.push({ value, label });
      }
    }
    return options;
  };

  // --- Filter State ---
  const [filter, setFilter] = useState(() => {
    const currentMonth = getCurrentMonth();
    const dateRange = getMonthDateRange(currentMonth);
    return {
      selectedMonth: currentMonth,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      atwsOnly: false,
      mitarbeiter: [] as string[],
      fahrzeug: [] as string[]
    };
  });

  // Hilfsfunktionen für Filteroptionen
  const allMitarbeiter = React.useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      Object.values(p.mitarbeiterZeiten || {}).flat().forEach((e: any) => set.add(e.name));
    });
    return Array.from(set);
  }, [projects]);
  const allFahrzeuge = React.useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      Object.values(p.fahrzeuge || {}).flat().forEach((v: any) => set.add(v.type + ' ' + v.licensePlate));
    });
    return Array.from(set);
  }, [projects]);

  // Hilfsfunktion: Tag im Zeitraum?
  function isDayInRange(day: string, dateFrom: string, dateTo: string) {
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  }

  // Hilfsfunktion: Gibt alle relevanten Tage für die aktuelle Filterung zurück
  function getRelevanteTageFuerProjekt(p: any) {
    const tage = new Set<string>();
    // Wenn Fahrzeug-Filter aktiv: alle Tage, an denen das Fahrzeug eingesetzt wurde
    if (filter.fahrzeug.length > 0) {
      Object.entries(p.fahrzeuge || {}).forEach(([day, arr]: any) => {
        if (!isDayInRange(day, filter.dateFrom, filter.dateTo)) return;
        (arr || []).forEach((v: any) => {
          if (filter.fahrzeug.includes(v.type + ' ' + v.licensePlate)) {
            tage.add(day);
          }
        });
      });
    }
    // Wenn NUR Mitarbeiter-Filter aktiv: alle Tage, an denen der Mitarbeiter eingesetzt ist
    else if (filter.mitarbeiter.length > 0) {
      Object.entries(p.mitarbeiterZeiten || {}).forEach(([day, entries]: any) => {
        if (!isDayInRange(day, filter.dateFrom, filter.dateTo)) return;
        entries.forEach((e: any) => {
          if (filter.mitarbeiter.includes(e.name)) {
            tage.add(day);
          }
        });
      });
    }
    // Wenn kein Filter: alle Tage im Zeitraum
    else {
      Object.keys(p.mitarbeiterZeiten || {}).forEach(day => {
        if (!isDayInRange(day, filter.dateFrom, filter.dateTo)) return;
        tage.add(day);
      });
    }
    return tage;
  }

  // Multi-Select Handler
  const handleMultiSelect = (key: 'mitarbeiter' | 'fahrzeug', value: string) => {
    setFilter(f => {
      const arr = f[key];
      if (arr.includes(value)) {
        return { ...f, [key]: arr.filter((v: string) => v !== value) };
      } else {
        return { ...f, [key]: [...arr, value] };
      }
    });
  };
  const resetFilter = () => setFilter({ 
    selectedMonth: getCurrentMonth(), 
    dateFrom: '', 
    dateTo: '', 
    atwsOnly: false, 
    mitarbeiter: [], 
    fahrzeug: [] 
  });

  // --- Gefilterte Projekte ---
  const filteredProjects = React.useMemo(() => {
    return projects.filter(p => {
      // Zeitraumfilter
      if (filter.dateFrom && p.datumEnde < filter.dateFrom) return false;
      if (filter.dateTo && p.datumBeginn > filter.dateTo) return false;
      // ATWS-Einsatz
      if (filter.atwsOnly) {
        let hasATWS = false;
        if (typeof p.technik === 'object') {
          hasATWS = Object.values(p.technik || {}).flat().length > 0;
        }
        if (!hasATWS) return false;
      }
      // Mitarbeiter-Filter (mind. einer muss passen)
      if (filter.mitarbeiter.length > 0) {
        const found = Object.values(p.mitarbeiterZeiten || {}).flat().some((e: any) => filter.mitarbeiter.includes(e.name));
        if (!found) return false;
      }
      // Fahrzeug-Filter (mind. eines muss passen)
      if (filter.fahrzeug.length > 0) {
        const found = Object.values(p.fahrzeuge || {}).flat().some((v: any) => filter.fahrzeug.includes(v.type + ' ' + v.licensePlate));
        if (!found) return false;
      }
      return true;
    });
  }, [projects, filter]);

  // --- Datenaggregation ---
  // 1. Projektstatus (projektweise, nicht pro Tag)
  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProjects.forEach(p => {
      // Prüfe, ob das Projekt im Zeitraum aktiv ist
      const tage = getRelevanteTageFuerProjekt(p);
      if (tage.size > 0) {
        counts[p.status] = (counts[p.status] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [filteredProjects, filter.dateFrom, filter.dateTo, filter.mitarbeiter, filter.fahrzeug]);

  // 2. ATWS Einsatz (dynamisch: alle Technik-Einträge an Tagen, an denen das Fahrzeug oder der Mitarbeiter eingesetzt ist)
  const atwStats = React.useMemo(() => {
    let anzahl = 0;
    let meter = 0;
    filteredProjects.forEach(p => {
      const tage = getRelevanteTageFuerProjekt(p);
      Object.entries(p.technik || {}).forEach(([day, arr]: any) => {
        if (!tage.has(day)) return;
        (arr || []).forEach((t: any) => {
          anzahl += t.anzahl || 0;
          meter += t.meterlaenge || 0;
        });
      });
    });
    return { anzahl, meter };
  }, [filteredProjects, filter.dateFrom, filter.dateTo, filter.mitarbeiter, filter.fahrzeug]);

  // ATWS Einsatz: Stacked Bar Chart with Groups (kompakt mit Top-N Technik + Sonstige)
  const atwStackedByMonth = React.useMemo(() => {
    const monthMap: Record<string, { counts: Record<string, number>; meters: Record<string, number> }> = {};
    const technikTotals: Record<string, { count: number; meter: number }> = {};
    filteredProjects.forEach(p => {
      const tage = getRelevanteTageFuerProjekt(p);
      Object.entries(p.technik || {}).forEach(([day, arr]: any) => {
        if (!tage.has(day)) return;
        const month = String(day).slice(0, 7);
        if (!monthMap[month]) monthMap[month] = { counts: {}, meters: {} };
        (arr || []).forEach((t: any) => {
          const name = t.name || 'Unbekannt';
          const anzahl = Number(t.anzahl) || 0;
          const meter = Number(t.meterlaenge) || 0;
          monthMap[month].counts[name] = (monthMap[month].counts[name] || 0) + anzahl;
          monthMap[month].meters[name] = (monthMap[month].meters[name] || 0) + meter;
          technikTotals[name] = technikTotals[name] || { count: 0, meter: 0 };
          technikTotals[name].count += anzahl;
          technikTotals[name].meter += meter;
        });
      });
    });
    const months = Object.keys(monthMap).sort();
    // Top-N Technik nach Gesamt-Anzahl (kompakter)
    const TOP_N = 5;
    const sortedNames = Object.entries(technikTotals)
      .sort((a, b) => (b[1].count - a[1].count) || (b[1].meter - a[1].meter))
      .map(([name]) => name);
    const topNames = sortedNames.slice(0, TOP_N);
    const hasOthers = sortedNames.length > TOP_N;
    const seriesNames = hasOthers ? [...topNames, 'Sonstige'] : topNames;
    const data = months.map(month => {
      const row: Record<string, any> = { month };
      const monthCounts = monthMap[month]?.counts || {};
      const monthMeters = monthMap[month]?.meters || {};
      let othersCount = 0;
      let othersMeter = 0;
      Object.keys(monthCounts).forEach(name => {
        if (topNames.includes(name)) {
          row[`${name}__count`] = monthCounts[name] || 0;
          row[`${name}__meter`] = monthMeters[name] || 0;
        } else {
          othersCount += monthCounts[name] || 0;
          othersMeter += monthMeters[name] || 0;
        }
      });
      if (hasOthers) {
        row['Sonstige__count'] = othersCount;
        row['Sonstige__meter'] = othersMeter;
      }
      // Sicherstellen, dass fehlende Top-Namen als 0 gesetzt sind, damit Stacks konsistent bleiben
      seriesNames.forEach(name => {
        row[`${name}__count`] = row[`${name}__count`] || 0;
        row[`${name}__meter`] = row[`${name}__meter`] || 0;
      });
      return row;
    });
    // Farbpaletten (Counts kräftig, Meterlänge gleiche Farbtöne leichter)
    const basePalette = ['#114F6B', '#2563eb', '#22c55e', '#f59e0b', '#a21caf', '#ef4444', '#06b6d4'];
    const countColors = seriesNames.map((_, idx) => basePalette[idx % basePalette.length]);
    const meterColors = seriesNames.map((_, idx) => `rgba(${parseInt(basePalette[idx % basePalette.length].slice(1,3),16)}, ${parseInt(basePalette[idx % basePalette.length].slice(3,5),16)}, ${parseInt(basePalette[idx % basePalette.length].slice(5,7),16)}, 0.6)`);
    return { data, seriesNames, countColors, meterColors };
  }, [filteredProjects, filter.dateFrom, filter.dateTo, filter.mitarbeiter, filter.fahrzeug]);

  // 3. Arbeitsstunden pro Monat (dynamisch: alle Einträge an Tagen, an denen das Fahrzeug oder der Mitarbeiter eingesetzt ist)
  const monthlyHours = React.useMemo(() => {
    const map: Record<string, number> = {};
    filteredProjects.forEach(p => {
      const tage = getRelevanteTageFuerProjekt(p);
      Object.entries(p.mitarbeiterZeiten || {}).forEach(([day, entries]: any) => {
        if (!tage.has(day)) return;
        entries.forEach((e: any) => {
          const month = day.slice(0, 7); // yyyy-MM
          map[month] = (map[month] || 0) + (e.stunden || 0);
        });
      });
    });
    return Object.entries(map).map(([month, stunden]) => ({ month, stunden }));
  }, [filteredProjects, filter.dateFrom, filter.dateTo, filter.mitarbeiter, filter.fahrzeug]);

  // 4. Top 10 Mitarbeiter (dynamisch: alle Einträge an Tagen, an denen das Fahrzeug oder der Mitarbeiter eingesetzt ist)
  const topMitarbeiter = React.useMemo(() => {
    const map: Record<string, number> = {};
    filteredProjects.forEach(p => {
      const tage = getRelevanteTageFuerProjekt(p);
      Object.entries(p.mitarbeiterZeiten || {}).forEach(([day, entries]: any) => {
        if (!tage.has(day)) return;
        entries.forEach((e: any) => {
          map[e.name] = (map[e.name] || 0) + (e.stunden || 0);
        });
      });
    });
    return Object.entries(map)
      .map(([name, stunden]) => ({ name, stunden }))
      .sort((a, b) => b.stunden - a.stunden)
      .slice(0, 10);
  }, [filteredProjects, filter.dateFrom, filter.dateTo, filter.mitarbeiter, filter.fahrzeug]);

  // Kontextbezogene Dropdown-Optionen für Mitarbeiter und Fahrzeuge
  const filteredMitarbeiter = React.useMemo(() => {
    if (filter.fahrzeug.length === 0) return allMitarbeiter;
    // Nur Mitarbeiter, die an Tagen mit dem gewählten Fahrzeug im Projekt eingetragen sind
    const set = new Set<string>();
    projects.forEach(p => {
      Object.entries(p.fahrzeuge || {}).forEach(([day, arr]: any) => {
        if (!isDayInRange(day, filter.dateFrom, filter.dateTo)) return;
        (arr || []).forEach((v: any) => {
          if (filter.fahrzeug.includes(v.type + ' ' + v.licensePlate)) {
            // Finde Mitarbeiter an diesem Tag
            (p.mitarbeiterZeiten?.[day] || []).forEach((e: any) => set.add(e.name));
          }
        });
      });
    });
    return Array.from(set);
  }, [projects, filter.fahrzeug, filter.dateFrom, filter.dateTo, allMitarbeiter]);

  const filteredFahrzeuge = React.useMemo(() => {
    if (filter.mitarbeiter.length === 0) return allFahrzeuge;
    // Nur Fahrzeuge, die an Tagen mit dem gewählten Mitarbeiter im Projekt eingesetzt wurden
    const set = new Set<string>();
    projects.forEach(p => {
      Object.entries(p.mitarbeiterZeiten || {}).forEach(([day, entries]: any) => {
        if (!isDayInRange(day, filter.dateFrom, filter.dateTo)) return;
        entries.forEach((e: any) => {
          if (filter.mitarbeiter.includes(e.name)) {
            // Finde Fahrzeuge an diesem Tag
            (p.fahrzeuge?.[day] || []).forEach((v: any) => set.add(v.type + ' ' + v.licensePlate));
          }
        });
      });
    });
    return Array.from(set);
  }, [projects, filter.mitarbeiter, filter.dateFrom, filter.dateTo, allFahrzeuge]);

  // 5. KFZ-Einsatz (nur das ausgewählte Fahrzeug, falls Filter aktiv)
  const kfzStats = React.useMemo(() => {
    const map: Record<string, { fahrzeug: string, projekte: Set<string>, count: number }> = {};
    filteredProjects.forEach(p => {
      const tage = getRelevanteTageFuerProjekt(p);
      Object.entries(p.fahrzeuge || {}).forEach(([day, arr]: any) => {
        if (!tage.has(day)) return;
        (arr || []).forEach((v: any) => {
          const key = v.type + ' ' + v.licensePlate;
          // Wenn Fahrzeug-Filter aktiv, nur das gewählte Fahrzeug zählen
          if (filter.fahrzeug.length === 0 || filter.fahrzeug.includes(key)) {
            if (!map[key]) map[key] = { fahrzeug: key, projekte: new Set(), count: 0 };
            map[key].count += 1;
            map[key].projekte.add(p.name);
          }
        });
      });
    });
    // Wenn Fahrzeug-Filter aktiv, nur die gefilterten Fahrzeuge zurückgeben
    if (filter.fahrzeug.length > 0) {
      return filter.fahrzeug.map(fz => map[fz]).filter(Boolean).sort((a, b) => b.count - a.count);
    }
    return Object.values(map).map((kfz: any) => ({
      fahrzeug: kfz.fahrzeug,
      projekte: Array.from(kfz.projekte).join(', '),
      count: kfz.count
    })).sort((a, b) => b.count - a.count);
  }, [filteredProjects, filter.dateFrom, filter.dateTo, filter.mitarbeiter, filter.fahrzeug]);

  // 6. Mitarbeiter unter 140 Stunden (dynamisch: alle Einträge an Tagen, an denen das Fahrzeug oder der Mitarbeiter eingesetzt ist)
  const mitarbeiterUnter140 = React.useMemo(() => {
    const map: Record<string, number> = {};
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    filteredProjects.forEach(p => {
      const tage = getRelevanteTageFuerProjekt(p);
      Object.entries(p.mitarbeiterZeiten || {}).forEach(([day, entries]: any) => {
        if (!tage.has(day)) return;
        if (day.startsWith(month)) {
          entries.forEach((e: any) => {
            map[e.name] = (map[e.name] || 0) + (e.stunden || 0);
          });
        }
      });
    });
    return Object.entries(map)
      .filter(([, stunden]) => stunden < 140)
      .map(([name, stunden]) => ({ name, stunden: formatHours(stunden) }));
  }, [filteredProjects, filter.dateFrom, filter.dateTo, filter.mitarbeiter, filter.fahrzeug]);

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Projektstatistiken</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Detaillierte Übersicht und Analysen</p>
          </div>
          <Button onClick={handleExportStatisticsPDF} className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white">
            PDF Export
          </Button>
        </div>
        {/* Filterleiste */}
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mt-6 mb-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            {/* Monatsauswahl */}
            <div>
              <label className="block text-xs font-semibold mb-1">Monat</label>
              <Select 
                value={filter.selectedMonth} 
                onValueChange={(value) => {
                  const dateRange = getMonthDateRange(value);
                  setFilter(f => ({ 
                    ...f, 
                    selectedMonth: value,
                    dateFrom: dateRange.dateFrom,
                    dateTo: dateRange.dateTo
                  }));
                }}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Manuelle Zeitraumauswahl (optional) */}
            <div>
              <label className="block text-xs font-semibold mb-1">Zeitraum von</label>
              <Input 
                type="date" 
                value={filter.dateFrom} 
                onChange={e => setFilter(f => ({ ...f, dateFrom: e.target.value }))} 
                className="rounded-xl h-10" 
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">bis</label>
              <Input 
                type="date" 
                value={filter.dateTo} 
                onChange={e => setFilter(f => ({ ...f, dateTo: e.target.value }))} 
                className="rounded-xl h-10" 
                placeholder="Optional"
              />
            </div>
            
            <div className="flex items-center gap-2 mt-6">
              <Checkbox id="atwsOnly" checked={filter.atwsOnly} onCheckedChange={checked => setFilter(f => ({ ...f, atwsOnly: !!checked }))} />
              <label htmlFor="atwsOnly" className="text-xs font-semibold">nur mit ATWS-Einsatz</label>
            </div>
            
            {/* Multi-Select Mitarbeiter als Dropdown */}
            <MultiSelectDropdown
              label="Mitarbeiter"
              options={filteredMitarbeiter}
              selected={filter.mitarbeiter}
              onChange={values => setFilter(f => ({ ...f, mitarbeiter: values }))}
              placeholder="Mitarbeiter wählen"
              renderTagsBelow
            />
            {/* Multi-Select Fahrzeug als Dropdown */}
            <MultiSelectDropdown
              label="Fahrzeug"
              options={filteredFahrzeuge}
              selected={filter.fahrzeug}
              onChange={values => setFilter(f => ({ ...f, fahrzeug: values }))}
              placeholder="Fahrzeuge wählen"
              renderTagsBelow
            />
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={resetFilter} className="rounded-xl border-slate-200">Filter zurücksetzen</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Projektstatus (Donut-Chart) */}
          <div className="chart-container">
            <h3 className="font-semibold mb-2">Projektstatus</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                {(() => {
                  const data = statusCounts.map(s => ({ name: s.status, value: s.count }));
                  const palette = ['#114F6B', '#2563eb', '#22c55e', '#a21caf', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444'];
                  return (
                    <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2} cornerRadius={6}>
                      {data.map((_, idx) => (
                        <Cell key={`status-${idx}`} fill={palette[idx % palette.length]} />
                      ))}
                    </Pie>
                  );
                })()}
                <Tooltip contentStyle={{ borderRadius: 12 }} formatter={(val: any) => [val, 'Projekte']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* ATWS Einsatz (Stacked Bar Chart mit Gruppen je Monat) */}
          <div className="chart-container">
            <h3 className="font-semibold mb-2">ATWS Einsatz (Anzahl & Meter je Monat)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={atwStackedByMonth.data} barCategoryGap={16} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#64748b' }}
                  tickFormatter={(val: any) => `${String(val).slice(5,7)}/${String(val).slice(2,4)}`}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12 }}
                  formatter={(value: any, _name: any, props: any) => {
                    const key = props?.dataKey as string | undefined;
                    const isCount = !!key && key.endsWith('__count');
                    const base = key ? key.replace(/__count$|__meter$/,'') : _name;
                    return [isCount ? value : `${value} m`, isCount ? `${base} (Anzahl)` : `${base} (Meterlänge)`];
                  }}
                  labelFormatter={(label: any) => `Monat: ${String(label).slice(5,7)}/${String(label).slice(0,4)}`}
                />
                <Legend />
                {atwStackedByMonth.seriesNames.map((name, idx) => (
                  <Bar key={`${name}-count`} dataKey={`${name}__count`} stackId="count" fill={atwStackedByMonth.countColors[idx]} name={`${name} (Anzahl)`} radius={[8,8,0,0]} />
                ))}
                {atwStackedByMonth.seriesNames.map((name, idx) => (
                  <Bar key={`${name}-meter`} dataKey={`${name}__meter`} stackId="meter" fill={atwStackedByMonth.meterColors[idx]} name={`${name} (Meter)`} radius={[8,8,0,0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div className="text-xs mt-2 text-slate-500">Gesamt: {atwStats.anzahl} ATWs, {atwStats.meter} m</div>
          </div>
          {/* Arbeitsstunden pro Monat (Area-Chart mit Gradient) */}
          <div className="chart-container">
            <h3 className="font-semibold mb-2">Arbeitsstunden pro Monat</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyHours}>
                <defs>
                  <linearGradient id="colorMonthly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <Tooltip contentStyle={{ borderRadius: 12 }} formatter={(val: any) => [typeof val === 'number' ? val.toFixed(2) : val, 'Stunden']} />
                <Area type="monotone" dataKey="stunden" stroke="#22c55e" strokeWidth={2} fill="url(#colorMonthly)" name="Stunden" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Top 10 Mitarbeiter (modernes vertikales Balkendiagramm) */}
          <div className="chart-container">
            <h3 className="font-semibold mb-2">Top 10 Mitarbeiter (Stunden)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topMitarbeiter} layout="vertical">
                <defs>
                  <linearGradient id="barPurpleTop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a21caf" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#a21caf" stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis dataKey="name" type="category" width={140} tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <Tooltip contentStyle={{ borderRadius: 12 }} formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) : v, 'Stunden']} />
                <Bar dataKey="stunden" fill="url(#barPurpleTop)" name="Stunden" radius={[8,8,8,8]}>
                  <LabelList dataKey="stunden" position="right" formatter={(v: any) => (typeof v === 'number' ? v.toFixed(1) : v)} fill="#334155" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* KFZ Einsatz (Top 10, moderner Stil) */}
          <div className="chart-container">
            <h3 className="font-semibold mb-2">KFZ Einsatz (Top 10)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={kfzStats.slice(0, 10)} layout="vertical">
                <defs>
                  <linearGradient id="barTealKfzDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis dataKey="fahrzeug" type="category" width={180} tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <Tooltip contentStyle={{ borderRadius: 12 }} formatter={(v: any) => [v, 'Einsätze']} />
                <Bar dataKey="count" fill="url(#barTealKfzDash)" name="Einsätze" radius={[8,8,8,8]}>
                  <LabelList dataKey="count" position="right" fill="#334155" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="text-xs mt-2 text-slate-500">Projekte: {kfzStats.slice(0, 1).map(kfz => kfz.projekte).join(', ')}</div>
          </div>
          {/* Mitarbeiter unter 140 Stunden */}
          <div className="chart-container">
            <h3 className="font-semibold mb-2">Mitarbeiter unter 140 Stunden</h3>
            <table className="w-full text-xs border mt-2">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-1 text-left">Name</th>
                  <th className="p-1 text-left">Stunden</th>
                </tr>
              </thead>
              <tbody>
                {mitarbeiterUnter140.length === 0 && (
                  <tr><td colSpan={2} className="text-center text-slate-400 py-2">Alle Mitarbeiter über 140h</td></tr>
                )}
                {mitarbeiterUnter140.map(m => (
                  <tr key={m.name}>
                    <td className="p-1">{m.name}</td>
                    <td className="p-1">{m.stunden}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 