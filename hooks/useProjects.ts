'use client';
import { useState, useEffect } from 'react'
import { ProjectsApi } from '@/lib/api/projects'
import type { Project, TimeEntry } from '../types'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lade Projekte vom Server
  const fetchProjects = async () => {
    try {
      setError(null)
      console.log('Lade Projekte...')
      
      const data = await ProjectsApi.list()
      if (data.success && data.projects) {
        const mappedProjects = data.projects.map((p: any) => ({ ...p, id: p.id || p._id }))
        setProjects(mappedProjects)
      } else {
        const errorMsg = (data as any).message || 'Unbekannter Fehler'
        setError(errorMsg)
      }
    } catch (error) {
      console.error('Fehler beim Laden der Projekte:', error)
      setError(error instanceof Error ? error.message : 'Unbekannter Fehler')
    } finally {
      setIsLoaded(true)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  // Projekt anlegen
  const addProject = async (projectData: Omit<Project, 'id' | 'mitarbeiterZeiten'>) => {
    try {
      await ProjectsApi.create(projectData)
      await fetchProjects()
    } catch (error) {
      console.error('Fehler beim Anlegen des Projekts:', error)
    }
  }

  // Projekt aktualisieren
  const updateProject = async (id: string, updatedData: Partial<Project>) => {
    try {
      await ProjectsApi.update(id, updatedData)
      await fetchProjects()
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Projekts:', error)
    }
  }

  // Projekt löschen
  const deleteProject = async (id: string) => {
    try {
      await ProjectsApi.remove(id)
      await fetchProjects()
    } catch (error) {
      console.error('Fehler beim Löschen des Projekts:', error)
    }
  }

  // Zeit-Eintrag hinzufügen (vereinfachtes Beispiel)
  const addTimeEntry = () => {}
  const updateTimeEntry = () => {}
  const deleteTimeEntry = () => {}
  const addVehicleAssignment = () => {}
  const removeVehicleAssignment = () => {}
  const checkVehicleAvailability = () => true

  return {
    projects,
    setProjects,
    addProject,
    updateProject,
    deleteProject,
    addTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    addVehicleAssignment,
    removeVehicleAssignment,
    checkVehicleAvailability,
    fetchProjects,
    isLoaded,
    error,
  }
} 