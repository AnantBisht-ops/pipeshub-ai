import React, { createContext, useContext, useState, useEffect } from 'react';
import { useOrganizationContext } from '../context/OrganizationContext';
import axios from '../utils/axios';

interface Project {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  members: any[];
  admins: any[];
  metadata: {
    conversationCount: number;
    documentCount: number;
    lastActivityAt: Date;
  };
  settings?: any;
  isArchived?: boolean;
  createdAt?: Date;
}

interface ProjectContextValue {
  projects: Project[];
  currentProject: Project | null;
  isAllProjects: boolean;
  isLoading: boolean;
  switchProject: (projectId: string | null) => void;
  createProject: (data: any) => Promise<void>;
  updateProject: (projectId: string, data: any) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within ProjectProvider');
  }
  return context;
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentOrg } = useOrganizationContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isAllProjects, setIsAllProjects] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = async () => {
    if (!currentOrg) return;

    try {
      setIsLoading(true);
      const response = await axios.get('/api/v1/projects');

      // Handle both wrapped { projects: [...] } and direct array responses
      const projectsData = response.data?.projects || response.data || [];
      const projectsArray = Array.isArray(projectsData) ? projectsData : [];

      setProjects(projectsArray);

      // Set first project as current if none selected
      if (!currentProject && projectsArray.length > 0) {
        setCurrentProject(projectsArray[0]);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  const switchProject = (projectId: string | null) => {
    if (projectId === null) {
      setIsAllProjects(true);
      setCurrentProject(null);
    } else {
      setIsAllProjects(false);
      const project = projects.find(p => p._id === projectId);
      if (project) {
        setCurrentProject(project);
        localStorage.setItem(`lastProject_${currentOrg?._id}`, projectId);
      }
    }
  };

  const createProject = async (data: any) => {
    try {
      const response = await axios.post(
        '/api/v1/projects',
        data
      );
      setProjects(prev => [...prev, response.data]);
      switchProject(response.data._id);
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  };

  const updateProject = async (projectId: string, data: any) => {
    try {
      const response = await axios.patch(
        `/api/v1/projects/${projectId}`,
        data
      );
      setProjects(prev =>
        prev.map(p => p._id === projectId ? response.data : p)
      );
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await axios.delete(`/api/v1/projects/${projectId}`);
      setProjects(prev => prev.filter(p => p._id !== projectId));

      if (currentProject?._id === projectId) {
        switchProject(projects[0]?._id || null);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (currentOrg) {
      fetchProjects();

      // Restore last selected project
      const lastProjectId = localStorage.getItem(`lastProject_${currentOrg._id}`);
      if (lastProjectId) {
        switchProject(lastProjectId);
      }
    }
  }, [currentOrg]);

  const value: ProjectContextValue = {
    projects,
    currentProject,
    isAllProjects,
    isLoading,
    switchProject,
    createProject,
    updateProject,
    deleteProject
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};