"use client";

import React from "react";

export default function JoyrideProvider() {
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


