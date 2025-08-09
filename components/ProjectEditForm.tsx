"use client";
import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert } from './ui/alert';
import { useProjects } from '../hooks/useProjects';
import type { Project } from '../types';

interface ProjectEditFormProps {
  project: Omit<Project, 'mitarbeiterZeiten'>;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ProjectEditForm({ project, onSuccess, onCancel }: ProjectEditFormProps) {
  const { updateProject } = useProjects();
  const [form, setForm] = React.useState<Omit<Project, 'id' | 'mitarbeiterZeiten'>>({
    name: project.name,
    auftraggeber: project.auftraggeber,
    baustelle: project.baustelle,
    auftragsnummer: project.auftragsnummer,
    sapNummer: project.sapNummer,
    telefonnummer: project.telefonnummer,
    status: project.status,
    atwsImEinsatz: project.atwsImEinsatz,
    anzahlAtws: project.anzahlAtws,
    datumBeginn: project.datumBeginn,
    datumEnde: project.datumEnde
  });
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() ||
        !form.auftraggeber.trim() ||
        !form.baustelle.trim() ||
        !form.auftragsnummer.trim() ||
        !form.sapNummer.trim() ||
        !form.telefonnummer.trim() ||
        !form.datumBeginn.trim() ||
        !form.datumEnde.trim() ||
        (form.atwsImEinsatz && (!form.anzahlAtws || form.anzahlAtws < 1))
    ) {
      setError('Bitte füllen Sie alle Felder korrekt aus!');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await updateProject(project.id, form);
      onSuccess();
    } catch (err) {
      setError('Fehler beim Aktualisieren des Projekts. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <h2 className="text-xl font-semibold">Projektdaten bearbeiten</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Projektname *</Label>
              <Input 
                id="name"
                value={form.name} 
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="auftraggeber">Auftraggeber *</Label>
              <Input 
                id="auftraggeber"
                value={form.auftraggeber} 
                onChange={e => setForm(prev => ({ ...prev, auftraggeber: e.target.value }))} 
                required 
              />
            </div>
          </div>

          <div>
            <Label htmlFor="baustelle">Baustelle *</Label>
            <Input 
              id="baustelle"
              value={form.baustelle} 
              onChange={e => setForm(prev => ({ ...prev, baustelle: e.target.value }))} 
              required 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="auftragsnummer">Auftragsnummer *</Label>
              <Input 
                id="auftragsnummer"
                value={form.auftragsnummer} 
                onChange={e => setForm(prev => ({ ...prev, auftragsnummer: e.target.value }))} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="sapNummer">SAP Nummer *</Label>
              <Input 
                id="sapNummer"
                value={form.sapNummer} 
                onChange={e => setForm(prev => ({ ...prev, sapNummer: e.target.value }))} 
                required 
              />
            </div>
          </div>

          <div>
            <Label htmlFor="telefonnummer">Ansprechpartner *</Label>
            <Input 
              id="telefonnummer"
              value={form.telefonnummer} 
              onChange={e => setForm(prev => ({ ...prev, telefonnummer: e.target.value }))} 
              required 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="datumBeginn">Datum Beginn *</Label>
              <Input 
                id="datumBeginn"
                type="date" 
                value={form.datumBeginn} 
                onChange={e => setForm(prev => ({ ...prev, datumBeginn: e.target.value }))} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="datumEnde">Datum Ende *</Label>
              <Input 
                id="datumEnde"
                type="date" 
                value={form.datumEnde} 
                onChange={e => setForm(prev => ({ ...prev, datumEnde: e.target.value }))} 
                required 
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={value => setForm(prev => ({ ...prev, status: value as "aktiv" | "abgeschlossen" | "fertiggestellt" | "geleistet" | "kein Status" }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aktiv">Aktiv</SelectItem>
                <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
                <SelectItem value="fertiggestellt">Fertiggestellt</SelectItem>
                <SelectItem value="geleistet">Geleistet</SelectItem>
                <SelectItem value="kein Status">Kein Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              {error}
            </Alert>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel} type="button">
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Wird gespeichert...' : 'Änderungen speichern'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 