"use client";
import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProjectCreateForm from './ProjectCreateForm';
import ProjectEditForm from './ProjectEditForm';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import type { Project } from '../types';

interface ProjectDialogsProps {
  projects: Project[];
}

export default function ProjectDialogs({ projects }: ProjectDialogsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const createOpen = searchParams.get('create') === '1';
  const editId = searchParams.get('edit');
  const editProject = projects.find((p) => p.id === editId);

  const handleClose = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('create');
    params.delete('edit');
    router.replace(`/projekte${params.toString() ? '?' + params.toString() : ''}`);
  };

  return (
    <>
      <Dialog open={createOpen} onOpenChange={open => !open && handleClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogTitle>Neues Projekt erstellen</DialogTitle>
          <ProjectCreateForm onSuccess={handleClose} onCancel={handleClose} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!editId && !!editProject} onOpenChange={open => !open && handleClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogTitle>Projekt bearbeiten</DialogTitle>
          {editProject && (
            <ProjectEditForm project={editProject} onSuccess={handleClose} onCancel={handleClose} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
} 