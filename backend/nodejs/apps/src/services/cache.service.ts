/**
 * Cache Service for Multi-Tenant Data
 * Provides Redis caching for organizations, projects, and user permissions
 */

import { createClient, RedisClientType } from 'redis';
import { Organization, Project, User } from '../types';
import { logger } from '../libs/utils/logger';

export class CacheService {
  private static instance: CacheService;
  private client: RedisClientType;
  private isConnected: boolean = false;
  private readonly ttl = {
    organization: 3600,      // 1 hour
    project: 3600,          // 1 hour
    userOrgs: 7200,         // 2 hours
    userProjects: 3600,    // 1 hour
    permissions: 1800,      // 30 minutes
    projectMembers: 1800,   // 30 minutes
    orgMetadata: 600,       // 10 minutes
    projectMetadata: 600,   // 10 minutes
  };

  private constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = createClient({ url: redisUrl });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.isConnected = true;
    });
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  private getCacheKey(type: string, id: string, suffix?: string): string {
    return suffix ? `mt:${type}:${id}:${suffix}` : `mt:${type}:${id}`;
  }

  // ================= ORGANIZATION CACHE =================

  async getOrganization(orgId: string): Promise<Organization | null> {
    try {
      if (!this.isConnected) return null;

      const key = this.getCacheKey('org', orgId);
      const cached = await this.client.get(key);

      if (cached) {
        logger.debug(`Cache hit for organization ${orgId}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting organization from cache:', error);
      return null;
    }
  }

  async setOrganization(orgId: string, organization: Organization): Promise<void> {
    try {
      if (!this.isConnected) return;

      const key = this.getCacheKey('org', orgId);
      await this.client.setEx(
        key,
        this.ttl.organization,
        JSON.stringify(organization)
      );

      logger.debug(`Cached organization ${orgId}`);
    } catch (error) {
      logger.error('Error caching organization:', error);
    }
  }

  async invalidateOrganization(orgId: string): Promise<void> {
    try {
      if (!this.isConnected) return;

      // Delete organization cache
      const orgKey = this.getCacheKey('org', orgId);
      await this.client.del(orgKey);

      // Delete related metadata
      const metadataKey = this.getCacheKey('org', orgId, 'metadata');
      await this.client.del(metadataKey);

      // Delete all user org lists that might contain this org
      const pattern = 'mt:user:*:orgs';
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }

      logger.debug(`Invalidated organization cache for ${orgId}`);
    } catch (error) {
      logger.error('Error invalidating organization cache:', error);
    }
  }

  // ================= PROJECT CACHE =================

  async getProject(projectId: string): Promise<Project | null> {
    try {
      if (!this.isConnected) return null;

      const key = this.getCacheKey('project', projectId);
      const cached = await this.client.get(key);

      if (cached) {
        logger.debug(`Cache hit for project ${projectId}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting project from cache:', error);
      return null;
    }
  }

  async setProject(projectId: string, project: Project): Promise<void> {
    try {
      if (!this.isConnected) return;

      const key = this.getCacheKey('project', projectId);
      await this.client.setEx(
        key,
        this.ttl.project,
        JSON.stringify(project)
      );

      logger.debug(`Cached project ${projectId}`);
    } catch (error) {
      logger.error('Error caching project:', error);
    }
  }

  async invalidateProject(projectId: string): Promise<void> {
    try {
      if (!this.isConnected) return;

      // Delete project cache
      const projectKey = this.getCacheKey('project', projectId);
      await this.client.del(projectKey);

      // Delete related metadata
      const metadataKey = this.getCacheKey('project', projectId, 'metadata');
      await this.client.del(metadataKey);

      // Delete project members cache
      const membersKey = this.getCacheKey('project', projectId, 'members');
      await this.client.del(membersKey);

      // Delete all user project lists that might contain this project
      const pattern = 'mt:user:*:projects';
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }

      logger.debug(`Invalidated project cache for ${projectId}`);
    } catch (error) {
      logger.error('Error invalidating project cache:', error);
    }
  }

  // ================= USER CACHE =================

  async getUserOrganizations(userId: string): Promise<Organization[] | null> {
    try {
      if (!this.isConnected) return null;

      const key = this.getCacheKey('user', userId, 'orgs');
      const cached = await this.client.get(key);

      if (cached) {
        logger.debug(`Cache hit for user organizations ${userId}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting user organizations from cache:', error);
      return null;
    }
  }

  async setUserOrganizations(userId: string, organizations: Organization[]): Promise<void> {
    try {
      if (!this.isConnected) return;

      const key = this.getCacheKey('user', userId, 'orgs');
      await this.client.setEx(
        key,
        this.ttl.userOrgs,
        JSON.stringify(organizations)
      );

      logger.debug(`Cached user organizations for ${userId}`);
    } catch (error) {
      logger.error('Error caching user organizations:', error);
    }
  }

  async getUserProjects(userId: string, orgId: string): Promise<Project[] | null> {
    try {
      if (!this.isConnected) return null;

      const key = this.getCacheKey('user', userId, `projects:${orgId}`);
      const cached = await this.client.get(key);

      if (cached) {
        logger.debug(`Cache hit for user projects ${userId} in org ${orgId}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting user projects from cache:', error);
      return null;
    }
  }

  async setUserProjects(userId: string, orgId: string, projects: Project[]): Promise<void> {
    try {
      if (!this.isConnected) return;

      const key = this.getCacheKey('user', userId, `projects:${orgId}`);
      await this.client.setEx(
        key,
        this.ttl.userProjects,
        JSON.stringify(projects)
      );

      logger.debug(`Cached user projects for ${userId} in org ${orgId}`);
    } catch (error) {
      logger.error('Error caching user projects:', error);
    }
  }

  async invalidateUserCache(userId: string): Promise<void> {
    try {
      if (!this.isConnected) return;

      // Delete all user-related cache entries
      const pattern = `mt:user:${userId}:*`;
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(keys);
        logger.debug(`Invalidated ${keys.length} cache entries for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error invalidating user cache:', error);
    }
  }

  // ================= PERMISSIONS CACHE =================

  async getUserPermissions(userId: string, orgId: string, projectId?: string): Promise<any | null> {
    try {
      if (!this.isConnected) return null;

      const suffix = projectId ? `perms:${orgId}:${projectId}` : `perms:${orgId}`;
      const key = this.getCacheKey('user', userId, suffix);
      const cached = await this.client.get(key);

      if (cached) {
        logger.debug(`Cache hit for permissions ${userId}/${orgId}/${projectId}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting permissions from cache:', error);
      return null;
    }
  }

  async setUserPermissions(userId: string, orgId: string, permissions: any, projectId?: string): Promise<void> {
    try {
      if (!this.isConnected) return;

      const suffix = projectId ? `perms:${orgId}:${projectId}` : `perms:${orgId}`;
      const key = this.getCacheKey('user', userId, suffix);

      await this.client.setEx(
        key,
        this.ttl.permissions,
        JSON.stringify(permissions)
      );

      logger.debug(`Cached permissions for ${userId}/${orgId}/${projectId}`);
    } catch (error) {
      logger.error('Error caching permissions:', error);
    }
  }

  // ================= METADATA CACHE =================

  async getOrganizationMetadata(orgId: string): Promise<any | null> {
    try {
      if (!this.isConnected) return null;

      const key = this.getCacheKey('org', orgId, 'metadata');
      const cached = await this.client.get(key);

      if (cached) {
        logger.debug(`Cache hit for org metadata ${orgId}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting org metadata from cache:', error);
      return null;
    }
  }

  async setOrganizationMetadata(orgId: string, metadata: any): Promise<void> {
    try {
      if (!this.isConnected) return;

      const key = this.getCacheKey('org', orgId, 'metadata');
      await this.client.setEx(
        key,
        this.ttl.orgMetadata,
        JSON.stringify(metadata)
      );

      logger.debug(`Cached org metadata for ${orgId}`);
    } catch (error) {
      logger.error('Error caching org metadata:', error);
    }
  }

  async getProjectMetadata(projectId: string): Promise<any | null> {
    try {
      if (!this.isConnected) return null;

      const key = this.getCacheKey('project', projectId, 'metadata');
      const cached = await this.client.get(key);

      if (cached) {
        logger.debug(`Cache hit for project metadata ${projectId}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting project metadata from cache:', error);
      return null;
    }
  }

  async setProjectMetadata(projectId: string, metadata: any): Promise<void> {
    try {
      if (!this.isConnected) return;

      const key = this.getCacheKey('project', projectId, 'metadata');
      await this.client.setEx(
        key,
        this.ttl.projectMetadata,
        JSON.stringify(metadata)
      );

      logger.debug(`Cached project metadata for ${projectId}`);
    } catch (error) {
      logger.error('Error caching project metadata:', error);
    }
  }

  // ================= BULK OPERATIONS =================

  async warmupCache(userId: string, orgId: string): Promise<void> {
    try {
      logger.info(`Warming up cache for user ${userId} in org ${orgId}`);

      // This would typically fetch and cache:
      // - User's organizations
      // - User's projects in the org
      // - User's permissions
      // - Organization metadata
      // The actual implementation would call the respective services

    } catch (error) {
      logger.error('Error warming up cache:', error);
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      if (!this.isConnected) return;

      const pattern = 'mt:*';
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      logger.error('Error clearing all cache:', error);
    }
  }

  // ================= STATISTICS =================

  async getCacheStats(): Promise<any> {
    try {
      if (!this.isConnected) return null;

      const info = await this.client.info('stats');
      const dbSize = await this.client.dbSize();

      // Count different types of cached items
      const orgCount = (await this.client.keys('mt:org:*')).length;
      const projectCount = (await this.client.keys('mt:project:*')).length;
      const userCount = (await this.client.keys('mt:user:*')).length;

      return {
        connected: this.isConnected,
        totalKeys: dbSize,
        organizations: orgCount,
        projects: projectCount,
        users: userCount,
        info: info,
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();