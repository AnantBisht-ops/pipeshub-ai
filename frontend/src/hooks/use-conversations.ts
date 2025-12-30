import { useState, useCallback, useEffect } from 'react';
import { useOrganizationContext } from 'src/context/OrganizationContext';
import { useProjectContext } from 'src/contexts/ProjectContext';
import axiosInstance from 'src/utils/axios';

interface Conversation {
  _id: string;
  title: string;
  messages: any[];
  createdAt: string;
  updatedAt: string;
  isShared?: boolean;
  isArchived?: boolean;
}

interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  totalPages: number;
}

interface UseConversationsOptions {
  limit?: number;
  shared?: boolean;
  archived?: boolean;
}

export const useConversations = (options: UseConversationsOptions = {}) => {
  const { currentOrg } = useOrganizationContext();
  const { currentProject, isAllProjects } = useProjectContext();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchConversations = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
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
      if (options.shared !== undefined) {
        params.shared = options.shared;
      }
      if (options.archived !== undefined) {
        params.archived = options.archived;
      }

      const response = await axiosInstance.get<ConversationsResponse>('/api/v1/conversations/', {
        params
      });

      const { conversations: newConversations = [], total: totalCount = 0, totalPages = 1 } = response.data;

      if (reset) {
        setConversations(newConversations);
      } else {
        setConversations(prev => [...prev, ...newConversations]);
      }

      setTotal(totalCount);
      setHasMore(pageNum < totalPages);
      setPage(pageNum);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch conversations');
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, currentProject, isAllProjects, options]);

  const createConversation = useCallback(async (data: { title?: string; message?: string }) => {
    if (!currentOrg) {
      throw new Error('No organization selected');
    }

    const payload: any = {
      ...data,
      orgId: currentOrg._id,
    };

    // Add projectId if not in "All Projects" view
    if (!isAllProjects && currentProject) {
      payload.projectId = currentProject._id;
    }

    const response = await axiosInstance.post('/api/v1/conversations/create', payload);
    return response.data;
  }, [currentOrg, currentProject, isAllProjects]);

  const updateConversation = useCallback(async (conversationId: string, updates: any) => {
    const response = await axiosInstance.patch(`/api/v1/conversations/${conversationId}`, updates);
    return response.data;
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await axiosInstance.delete(`/api/v1/conversations/${conversationId}`);
    setConversations(prev => prev.filter(c => c._id !== conversationId));
    setTotal(prev => prev - 1);
  }, []);

  const archiveConversation = useCallback(async (conversationId: string) => {
    await axiosInstance.patch(`/api/v1/conversations/${conversationId}/archive`);
    setConversations(prev => prev.filter(c => c._id !== conversationId));
  }, []);

  const unarchiveConversation = useCallback(async (conversationId: string) => {
    await axiosInstance.patch(`/api/v1/conversations/${conversationId}/unarchive`);
    // Refresh the list
    fetchConversations(1, true);
  }, [fetchConversations]);

  const shareConversation = useCallback(async (conversationId: string, data: any) => {
    const response = await axiosInstance.post(`/api/v1/conversations/${conversationId}/share`, data);
    return response.data;
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchConversations(page + 1);
    }
  }, [loading, hasMore, page, fetchConversations]);

  const refresh = useCallback(() => {
    setPage(1);
    fetchConversations(1, true);
  }, [fetchConversations]);

  // Refetch when project or org changes
  useEffect(() => {
    if (currentOrg) {
      refresh();
    }
  }, [currentOrg?._id, currentProject?._id, isAllProjects]);

  return {
    conversations,
    loading,
    error,
    total,
    hasMore,
    page,
    fetchConversations,
    createConversation,
    updateConversation,
    deleteConversation,
    archiveConversation,
    unarchiveConversation,
    shareConversation,
    loadMore,
    refresh,
  };
};