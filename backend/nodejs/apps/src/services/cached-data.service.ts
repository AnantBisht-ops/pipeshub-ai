/**
 * Cached Data Service
 * Wraps database operations with caching layer for performance
 */

import { cacheService } from './cache.service';
import { OrganizationModel } from '../modules/organizations/models/organization.model';
import { ProjectModel } from '../modules/projects/models/project.model';
import { UserModel } from '../modules/users/models/user.model';
import { logger } from '../libs/utils/logger';
import { Types } from 'mongoose';

export class CachedDataService {
  private static instance: CachedDataService;

  private constructor() {
    // Initialize cache connection
    cacheService.connect().catch(err => {
      logger.error('Failed to connect to cache:', err);
    });
  }

  static getInstance(): CachedDataService {
    if (!CachedDataService.instance) {
      CachedDataService.instance = new CachedDataService();
    }
    return CachedDataService.instance;
  }

  // ================= ORGANIZATIONS =================

  async getOrganization(orgId: string): Promise<any> {
    try {
      // Try cache first
      const cached = await cacheService.getOrganization(orgId);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const organization = await OrganizationModel.findById(orgId)
        .select('-__v')
        .lean();

      if (organization) {
        // Cache for future use
        await cacheService.setOrganization(orgId, organization);
      }

      return organization;
    } catch (error) {
      logger.error('Error getting organization:', error);
      throw error;
    }
  }

  async getUserOrganizations(userId: string): Promise<any[]> {
    try {
      // Try cache first
      const cached = await cacheService.getUserOrganizations(userId);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const user = await UserModel.findById(userId)
        .select('organizations defaultOrgId')
        .populate({
          path: 'organizations',
          select: '-__v',
        })
        .lean();

      const organizations = user?.organizations || [];

      if (organizations.length > 0) {
        // Cache for future use
        await cacheService.setUserOrganizations(userId, organizations);
      }

      return organizations;
    } catch (error) {
      logger.error('Error getting user organizations:', error);
      throw error;
    }
  }

  async updateOrganization(orgId: string, updates: any): Promise<any> {
    try {
      const organization = await OrganizationModel.findByIdAndUpdate(
        orgId,
        updates,
        { new: true }
      ).lean();

      // Invalidate cache
      await cacheService.invalidateOrganization(orgId);

      return organization;
    } catch (error) {
      logger.error('Error updating organization:', error);
      throw error;
    }
  }

  // ================= PROJECTS =================

  async getProject(projectId: string): Promise<any> {
    try {
      // Try cache first
      const cached = await cacheService.getProject(projectId);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const project = await ProjectModel.findById(projectId)
        .select('-__v')
        .lean();

      if (project) {
        // Cache for future use
        await cacheService.setProject(projectId, project);
      }

      return project;
    } catch (error) {
      logger.error('Error getting project:', error);
      throw error;
    }
  }

  async getUserProjects(userId: string, orgId: string): Promise<any[]> {
    try {
      // Try cache first
      const cached = await cacheService.getUserProjects(userId, orgId);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const projects = await ProjectModel.find({
        orgId: new Types.ObjectId(orgId),
        $or: [
          { members: userId },
          { admins: userId },
          { isDefault: true },
        ],
      })
        .select('-__v')
        .lean();

      if (projects.length > 0) {
        // Cache for future use
        await cacheService.setUserProjects(userId, orgId, projects);
      }

      return projects;
    } catch (error) {
      logger.error('Error getting user projects:', error);
      throw error;
    }
  }

  async updateProject(projectId: string, updates: any): Promise<any> {
    try {
      const project = await ProjectModel.findByIdAndUpdate(
        projectId,
        updates,
        { new: true }
      ).lean();

      // Invalidate cache
      await cacheService.invalidateProject(projectId);

      return project;
    } catch (error) {
      logger.error('Error updating project:', error);
      throw error;
    }
  }

  async createProject(projectData: any): Promise<any> {
    try {
      const project = await ProjectModel.create(projectData);

      // Invalidate user project lists for all members
      if (project.members) {
        for (const memberId of project.members) {
          await cacheService.invalidateUserCache(memberId.toString());
        }
      }

      return project;
    } catch (error) {
      logger.error('Error creating project:', error);
      throw error;
    }
  }

  // ================= PERMISSIONS =================

  async getUserPermissions(userId: string, orgId: string, projectId?: string): Promise<any> {
    try {
      // Try cache first
      const cached = await cacheService.getUserPermissions(userId, orgId, projectId);
      if (cached) {
        return cached;
      }

      // Calculate permissions (simplified version)
      const permissions = await this.calculateUserPermissions(userId, orgId, projectId);

      // Cache for future use
      await cacheService.setUserPermissions(userId, orgId, permissions, projectId);

      return permissions;
    } catch (error) {
      logger.error('Error getting user permissions:', error);
      throw error;
    }
  }

