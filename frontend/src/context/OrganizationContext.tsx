import type { ReactNode } from 'react';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import axiosInstance from 'src/utils/axios';

import { useAuthContext } from 'src/auth/hooks';

// Types for Organization
export interface Organization {
  _id: string;
  slug: string;
  registeredName?: string;
  name?: string;
  shortName?: string;
  domain: string;
  contactEmail: string;
  accountType: 'individual' | 'business';
  phoneNumber?: string;
  onBoardingStatus?: 'configured' | 'notConfigured' | 'skipped';
  settings?: {
    maxProjects: number;
    maxUsers: number;
    features: string[];
  };
  metadata?: {
    projectCount: number;
    userCount: number;
    storageUsed: number;
  };
  subscription?: {
    plan: 'free' | 'starter' | 'pro' | 'enterprise';
    validUntil?: Date;
  };
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserOrganization {
  organization: Organization;
  role: 'admin' | 'member' | 'owner';
  joinedAt: Date;
  isDefault?: boolean;
}

interface OrganizationContextValue {
  organizations: UserOrganization[];
  currentOrg: Organization | null;
  isLoading: boolean;
  error: string | null;
  switchOrganization: (orgId: string) => Promise<void>;
  createOrganization: (data: Partial<Organization>) => Promise<Organization>;
  refreshOrganizations: () => Promise<void>;
  updateCurrentOrganization: (data: Partial<Organization>) => Promise<void>;
}

interface OrganizationProviderProps {
  children: ReactNode;
}

// Create context
const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const { user, checkUserSession } = useAuthContext();
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's organizations
  const fetchOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await axiosInstance.get('/api/v1/organizations/my-organizations');

      // Debug logging - full response
      console.log('[DEBUG] Full API response:', response.data);

      const { organizations: orgs, currentOrgId, defaultOrgId } = response.data || {};

      // Debug logging
      console.log('[DEBUG] OrganizationContext received:', {
        orgsCount: orgs?.length,
        firstOrg: orgs?.[0],
        currentOrgId,
        defaultOrgId,
        orgsArray: orgs
      });

      // Handle if orgs is undefined or not an array
      if (!orgs || !Array.isArray(orgs)) {
        console.warn('[DEBUG] Organizations is not an array:', orgs);
        setOrganizations([]);
        setCurrentOrg(null);
        setIsLoading(false);
        return;
      }

      setOrganizations(orgs);

      // Set current organization based on priority:
      // 1. currentOrgId from response (last accessed)
      // 2. defaultOrgId from response
      // 3. First organization in the list
      const targetOrgId = currentOrgId || defaultOrgId || orgs?.[0]?.organization?._id;

      if (targetOrgId && orgs.length > 0) {
        const currentOrgData = orgs.find((org: UserOrganization) =>
          org?.organization?._id === targetOrgId
        );
        setCurrentOrg(currentOrgData?.organization || orgs[0]?.organization || null);
      } else {
        setCurrentOrg(null);
      }
    } catch (err: any) {
      console.error('[DEBUG] Failed to fetch organizations:', err);
      console.error('[DEBUG] Error details:', {
        message: err?.message,
        response: err?.response?.data,
        status: err?.response?.status
      });
      setError('Failed to load organizations');
      setOrganizations([]);
      setCurrentOrg(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Switch to a different organization
  const switchOrganization = useCallback(async (orgId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axiosInstance.post(`/api/v1/organizations/switch/${orgId}`);

      // Update tokens if returned
      if (response.data.accessToken) {
        localStorage.setItem('accessToken', response.data.accessToken);
      }
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }

      // Update current organization
      const targetOrg = organizations.find(org => org.organization._id === orgId);
      if (targetOrg) {
        setCurrentOrg(targetOrg.organization);
      }

      // Refresh user session to update JWT context
      if (checkUserSession) {
        await checkUserSession();
      }

      // Optionally refresh the page or update app state
      // window.location.href = '/';
    } catch (err) {
      console.error('Failed to switch organization:', err);
      setError('Failed to switch organization');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [organizations, checkUserSession]);

  // Create a new organization
  const createOrganization = useCallback(async (data: Partial<Organization>): Promise<Organization> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axiosInstance.post('/api/v1/organizations/create', data);
      const newOrg = response.data.organization;

      // Refresh organizations list
      await fetchOrganizations();

      // Switch to the new organization
      if (newOrg._id) {
        await switchOrganization(newOrg._id);
      }

      return newOrg;
    } catch (err) {
      console.error('Failed to create organization:', err);
      setError('Failed to create organization');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchOrganizations, switchOrganization]);

  // Update current organization
  const updateCurrentOrganization = useCallback(async (data: Partial<Organization>) => {
    if (!currentOrg) {
      throw new Error('No organization selected');
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await axiosInstance.put(
        `/api/v1/organizations/${currentOrg._id}`,
        data
      );

      const updatedOrg = response.data.organization;

      // Update local state
      setCurrentOrg(updatedOrg);
      setOrganizations(prev =>
        prev.map(org =>
          org.organization._id === updatedOrg._id
            ? { ...org, organization: updatedOrg }
            : org
        )
      );
    } catch (err) {
      console.error('Failed to update organization:', err);
      setError('Failed to update organization');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg]);

  // Refresh organizations list
  const refreshOrganizations = useCallback(async () => {
    await fetchOrganizations();
  }, [fetchOrganizations]);

  // Fetch organizations on mount and when user changes
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const value = {
    organizations,
    currentOrg,
    isLoading,
    error,
    switchOrganization,
    createOrganization,
    refreshOrganizations,
    updateCurrentOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

// Custom hook to use organization context
export const useOrganizationContext = (): OrganizationContextValue => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganizationContext must be used within OrganizationProvider');
  }
  return context;
};

// Export for consumer pattern if needed
export const OrganizationConsumer = OrganizationContext.Consumer;