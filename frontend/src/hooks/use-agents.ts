import { useState, useCallback, useEffect } from 'react';
import { useOrganizationContext } from 'src/context/OrganizationContext';
import { useProjectContext } from 'src/contexts/ProjectContext';
import axiosInstance from 'src/utils/axios';

interface Agent {
  _id: string;
  _key: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  tools?: any[];
  model?: string;
  isPublic?: boolean;
  isShared?: boolean;
  createdBy?: string;
  orgId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentConversation {
  _id: string;
  agentId: string;
  title: string;
  messages: any[];
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
}

interface AgentsResponse {
  agents: Agent[];
  total: number;
  page: number;
  totalPages: number;
}

interface UseAgentsOptions {
  limit?: number;
  includeShared?: boolean;
  includePublic?: boolean;
}

export const useAgents = (options: UseAgentsOptions = {}) => {
  const { currentOrg } = useOrganizationContext();
  const { currentProject, isAllProjects } = useProjectContext();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchAgents = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
    if (!currentOrg) {
      setError('No organization selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build params with project context
      const params: any = {
        page: pageNum,
        limit: options.limit || 20,
        orgId: currentOrg._id,
      };

      // Add projectId if not in "All Projects" view
      if (!isAllProjects && currentProject) {
        params.projectId = currentProject._id;
      }

      // Add optional filters
      if (options.includeShared !== undefined) {
        params.includeShared = options.includeShared;
      }
      if (options.includePublic !== undefined) {
        params.includePublic = options.includePublic;
      }

      const response = await axiosInstance.get<AgentsResponse>('/api/v1/agents', {
        params
      });

      const { agents: newAgents = [], total: totalCount = 0, totalPages = 1 } = response.data;

      if (reset) {
        setAgents(newAgents);
      } else {
        setAgents(prev => [...prev, ...newAgents]);
      }

      setTotal(totalCount);
      setHasMore(pageNum < totalPages);
      setPage(pageNum);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch agents');
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, currentProject, isAllProjects, options]);

  const createAgent = useCallback(async (agentData: Partial<Agent>) => {
    if (!currentOrg) {
      throw new Error('No organization selected');
    }

    const payload: any = {
      ...agentData,
      orgId: currentOrg._id,
    };

    // Add projectId if not in "All Projects" view
    if (!isAllProjects && currentProject) {
      payload.projectId = currentProject._id;
    }

    const response = await axiosInstance.post('/api/v1/agents', payload);

    // Add new agent to the list
    setAgents(prev => [response.data, ...prev]);
    setTotal(prev => prev + 1);

    return response.data;
  }, [currentOrg, currentProject, isAllProjects]);

  const updateAgent = useCallback(async (agentId: string, updates: Partial<Agent>) => {
    const response = await axiosInstance.put(`/api/v1/agents/${agentId}`, updates);

    // Update agent in the list
    setAgents(prev => prev.map(a => a._id === agentId ? response.data : a));

    return response.data;
  }, []);

  const deleteAgent = useCallback(async (agentId: string) => {
    await axiosInstance.delete(`/api/v1/agents/${agentId}`);
    setAgents(prev => prev.filter(a => a._id !== agentId));
    setTotal(prev => prev - 1);
  }, []);

  const shareAgent = useCallback(async (agentId: string, data: { userIds?: string[], teamIds?: string[], role: string }) => {
    const response = await axiosInstance.post(`/api/v1/agents/${agentId}/share`, data);
    return response.data;
  }, []);

  const unshareAgent = useCallback(async (agentId: string, data: { userIds?: string[], teamIds?: string[] }) => {
    const response = await axiosInstance.post(`/api/v1/agents/${agentId}/unshare`, data);
    return response.data;
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchAgents(page + 1);
    }
  }, [loading, hasMore, page, fetchAgents]);

  const refresh = useCallback(() => {
    setPage(1);
    fetchAgents(1, true);
  }, [fetchAgents]);

  // Refetch when project or org changes
  useEffect(() => {
    if (currentOrg) {
      refresh();
    }
  }, [currentOrg?._id, currentProject?._id, isAllProjects]);

  return {
    agents,
    loading,
    error,
    total,
    hasMore,
    page,
    fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    shareAgent,
    unshareAgent,
    loadMore,
    refresh,
  };
};

// Hook for agent conversations
export const useAgentConversations = (agentKey: string, options: { limit?: number, archived?: boolean } = {}) => {
  const { currentOrg } = useOrganizationContext();
  const { currentProject, isAllProjects } = useProjectContext();

  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchConversations = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
    if (!currentOrg || !agentKey) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params: any = {
        page: pageNum,
        limit: options.limit || 20,
        orgId: currentOrg._id,
      };

      // Add projectId if not in "All Projects" view
      if (!isAllProjects && currentProject) {
        params.projectId = currentProject._id;
      }

      if (options.archived !== undefined) {
        params.archived = options.archived;
      }

      const response = await axiosInstance.get(`/api/v1/agents/${agentKey}/conversations`, {
        params
      });

      const { conversations: newConversations = [], totalPages = 1 } = response.data;

      if (reset) {
        setConversations(newConversations);
      } else {
        setConversations(prev => [...prev, ...newConversations]);
      }

      setHasMore(pageNum < totalPages);
      setPage(pageNum);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch agent conversations');
      console.error('Error fetching agent conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, currentProject, isAllProjects, agentKey, options]);

  const createConversation = useCallback(async (message?: string) => {
    if (!currentOrg) {
      throw new Error('No organization selected');
    }

    const payload: any = {
      orgId: currentOrg._id,
    };

    // Add projectId if not in "All Projects" view
    if (!isAllProjects && currentProject) {
      payload.projectId = currentProject._id;
    }

    if (message) {
      payload.initialMessage = message;
    }

    const response = await axiosInstance.post(`/api/v1/agents/${agentKey}/conversations`, payload);
    return response.data;
  }, [currentOrg, currentProject, isAllProjects, agentKey]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await axiosInstance.delete(`/api/v1/agents/${agentKey}/conversations/${conversationId}`);
    setConversations(prev => prev.filter(c => c._id !== conversationId));
  }, [agentKey]);

  const archiveConversation = useCallback(async (conversationId: string) => {
    await axiosInstance.patch(`/api/v1/agents/${agentKey}/conversations/${conversationId}/archive`);
    setConversations(prev => prev.filter(c => c._id !== conversationId));
  }, [agentKey]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchConversations(page + 1);
    }
  }, [loading, hasMore, page, fetchConversations]);

  const refresh = useCallback(() => {
    setPage(1);
    fetchConversations(1, true);
  }, [fetchConversations]);

  // Refetch when project, org, or agent changes
  useEffect(() => {
    if (currentOrg && agentKey) {
      refresh();
    }
  }, [currentOrg?._id, currentProject?._id, isAllProjects, agentKey]);

  return {
    conversations,
    loading,
    error,
    hasMore,
    page,
    fetchConversations,
    createConversation,
    deleteConversation,
    archiveConversation,
    loadMore,
    refresh,
  };
};