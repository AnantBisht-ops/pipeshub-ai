import { Response, NextFunction } from 'express';
import { inject, injectable } from 'inversify';
import { Project } from '../schema/project.schema';
import { Org } from '../../user_management/schema/org.schema';
import { Users } from '../../user_management/schema/users.schema';
import { Conversation } from '../../enterprise_search/schema/conversation.schema';
import { DocumentModel } from '../../storage/schema/document.schema';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../../libs/errors/http.errors';
import { IMultiTenantRequest } from '../../../libs/types/multi-tenancy.types';
import { Logger } from '../../../libs/services/logger.service';

/**
 * Generate a URL-safe slug from a string
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with -
    .replace(/--+/g, '-')      // Replace multiple - with single -
    .trim();
}

@injectable()
export class ProjectController {
  constructor(
    @inject('Logger') private logger: Logger
  ) {}
  /**
   * Create a new project within an organization
   */
  async createProject(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { name, description, type = 'standard', visibility = 'private', settings } = req.body;
      const orgId = req.org?.orgId;
      const userId = req.user?.userId || (req.user as any)?._id;

      if (!orgId) {
        throw new BadRequestError('Organization context is required');
      }

      if (!name || name.trim().length === 0) {
        throw new BadRequestError('Project name is required');
      }

      // Check organization project limit
      const org = await Org.findById(orgId);
      if (!org) {
        throw new NotFoundError('Organization not found');
      }

      const maxProjects = org.settings?.maxProjects || 100;
      const projectCount = await Project.countDocuments({
        orgId,
        status: { $ne: 'deleted' }
      });

      if (projectCount >= maxProjects) {
        throw new BadRequestError(
          `Organization has reached maximum project limit (${maxProjects})`
        );
      }

      // Generate unique slug
      let slug = generateSlug(name);
      let exists = await Project.findOne({ orgId, slug, status: { $ne: 'deleted' } });
      let counter = 1;

      while (exists) {
        slug = `${generateSlug(name)}-${counter}`;
        exists = await Project.findOne({ orgId, slug, status: { $ne: 'deleted' } });
        counter++;
      }

      // Create project with initial member (creator as owner)
      const project = new Project({
        slug,
        orgId,
        name: name.trim(),
        description,
        type,
        visibility,
        status: 'active',
        members: [{
          userId,
          role: 'owner',
          joinedAt: new Date()
        }],
        settings: {
          allowGuestAccess: false,
          requireApproval: false,
          defaultUserRole: 'viewer',
          features: ['documents', 'conversations'],
          integrations: [],
          ...settings
        },
        metrics: {
          documentCount: 0,
          conversationCount: 0,
          memberCount: 1,
          storageUsed: 0,
          lastActivityAt: new Date()
        },
        createdBy: userId
      });

      await project.save();

      // Update org metadata
      if (org.metadata) {
        org.metadata.projectCount = (org.metadata.projectCount || 0) + 1;
        await org.save();
      }

      this.logger.info(`Project created: ${project.slug} in org ${orgId}`);

      res.status(201).json({
        success: true,
        project
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all projects for the current user in the current organization
   */
  async getProjects(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const orgId = req.org?.orgId;
      const userId = req.user?.userId || (req.user as any)?._id;
      const { includeArchived = false, includePublic = false } = req.query;

      if (!orgId) {
        throw new BadRequestError('Organization context is required');
      }

      // Build query
      const query: any = {
        orgId,
        status: includeArchived ? { $ne: 'deleted' } : 'active'
      };

      // Include projects where user is a member OR public projects if requested
      if (includePublic) {
        query.$or = [
          { 'members.userId': userId },
          { visibility: 'public' },
          { visibility: 'organization' }
        ];
      } else {
        query['members.userId'] = userId;
      }

      const projects = await Project.find(query)
        .populate('members.userId', 'fullName email slug')
        .populate('createdBy', 'fullName email')
        .sort('-createdAt');

      // Add additional metadata to each project
      const projectsWithMetadata = await Promise.all(
        projects.map(async (project) => {
          // Get real counts from database
          const [conversationCount, documentCount] = await Promise.all([
            Conversation.countDocuments({
              orgId,
              projectId: project._id,
              isDeleted: false
            }),
            DocumentModel.countDocuments({
              orgId,
              projectId: project._id,
              isDeleted: false
            })
          ]);

          // Find current user's role in the project
          const member = project.members.find(m =>
            m.userId.toString() === userId.toString() ||
            (m.userId as any)._id?.toString() === userId.toString()
          );

          return {
            ...project.toObject(),
            userRole: member?.role || null,
            metrics: {
              ...project.metrics,
              conversationCount,
              documentCount
            }
          };
        })
      );

      res.json({
        success: true,
        projects: projectsWithMetadata,
        total: projectsWithMetadata.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get project details by ID
   */
  async getProjectDetails(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user?.userId || (req.user as any)?._id;
      const orgId = req.org?.orgId;

      const project = await Project.findOne({
        _id: projectId,
        orgId,
        status: { $ne: 'deleted' }
      })
        .populate('members.userId', 'fullName email slug')
        .populate('createdBy', 'fullName email')
        .populate('archivedBy', 'fullName email')
        .populate('deletedBy', 'fullName email');

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      // Check if user has access
      const isMember = project.members.some(m =>
        m.userId.toString() === userId.toString() ||
        (m.userId as any)._id?.toString() === userId.toString()
      );

      const isPublic = project.visibility === 'public' ||
                      project.visibility === 'organization';

      if (!isMember && !isPublic) {
        throw new ForbiddenError('You do not have access to this project');
      }

      // Get real counts
      const [conversationCount, documentCount] = await Promise.all([
        Conversation.countDocuments({
          orgId,
          projectId: project._id,
          isDeleted: false
        }),
        DocumentModel.countDocuments({
          orgId,
          projectId: project._id,
          isDeleted: false
        })
      ]);

      // Find current user's role
      const member = project.members.find(m =>
        m.userId.toString() === userId.toString() ||
        (m.userId as any)._id?.toString() === userId.toString()
      );

      res.json({
        success: true,
        project: {
          ...project.toObject(),
          userRole: member?.role || (isPublic ? 'viewer' : null),
          metrics: {
            ...project.metrics,
            conversationCount,
            documentCount
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update project details
   */
  async updateProject(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const updates = req.body;
      const userId = req.user?.userId || (req.user as any)?._id;
      const orgId = req.org?.orgId;

      // Find project and check permissions
      const project = await Project.findOne({
        _id: projectId,
        orgId,
        status: { $ne: 'deleted' }
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      // Check if user is admin or owner
      const member = project.members.find(m =>
        m.userId.toString() === userId.toString()
      );

      if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        throw new ForbiddenError('Only project admins can update project settings');
      }

      // Fields that can be updated
      const allowedUpdates = [
        'name', 'description', 'visibility', 'type',
        'settings', 'tags', 'metadata'
      ];

      // Filter updates to only allowed fields
      const filteredUpdates: any = {};
      for (const key of allowedUpdates) {
        if (key in updates) {
          filteredUpdates[key] = updates[key];
        }
      }

      // If name is being updated, generate new slug
      if (filteredUpdates.name) {
        let slug = generateSlug(filteredUpdates.name);
        let exists = await Project.findOne({
          orgId,
          slug,
          _id: { $ne: projectId },
          status: { $ne: 'deleted' }
        });
        let counter = 1;

        while (exists) {
          slug = `${generateSlug(filteredUpdates.name)}-${counter}`;
          exists = await Project.findOne({
            orgId,
            slug,
            _id: { $ne: projectId },
            status: { $ne: 'deleted' }
          });
          counter++;
        }

        filteredUpdates.slug = slug;
      }

      // Update project
      Object.assign(project, filteredUpdates);
      
      if (!project.metrics) {
        project.metrics = {
          documentCount: 0,
          conversationCount: 0,
          memberCount: project.members?.length || 0,
          storageUsed: 0,
          lastActivityAt: new Date()
        };
      }
      
      project.metrics.lastActivityAt = new Date();
      await project.save();

      this.logger.info(`Project updated: ${project.slug} by user ${userId}`);

      res.json({
        success: true,
        project
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Archive/Unarchive project
   */
  async archiveProject(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const { archive = true } = req.body;
      const userId = req.user?.userId || (req.user as any)?._id;
      const orgId = req.org?.orgId;

      const project = await Project.findOne({
        _id: projectId,
        orgId,
        status: { $ne: 'deleted' }
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      // Check permissions
      const member = project.members.find(m =>
        m.userId.toString() === userId.toString()
      );

      if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        throw new ForbiddenError('Only project admins can archive/unarchive project');
      }

      if (archive) {
        project.status = 'archived';
        project.archivedBy = userId;
        project.archivedAt = new Date();
      } else {
        project.status = 'active';
        project.archivedBy = undefined;
        project.archivedAt = undefined;
      }

      await project.save();

      this.logger.info(`Project ${archive ? 'archived' : 'unarchived'}: ${project.slug}`);

      res.json({
        success: true,
        message: `Project ${archive ? 'archived' : 'unarchived'} successfully`,
        project
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete project (soft delete)
   */
  async deleteProject(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user?.userId || (req.user as any)?._id;
      const orgId = req.org?.orgId;

      const project = await Project.findOne({
        _id: projectId,
        orgId,
        status: { $ne: 'deleted' }
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      // Only owner can delete
      const member = project.members.find(m =>
        m.userId.toString() === userId.toString()
      );

      if (!member || member.role !== 'owner') {
        throw new ForbiddenError('Only project owner can delete project');
      }

      // Perform soft delete using the schema method
      await project.softDelete(userId);

      // Update org metadata
      const org = await Org.findById(orgId);
      if (org && org.metadata) {
        org.metadata.projectCount = Math.max(0, (org.metadata.projectCount || 1) - 1);
        await org.save();
      }

      this.logger.info(`Project deleted: ${project.slug} by user ${userId}`);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add members to project
   */
  async addProjectMembers(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const { userIds, role = 'viewer' } = req.body;
      const currentUserId = req.user?.userId || (req.user as any)?._id;
      const orgId = req.org?.orgId;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new BadRequestError('User IDs array is required');
      }

      if (!['owner', 'admin', 'editor', 'viewer'].includes(role)) {
        throw new BadRequestError('Invalid role. Must be owner, admin, editor, or viewer');
      }

      const project = await Project.findOne({
        _id: projectId,
        orgId,
        status: { $ne: 'deleted' }
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      // Check if current user is admin or owner
      const currentMember = project.members.find(m =>
        m.userId.toString() === currentUserId.toString()
      );

      if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'admin')) {
        throw new ForbiddenError('Only project admins can add members');
      }

      // Verify all users exist and belong to the organization
      const users = await Users.find({
        _id: { $in: userIds },
        orgId,
        isDeleted: false
      });

      if (users.length !== userIds.length) {
        throw new BadRequestError('Some users were not found or do not belong to this organization');
      }

      // Add members using the schema method
      for (const userId of userIds) {
        await project.addMember(userId, role as any, currentUserId);
      }

      // Update metrics
      if (!project.metrics) {
        project.metrics = {
          documentCount: 0,
          conversationCount: 0,
          memberCount: 0,
          storageUsed: 0,
          lastActivityAt: new Date()
        };
      }
      project.metrics.memberCount = project.members.length;
      project.metrics.lastActivityAt = new Date();
      await project.save();

      this.logger.info(`Added ${userIds.length} members to project ${project.slug}`);

      res.json({
        success: true,
        message: `${userIds.length} member(s) added successfully`,
        project
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update member role in project
   */
  async updateProjectMemberRole(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, userId } = req.params;
      const { role } = req.body;
      const currentUserId = req.user?.userId || (req.user as any)?._id;
      const orgId = req.org?.orgId;

      if (!['admin', 'editor', 'viewer'].includes(role)) {
        throw new BadRequestError('Invalid role. Cannot change to owner role');
      }

      const project = await Project.findOne({
        _id: projectId,
        orgId,
        status: { $ne: 'deleted' }
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      // Check if current user is admin or owner
      const currentMember = project.members.find(m =>
        m.userId.toString() === currentUserId.toString()
      );

      if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'admin')) {
        throw new ForbiddenError('Only project admins can update member roles');
      }

      // Cannot change owner's role
      const targetMember = project.members.find(m =>
        m.userId.toString() === userId
      );

      if (!targetMember) {
        throw new NotFoundError('User is not a member of this project');
      }

      if (targetMember.role === 'owner') {
        throw new BadRequestError('Cannot change owner role. Transfer ownership instead');
      }

      // Update role using schema method
      await project.updateMemberRole(userId!, role as any);

      this.logger.info(`Updated role for user ${userId} to ${role} in project ${project.slug}`);

      res.json({
        success: true,
        message: 'Member role updated successfully',
        project
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove member from project
   */
  async removeProjectMember(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, userId } = req.params;
      const currentUserId = req.user?.userId || (req.user as any)?._id;
      const orgId = req.org?.orgId;

      const project = await Project.findOne({
        _id: projectId,
        orgId,
        status: { $ne: 'deleted' }
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      // Check permissions
      const currentMember = project.members.find(m =>
        m.userId.toString() === currentUserId.toString()
      );

      const isRemovingSelf = userId === currentUserId.toString();

      if (!isRemovingSelf) {
        // Only admins can remove other members
        if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'admin')) {
          throw new ForbiddenError('Only project admins can remove members');
        }
      }

      // Cannot remove owner
      const targetMember = project.members.find(m =>
        m.userId.toString() === userId
      );

      if (!targetMember) {
        throw new NotFoundError('User is not a member of this project');
      }

      if (targetMember.role === 'owner') {
        throw new BadRequestError('Cannot remove project owner');
      }

      // Remove member using schema method
      await project.removeMember(userId!);

      // Update metrics
      if (!project.metrics) {
        project.metrics = {
          documentCount: 0,
          conversationCount: 0,
          memberCount: 0,
          storageUsed: 0,
          lastActivityAt: new Date()
        };
      }
      project.metrics.memberCount = project.members.length;
      project.metrics.lastActivityAt = new Date();
      await project.save();

      this.logger.info(`Removed user ${userId} from project ${project.slug}`);

      res.json({
        success: true,
        message: isRemovingSelf ? 'You have left the project' : 'Member removed successfully',
        project
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Transfer project ownership
   */
  async transferProjectOwnership(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const { newOwnerId } = req.body;
      const currentUserId = req.user?.userId || (req.user as any)?._id;
      const orgId = req.org?.orgId;

      if (!newOwnerId) {
        throw new BadRequestError('New owner ID is required');
      }

      const project = await Project.findOne({
        _id: projectId,
        orgId,
        status: { $ne: 'deleted' }
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      // Check if current user is owner
      const currentOwner = project.members.find(m =>
        m.userId.toString() === currentUserId.toString() && m.role === 'owner'
      );

      if (!currentOwner) {
        throw new ForbiddenError('Only project owner can transfer ownership');
      }

      // Check if new owner is a member
      const newOwner = project.members.find(m =>
        m.userId.toString() === newOwnerId
      );

      if (!newOwner) {
        throw new BadRequestError('New owner must be an existing project member');
      }

      // Transfer ownership
      currentOwner.role = 'admin';
      newOwner.role = 'owner';
      project.createdBy = newOwnerId;

      await project.save();

      this.logger.info(`Ownership transferred from ${currentUserId} to ${newOwnerId} for project ${project.slug}`);

      res.json({
        success: true,
        message: 'Project ownership transferred successfully',
        project
      });
    } catch (error) {
      next(error);
    }
  }
}