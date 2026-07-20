import React from 'react';
import { redirect } from 'next/navigation';

export default function Page() {
  // Weiterleitung zur Login-Seite
  redirect('/login');
} 