'use client';
import React, { useState, useCallback } from 'react';
import { LocksApi } from '@/lib/api/locks'
import type { Project } from '../types';
import DynamicProjectStats from './DynamicProjectStats';
import ProjectListFilter from './ProjectListFilter';
import ProjectTableClient from './ProjectTableClient';

interface ProjectListWithFilterProps {
  projects: Project[];
}

export default function ProjectListWithFilter({ projects }: ProjectListWithFilterProps) {
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(projects);
  const [lockedProjectId, setLockedProjectId] = useState<string | null>(null);

  // Aktualisiere filteredProjects wenn sich projects ändert
  React.useEffect(() => {
    setFilteredProjects(projects);
  }, [projects]);

  // Callback für Filter-Änderungen
  const handleFilterChange = useCallback((filteredProjects: Project[]) => {
    setFilteredProjects(filteredProjects);
  }, []);

  return (
    <>
      {/* Zeige Blockierungsdialog falls wir von einer gesperrten Detailseite zurückgeleitet wurden */}
      <LockedProjectDialog lockedProjectId={lockedProjectId} onClose={() => setLockedProjectId(null)} />
      {/* Dynamische Projektstatistiken */}
      <DynamicProjectStats projects={filteredProjects} />

      {/* Projektliste mit Filter */}
      <ProjectListFilter 
        projects={projects} 
        onFilterChange={handleFilterChange} 
      />

      {/* Projektliste */}
      <ProjectTableClient projects={filteredProjects} />
    </>
  );
} 

// Inline-Komponente für den Blockierungsdialog basierend auf Query-Param
function LockedProjectDialog({ lockedProjectId, onClose }: { lockedProjectId: string | null, onClose: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lockInfo, setLockInfo] = useState<any>({ isLocked: false, isOwnLock: false });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locked = params.get('locked');
    if (locked) {
      // Entferne Query Param aus der URL (clean)
      const url = new URL(window.location.href);
      url.searchParams.delete('locked');
      window.history.replaceState({}, '', url.toString());

      LocksApi.check('project', locked)
        .then(data => {
          setLockInfo({ isLocked: data.isLocked, isOwnLock: data.isOwnLock, lockedBy: data.lock?.lockedBy });
          setDialogOpen(data.isLocked && !data.isOwnLock);
        })
        .catch(() => setDialogOpen(false));
    }
  }, []);

  if (!dialogOpen) return null;

  const projectName = undefined;
  const dummy = { isLocked: true, isOwnLock: false, ...lockInfo };

  const onRetry = async () => {
    // No-op: Nutzer kann Tabelle erneut versuchen/neu laden
    const status = await LocksApi.check('project', lockedProjectId!)
    if (!status.isLocked || status.isOwnLock) {
      setDialogOpen(false);
    }
  };

  const { ResourceLockDialog } = require('./ui/ResourceLockDialog');
  return (
    <ResourceLockDialog
      isOpen={dialogOpen}
      onClose={() => { setDialogOpen(false); onClose(); }}
      onRetry={onRetry}
      lockInfo={dummy}
      resourceType="project"
      resourceName={projectName}
      blockPage={false}
    />
  );
}