  private async calculateUserPermissions(userId: string, orgId: string, projectId?: string): Promise<any> {
    // Check if user is org admin
    const org = await OrganizationModel.findById(orgId).lean();
    const isOrgAdmin = org?.admins?.includes(userId);

    if (isOrgAdmin) {
      return {
        canCreateProjects: true,
        canDeleteProjects: true,
        canManageMembers: true,
        canManageSettings: true,
        canViewAllProjects: true,
        canViewAllData: true,
        role: 'admin',
      };
    }

    // Check project-specific permissions
    if (projectId) {
      const project = await ProjectModel.findById(projectId).lean();
      const isProjectAdmin = project?.admins?.includes(userId);
      const isProjectMember = project?.members?.includes(userId);

      if (isProjectAdmin) {
        return {
          canCreateProjects: false,
          canDeleteProjects: false,
          canManageMembers: true,
          canManageSettings: true,
          canViewAllProjects: false,
          canViewAllData: true,
          role: 'projectAdmin',
        };
      }

      if (isProjectMember) {
        return {
          canCreateProjects: false,
          canDeleteProjects: false,
          canManageMembers: false,
          canManageSettings: false,
          canViewAllProjects: false,
          canViewAllData: false,
          role: 'member',
        };
      }
    }

    // Default permissions for org member
    return {
      canCreateProjects: false,
      canDeleteProjects: false,
      canManageMembers: false,
      canManageSettings: false,
      canViewAllProjects: false,
      canViewAllData: false,
      role: 'viewer',
    };
  }

  // ================= METADATA =================

  async getOrganizationMetadata(orgId: string): Promise<any> {
    try {
      // Try cache first
      const cached = await cacheService.getOrganizationMetadata(orgId);
      if (cached) {
        return cached;
      }

      // Calculate metadata
      const [projectCount, userCount, documentCount, conversationCount] = await Promise.all([
        ProjectModel.countDocuments({ orgId: new Types.ObjectId(orgId) }),
        UserModel.countDocuments({ organizations: orgId }),
        // These would come from respective models
        Promise.resolve(0), // DocumentModel.countDocuments({ orgId })
        Promise.resolve(0), // ConversationModel.countDocuments({ orgId })
      ]);

      const metadata = {
        projectCount,
        userCount,
        documentCount,
        conversationCount,
        lastUpdated: new Date(),
      };

      // Cache for future use
      await cacheService.setOrganizationMetadata(orgId, metadata);

      return metadata;
    } catch (error) {
      logger.error('Error getting organization metadata:', error);
      throw error;
    }
  }

  async getProjectMetadata(projectId: string): Promise<any> {
    try {
      // Try cache first
      const cached = await cacheService.getProjectMetadata(projectId);
      if (cached) {
        return cached;
      }

      // Get project first to get orgId
      const project = await ProjectModel.findById(projectId).lean();
      if (!project) {
        return null;
      }

      // Calculate metadata (would come from respective models in real implementation)
      const metadata = {
        memberCount: project.members?.length || 0,
        adminCount: project.admins?.length || 0,
        documentCount: 0, // Would come from DocumentModel.countDocuments({ projectId })
        conversationCount: 0, // Would come from ConversationModel.countDocuments({ projectId })
        lastActivity: project.updatedAt,
      };

      // Cache for future use
      await cacheService.setProjectMetadata(projectId, metadata);

      return metadata;
    } catch (error) {
      logger.error('Error getting project metadata:', error);
      throw error;
    }
  }

  // ================= CACHE MANAGEMENT =================

  async warmupUserCache(userId: string, orgId: string): Promise<void> {
    try {
      logger.info(`Warming up cache for user ${userId}`);

      // Fetch and cache user data in parallel
      await Promise.all([
        this.getUserOrganizations(userId),
        this.getUserProjects(userId, orgId),
        this.getUserPermissions(userId, orgId),
      ]);

      logger.info(`Cache warmed up for user ${userId}`);
    } catch (error) {
      logger.error('Error warming up user cache:', error);
    }
  }

  async invalidateUserData(userId: string): Promise<void> {
    await cacheService.invalidateUserCache(userId);
  }

  async invalidateOrganizationData(orgId: string): Promise<void> {
    await cacheService.invalidateOrganization(orgId);
  }

  async invalidateProjectData(projectId: string): Promise<void> {
    await cacheService.invalidateProject(projectId);
  }

  async getCacheStatistics(): Promise<any> {
    return cacheService.getCacheStats();
  }

  async clearAllCache(): Promise<void> {
    await cacheService.clearAllCache();
  }
}

// Export singleton instance
export const cachedDataService = CachedDataService.getInstance();