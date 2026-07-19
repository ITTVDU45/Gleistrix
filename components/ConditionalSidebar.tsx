"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

// Seiten, auf denen KEINE Sidebar angezeigt werden soll
const noSidebarRoutes = [
  '/login',
  '/passwort-vergessen',
  '/auth/set-password',
  '/setup',
  '/send-email',
  '/lager/app',
];

export default function ConditionalSidebar() {
  const pathname = usePathname();

  // Prüfe, ob die aktuelle Route eine Sidebar haben soll.
  // Das Subunternehmen-Portal bringt eine eigene Navigation mit.
  const shouldShowSidebar = !noSidebarRoutes.includes(pathname)
    && !pathname.startsWith('/subunternehmen');
  
  if (!shouldShowSidebar) {
    return null;
  }
  
  return <Sidebar />;
} 