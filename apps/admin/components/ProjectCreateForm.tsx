"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { useProjects } from '../hooks/useProjects';
import ProjectLeistungenEditor from './ProjectLeistungenEditor';
import type { Project } from '../types';

interface ProjectCreateFormProps {
  /** Erhält optional die ID des neu erstellten Projekts. */
  onSuccess: (createdProjectId?: string) => void;
  onCancel: () => void;
  initialValues?: Partial<Omit<Project, 'id' | 'mitarbeiterZeiten'>>;
}

export default function ProjectCreateForm({ onSuccess, onCancel, initialValues }: ProjectCreateFormProps) {
  const { addProject } = useProjects();
  const [form, setForm] = React.useState<Omit<Project, 'id' | 'mitarbeiterZeiten'>>({
    name: '',
    auftraggeber: '',
    baustelle: '',
    auftragsnummer: '',
    sapNummer: '',
    telefonnummer: '',
    ansprechpartner: '',
    ansprechpartnerEmail: '',
    status: 'aktiv',
    atwsImEinsatz: false,
    anzahlAtws: 0,
    datumBeginn: '',
    datumEnde: '',
    leistungen: [],
    leistungsanfrage: {},
    ...initialValues,
  });

  const updateLA = (key: string, value: string) =>
    setForm(prev => ({ ...prev, leistungsanfrage: { ...(prev.leistungsanfrage || {}), [key]: value } }));
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
      const created = await addProject(form);
      onSuccess(created?.id);
    } catch (err) {
      setError('Fehler beim Erstellen des Projekts. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <h2 className="text-xl font-semibold">Projektdaten</h2>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ansprechpartner">Ansprechpartner</Label>
              <Input
                id="ansprechpartner"
                value={form.ansprechpartner || ''}
                onChange={e => setForm(prev => ({ ...prev, ansprechpartner: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="telefonnummer">Telefon *</Label>
              <Input
                id="telefonnummer"
                value={form.telefonnummer}
                onChange={e => setForm(prev => ({ ...prev, telefonnummer: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ansprechpartnerEmail">E-Mail Ansprechpartner</Label>
            <Input
              id="ansprechpartnerEmail"
              type="email"
              value={form.ansprechpartnerEmail || ''}
              onChange={e => setForm(prev => ({ ...prev, ansprechpartnerEmail: e.target.value }))}
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

          <div className="pt-2 border-t border-slate-200">
            <p className="text-sm font-semibold text-slate-700 mb-2">Leistungsanfrage (optional)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="la_rvFamilie">RV-Familie</Label>
                <Input id="la_rvFamilie" value={form.leistungsanfrage?.rvFamilie || ''} onChange={e => updateLA('rvFamilie', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="la_raumlos">Raumlos</Label>
                <Input id="la_raumlos" value={form.leistungsanfrage?.raumlos || ''} onChange={e => updateLA('raumlos', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="la_anfragedatum">Anfragedatum</Label>
                <Input id="la_anfragedatum" value={form.leistungsanfrage?.anfragedatum || ''} onChange={e => updateLA('anfragedatum', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="la_rueckmeldefrist">Rückmeldefrist</Label>
                <Input id="la_rueckmeldefrist" value={form.leistungsanfrage?.rueckmeldefrist || ''} onChange={e => updateLA('rueckmeldefrist', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="la_leistungszeitraum">Leistungszeitraum</Label>
                <Input id="la_leistungszeitraum" value={form.leistungsanfrage?.leistungszeitraum || ''} onChange={e => updateLA('leistungszeitraum', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="la_summe">Gesamtsumme netto</Label>
                <Input id="la_summe" value={form.leistungsanfrage?.summe || ''} onChange={e => updateLA('summe', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="la_dva">DVA-Versicherung</Label>
                <Select value={form.leistungsanfrage?.dvaVersicherung || ''} onValueChange={v => updateLA('dvaVersicherung', v)}>
                  <SelectTrigger id="la_dva"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ja">Ja</SelectItem>
                    <SelectItem value="Nein">Nein</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <ProjectLeistungenEditor
              value={form.leistungen || []}
              onChange={(v) => setForm(prev => ({ ...prev, leistungen: v }))}
            />
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
              {isSubmitting ? 'Wird erstellt...' : 'Projekt erstellen'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 