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
];

export default function ConditionalSidebar() {
  const pathname = usePathname();
  
  // Prüfe, ob die aktuelle Route eine Sidebar haben soll
  const shouldShowSidebar = !noSidebarRoutes.includes(pathname);
  
  if (!shouldShowSidebar) {
    return null;
  }
  
  return <Sidebar />;
} 