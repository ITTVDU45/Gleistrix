import React, { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Plus } from 'lucide-react';
import type { Project } from '../../types';
import dbConnect from '../../lib/dbConnect';
import { Project as ProjectModel } from '../../lib/models/Project';
import ProjectDialogs from '../../components/ProjectDialogs';
import ProjectListWithFilter from '../../components/ProjectListWithFilter';

// Server-seitige Datenabfrage
async function getProjectsData() {
  try {
    await dbConnect();
    const projects = await ProjectModel.find({}).lean();
    return projects.map((project: any) => ({
      ...project,
      id: project._id?.toString() || project.id,
      _id: project._id?.toString(),
      createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
      updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : project.updatedAt,
      datumBeginn: project.datumBeginn instanceof Date ? project.datumBeginn.toISOString() : project.datumBeginn,
      datumEnde: project.datumEnde instanceof Date ? project.datumEnde.toISOString() : project.datumEnde
    }));
  } catch (error) {
    console.error('Fehler beim Laden der Projekte:', error);
    return [];
  }
}

function getTotalHours(project: Project) {
  return Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
    return sum + entries.reduce((entrySum: number, entry: any) => entrySum + entry.stunden, 0);
  }, 0);
}

export default async function ProjektePage() {
  const projects = await getProjectsData();

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="min-h-[80px]" />}> 
        <ProjectDialogs projects={projects} />
      </Suspense>
      {/* Header */}
      <div className="flex items-center justify-between projects-cards">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Projekte</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Verwalten Sie Ihre Projekte</p>
        </div>
        <Link href="/projekte?create=1">
          <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 project-create-button">
            <Plus className="h-4 w-4" />
            Neues Projekt
          </Button>
        </Link>
      </div>

      {/* Dynamische Projektstatistiken und Filter */}
      <div className="projects-table">
        <ProjectListWithFilter projects={projects} />
      </div>
    </div>
  );
} 