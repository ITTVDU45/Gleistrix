'use client';

import React from 'react';
import type { ReactNode } from 'react';
import ConditionalSidebar from './ConditionalSidebar';
import ConditionalLayout from './ConditionalLayout';
import { ThemeProvider } from './ThemeProvider';
import { SessionProvider } from 'next-auth/react';
import JoyrideProvider from './JoyrideProvider';

export default function ClientLayout({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <SessionProvider>
      <ThemeProvider nonce={nonce}>
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