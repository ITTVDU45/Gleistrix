import '../styles/globals.css';
import type { ReactNode } from 'react';
import ClientLayout from '../components/ClientLayout';

export const metadata = {
  title: 'MH-Zeiterfassung',
  description: 'Projektmanagement und Zeiterfassungssystem',
  icons: {
    // Stelle sicher, dass nur vorhandene Dateien referenziert werden
    icon: ['/fivicon.png']
  }
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Nonce aus Middleware beziehen (optional, zur Build-Zeit ohne next/headers nutzbar)
  let nonce: string | null = null;
  try {
    // Dynamischer Import, um Build-Time Fehler zu vermeiden
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { headers } = require('next/headers');
    const h = await headers();
    nonce = h.get('x-nonce');
  } catch {}
  return (
    <html lang="de" className="h-full" suppressHydrationWarning>
      <body className="h-full bg-slate-50 dark:bg-slate-900 antialiased">
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}