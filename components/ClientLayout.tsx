'use client';

import React from 'react';
import type { ReactNode } from 'react';
import ConditionalSidebar from './ConditionalSidebar';
import ConditionalLayout from './ConditionalLayout';
import { ThemeProvider } from './ThemeProvider';
import { SessionProvider } from 'next-auth/react';
import JoyrideProvider from './JoyrideProvider';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <div className="flex h-full">
          <ConditionalSidebar />
          <ConditionalLayout>
            <JoyrideProvider />
            {children}
          </ConditionalLayout>
        </div>
      </ThemeProvider>
    </SessionProvider>
  );
}