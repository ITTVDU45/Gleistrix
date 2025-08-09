'use client';

import React from 'react';
// Temporärer No-Op-Provider für React 19-Kompatibilität (react-joyride inkompatibel)

function getStepsForPath(path: string): any[] {
  switch (true) {
    case /\/dashboard$/.test(path):
      return [
        {
          target: 'body',
          placement: 'center',
          title: 'Willkommen bei Gleistrix',
          content: (
            <div>
              <div>Kurzer Überblick über die wichtigsten Bereiche.</div>
              <ul className="mt-2 list-disc pl-4">
                <li>Karten: Kennzahlen & Status</li>
                <li>Statistiken: Trends & Verteilung</li>
              </ul>
            </div>
          ),
        },
        {
          target: '.dashboard-cards',
          title: 'Karten',
          content: 'Kennzahlen zu Projekten, Mitarbeitern und Zeiten.',
        },
        {
          target: '.project-statistics',
          title: 'Statistiken',
          content: 'Grafiken und Tabellen für schnelle Analysen.',
        },
      ];
    case /\/projekte$/.test(path):
      return [
        {
          target: 'body',
          placement: 'center',
          title: 'Projekte',
          content: 'Liste, Filter und Aktionen für alle Projekte.',
        },
        {
          target: '.projects-cards',
          title: 'Filter/Karten',
          content: 'Schneller Überblick und Eingrenzung der Liste.',
        },
        {
          target: '.projects-table',
          title: 'Tabelle',
          content: 'Details öffnen, bearbeiten oder löschen.',
        },
        {
          target: '.project-create-button',
          title: 'Neues Projekt',
          content: 'Projekt anlegen und Daten erfassen.',
        },
      ];
    case /\/projektdetail\//.test(path):
      return [
        {
          target: 'body',
          placement: 'center',
          title: 'Projektdetails',
          content: 'Alle Informationen und Aktionen zum Projekt.',
        },
        { target: '.project-detail-page .project-lock-alert', title: 'Sperre', content: 'Gesperrt = nur Lesen. Eigene Sperre = Bearbeitung möglich.' },
        { target: '.project-detail-page .project-lock-controls', title: 'Sperre/Export', content: 'Sperre freigeben oder Export starten.' },
        { target: '.project-detail-page .project-detail-header', title: 'Kopfbereich', content: 'Stammdaten und Status ändern.' },
        { target: '.project-detail-page .project-export-button', title: 'Export', content: 'PDF-Export der Übersicht.' },
        { target: '.project-detail-page .project-technik-add', title: 'Technik', content: 'Technik je Tag verwalten.' },
        { target: '.project-detail-page .project-times-add', title: 'Zeiten', content: 'Mitarbeiterzeiten erfassen.' },
        { target: '.project-detail-page .project-vehicles-add', title: 'Fahrzeuge', content: 'Fahrzeuge pro Tag zuweisen.' },
        { target: '.project-detail-page .project-statistics', title: 'Statistiken', content: 'Auswertungen und Tabellen.' },
      ];
    case /\/mitarbeiter$/.test(path):
      return [
        { target: 'body', placement: 'center', title: 'Mitarbeiter', content: 'Anlegen, verwalten und filtern.' },
        { target: '.employee-create-button', title: 'Neuer Mitarbeiter', content: 'Dialog zum Anlegen öffnen.' },
        { target: '.employees-table', title: 'Tabelle', content: 'Alle Mitarbeiter und Aktionen.' },
      ];
    case /\/mitarbeiter\//.test(path):
      return [
        { target: 'body', placement: 'center', title: 'Mitarbeiterdetails', content: 'Infos, Status & Einsätze.' },
        { target: '.employee-detail-page .employee-info-card', title: 'Informationen', content: 'Stammdaten & Status.' },
        { target: '.employee-detail-page .employee-assignments-table', title: 'Einsätze', content: 'Zeilen filtern & analysieren.' },
      ];
    case /\/fahrzeuge$/.test(path):
      return [
        { target: 'body', placement: 'center', title: 'Fahrzeuge', content: 'Fahrzeuge verwalten.' },
        { target: '.vehicle-create-button', title: 'Neues Fahrzeug', content: 'Neues Fahrzeug anlegen.' },
        { target: '.vehicles-table', title: 'Tabelle', content: 'Liste und Aktionen.' },
      ];
    case /\/timetracking$/.test(path):
      return [
        { target: 'body', placement: 'center', title: 'Zeiterfassung', content: 'Übersicht & Filter.' },
        { target: '.timetracking-cards', title: 'Karten', content: 'Kennzahlen zu Zeiten.' },
        { target: '.timetracking-table', title: 'Tabelle', content: 'Detaillierte Einträge.' },
      ];
    case /\/einstellungen$/.test(path):
      return [
        { target: 'body', placement: 'center', title: 'Einstellungen', content: 'Profil, Benachrichtigungen & Admin-Tabs.' },
        { target: '.profile-form', title: 'Profil', content: 'Daten ändern & speichern.' },
        { target: '.notifications-card', title: 'Benachrichtigungen', content: 'Ein-/Ausschalten, Empfänger setzen.' },
        { target: '.users-tab', title: 'Benutzerverwaltung', content: 'Benutzer & Einladungen (Admin).' },
        { target: '.activity-tab', title: 'Aktivitäten', content: 'Protokoll aller Aktionen.' },
      ];
    default:
      return [];
  }
}

