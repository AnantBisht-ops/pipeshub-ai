import { useState, useCallback, useEffect } from 'react';
import { useOrganizationContext } from 'src/context/OrganizationContext';
import { useProjectContext } from 'src/contexts/ProjectContext';
import axiosInstance from 'src/utils/axios';

interface Document {
  _id: string;
  documentName: string;
  documentPath: string;
  mimeType: string;
  size: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  orgId?: string;
  projectId?: string;
  isDeleted?: boolean;
}

interface DocumentsResponse {
  documents: Document[];
  total: number;
  page: number;
  totalPages: number;
}

interface UseDocumentsOptions {
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: any;
}

export const useDocuments = (options: UseDocumentsOptions = {}) => {
  const { currentOrg } = useOrganizationContext();
  const { currentProject, isAllProjects } = useProjectContext();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchDocuments = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
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
        ...options.filter,
      };

      // Add projectId if not in "All Projects" view
      if (!isAllProjects && currentProject) {
        params.projectId = currentProject._id;
      }

      // Add sorting
      if (options.sortBy) {
        params.sortBy = options.sortBy;
        params.sortOrder = options.sortOrder || 'desc';
      }

      const response = await axiosInstance.get<DocumentsResponse>('/storage/list', {
        params
      });

      const { documents: newDocuments = [], total: totalCount = 0, totalPages = 1 } = response.data;

      if (reset) {
        setDocuments(newDocuments);
      } else {
        setDocuments(prev => [...prev, ...newDocuments]);
      }

      setTotal(totalCount);
      setHasMore(pageNum < totalPages);
      setPage(pageNum);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch documents');
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, currentProject, isAllProjects, options]);

  const uploadDocument = useCallback(async (file: File, metadata?: any) => {
    if (!currentOrg) {
      throw new Error('No organization selected');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('orgId', currentOrg._id);

    // Add projectId if not in "All Projects" view
    if (!isAllProjects && currentProject) {
      formData.append('projectId', currentProject._id);
    }

    // Add any additional metadata
    if (metadata) {
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });
    }

    const response = await axiosInstance.post('/storage/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // Add new document to the list
    setDocuments(prev => [response.data, ...prev]);
    setTotal(prev => prev + 1);

    return response.data;
  }, [currentOrg, currentProject, isAllProjects]);

  const deleteDocument = useCallback(async (documentId: string) => {
    await axiosInstance.delete(`/storage/document/${documentId}`);
    setDocuments(prev => prev.filter(d => d._id !== documentId));
    setTotal(prev => prev - 1);
  }, []);

  const downloadDocument = useCallback(async (documentId: string) => {
    const response = await axiosInstance.get(`/storage/document/${documentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }, []);

  const getDocumentUrl = useCallback((documentId: string, version?: number) => {
    const baseUrl = '/storage/document';
    if (version) {
      return `${baseUrl}/${documentId}/version/${version}`;
    }
    return `${baseUrl}/${documentId}`;
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchDocuments(page + 1);
    }
  }, [loading, hasMore, page, fetchDocuments]);

  const refresh = useCallback(() => {
    setPage(1);
    fetchDocuments(1, true);
  }, [fetchDocuments]);

  // Refetch when project or org changes
  useEffect(() => {
    if (currentOrg) {
      refresh();
    }
  }, [currentOrg?._id, currentProject?._id, isAllProjects]);

  return {
    documents,
    loading,
    error,
    total,
    hasMore,
    page,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    getDocumentUrl,
    loadMore,
    refresh,
  };
};