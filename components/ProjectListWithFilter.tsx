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

  React.useEffect(() => {
    setFilteredProjects(projects);
  }, [projects]);

  const handleFilterChange = useCallback((nextProjects: Project[]) => {
    setFilteredProjects(nextProjects);
  }, []);

  return (
    <div className="space-y-8 lg:space-y-10">
      <LockedProjectDialog lockedProjectId={lockedProjectId} onClose={() => setLockedProjectId(null)} />

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Projektmonitor</h2>
          <p className="mt-1 text-sm text-slate-600">
            Kennzahlen, Filter und Tabelle sind klar voneinander getrennt und ruhiger gruppiert.
          </p>
        </div>
        <DynamicProjectStats projects={filteredProjects} />
      </section>

      <section className="space-y-4">
        <ProjectListFilter
          projects={projects}
          onFilterChange={handleFilterChange}
        />
      </section>

      <section className="space-y-4">
        <ProjectTableClient projects={filteredProjects} />
      </section>
    </div>
  );
}

function LockedProjectDialog({ lockedProjectId, onClose }: { lockedProjectId: string | null, onClose: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lockInfo, setLockInfo] = useState<any>({ isLocked: false, isOwnLock: false });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locked = params.get('locked');
    if (locked) {
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