export default function JoyrideProvider() {
  // No-Op: Joyride wird vorerst deaktiviert
  return null;
}
  const [run, setRun] = React.useState(false);
  const [steps, setSteps] = React.useState<Step[]>([]);

  function getRouteKey(path: string): string {
    if (/\/dashboard$/.test(path)) return 'dashboard';
    if (/\/projekte$/.test(path)) return 'projekte';
    if (/\/projektdetail\//.test(path)) return 'projektdetail';
    if (/\/mitarbeiter\//.test(path)) return 'mitarbeiter-detail';
    if (/\/mitarbeiter$/.test(path)) return 'mitarbeiter';
    if (/\/fahrzeuge$/.test(path)) return 'fahrzeuge';
    if (/\/timetracking$/.test(path)) return 'timetracking';
    if (/\/einstellungen$/.test(path)) return 'einstellungen';
    return '';
  }

  React.useEffect(() => {
    try {
      const userId = (session as any)?.user?.id as string | undefined;
      const routeKey = getRouteKey(pathname || '');
      const key = routeKey === 'projektdetail'
        ? (userId ? `onboarding-seen:${userId}:projektdetail` : 'onboarding-seen:projektdetail')
        : (userId ? `onboarding-seen:${userId}:all` : 'onboarding-seen:all');
      const force = searchParams?.get('tour');
      const shouldForceStart = force === '1' || force === 'start';

      if (shouldForceStart) {
        localStorage.removeItem(key);
      }

      const seen = localStorage.getItem(key);
      if (!seen || shouldForceStart) {
        const s = getStepsForPath(pathname || '');
        if (s.length > 0) {
          setSteps(s);
          setRun(true);
          // Markiere als gesehen, sobald die Tour gestartet wurde,
          // damit sie nicht bei jedem Reload erneut erscheint
          try { localStorage.setItem(key, '1'); } catch {}
        }
      }
    } catch {}
  }, [pathname, searchParams, session]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finished = status === STATUS.FINISHED || status === STATUS.SKIPPED;
    if (finished) {
      try {
        const userId = (session as any)?.user?.id as string | undefined;
        const routeKey = getRouteKey(pathname || '');
        const key = routeKey === 'projektdetail'
          ? (userId ? `onboarding-seen:${userId}:projektdetail` : 'onboarding-seen:projektdetail')
          : (userId ? `onboarding-seen:${userId}:all` : 'onboarding-seen:all');
        localStorage.setItem(key, '1');
      } catch {}
      setRun(false);
    }
  };

  if (!run || steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      callback={handleJoyrideCallback}
      styles={{
        options: {
          zIndex: 100000,
          primaryColor: '#2563eb',
          textColor: '#0f172a',
          overlayColor: 'rgba(2,6,23,0.45)',
        },
        tooltipContainer: {
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(2,6,23,0.15)',
          padding: 16,
        },
        tooltipTitle: {
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 6,
          color: '#0f172a',
        },
        tooltipContent: {
          fontSize: 14,
          lineHeight: 1.5,
          color: '#334155',
        },
        buttonNext: {
          backgroundImage: 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: 12,
          padding: '10px 16px',
          boxShadow: '0 8px 16px rgba(37,99,235,0.35)',
        },
        buttonBack: {
          background: '#f1f5f9',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '10px 14px',
        },
        buttonSkip: {
          color: '#64748b',
        },
        spotlight: {
          borderRadius: 8,
        },
      }}
      locale={{
        back: 'Zurück',
        close: 'Schließen',
        last: 'Fertig',
        next: 'Weiter',
        skip: 'Überspringen',
      }}
    />
  );
}


