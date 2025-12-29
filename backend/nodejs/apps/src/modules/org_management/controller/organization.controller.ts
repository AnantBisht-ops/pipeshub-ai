import { Response, NextFunction } from 'express';
import { injectable } from 'inversify';
import mongoose from 'mongoose';
import { Org } from '../../user_management/schema/org.schema';
import { Users } from '../../user_management/schema/users.schema';
import { UserGroups } from '../../user_management/schema/userGroup.schema';
import { Project } from '../../project_management/schema/project.schema';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../../libs/errors/http.errors';
import { generateUniqueSlug } from '../../user_management/controller/counters.controller';
import { IMultiTenantRequest } from '../../../libs/types/multi-tenancy.types';
import jwt from 'jsonwebtoken';

@injectable()
export class OrganizationController {

  /**
   * Generate JWT tokens with organization context
   */
  private generateTokens(user: any, org: any) {
    const payload = {
      userId: user._id,
      email: user.email,
      orgId: org._id,
      orgSlug: org.slug
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET || 'refresh_secret',
      { expiresIn: '30d' }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Get all organizations for a user
   */
  async getUserOrganizations(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId || (req as any).user?._id;

      if (!userId) {
        throw new BadRequestError('User ID not found');
      }

      // Find user and populate organizations
      const user = await Users.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Find all orgs where user is a member (through email or organizations array)
      const organizations = await Org.find({
        $or: [
          { _id: { $in: user.organizations || [] } },
          { contactEmail: user.email }
        ],
        isDeleted: false
      }).select('_id slug registeredName shortName accountType metadata subscription domain contactEmail');

      // Get user role in each org
      const orgsWithRoles = await Promise.all(
        organizations.map(async (org) => {
          // Check if user is admin
          const adminGroup = await UserGroups.findOne({
            orgId: org._id,
            users: userId,
            type: 'admin'
          });

          // Check if user is the org creator
          const isCreator = org.contactEmail === user.email;

          return {
            organization: org.toObject(),
            role: adminGroup || isCreator ? 'admin' : 'member',
            memberCount: org.metadata?.userCount || 1,
            isCreator,
            joinedAt: new Date()
          };
        })
      );

      // Get current org from JWT or use first org
      const currentOrgId = req.org?.orgId || orgsWithRoles[0]?.organization?._id;

      // Debug logging
      console.log('[DEBUG] getUserOrganizations response:', JSON.stringify({
        organizationsCount: orgsWithRoles.length,
        firstOrg: orgsWithRoles[0],
        currentOrgId
      }, null, 2));

      res.status(200).json({
        organizations: orgsWithRoles,
        currentOrgId: currentOrgId,
        total: orgsWithRoles.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Switch to a different organization
   */
  async switchOrganization(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { orgId } = req.params;
      const userId = req.user?.userId || (req as any).user?._id;

      if (!userId) {
        throw new BadRequestError('User ID not found');
      }

      // Verify user has access to this org
      const org = await Org.findById(orgId);
      if (!org) {
        throw new NotFoundError('Organization not found');
      }

      const user = await Users.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if user has access (is in organizations array or is the contact email)
      const hasAccess =
        (user.organizations && user.organizations.some((o: any) => o.toString() === orgId)) ||
        org.contactEmail === user.email;

      if (!hasAccess) {
        // Check if user is in any user group for this org
        const userGroup = await UserGroups.findOne({
          orgId: orgId,
          users: userId
        });

        if (!userGroup) {
          throw new ForbiddenError('User does not have access to this organization');
        }
      }

      // Update user's last accessed org
      if (user.lastAccessedOrgId !== org._id) {
        user.lastAccessedOrgId = org._id as any;
        await user.save();
      }

      // Generate new JWT with new orgId
      const tokens = this.generateTokens(user, org);

      res.status(200).json({
        ...tokens,
        organization: {
          _id: org._id,
          slug: org.slug,
          name: org.registeredName,
          shortName: org.shortName,
          accountType: org.accountType
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new organization
   */
  async createOrganization(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { registeredName, shortName, accountType, domain, contactEmail } = req.body;
      const userId = req.user?.userId || (req as any).user?._id;

      if (!userId) {
        throw new BadRequestError('User ID not found');
      }

      const user = await Users.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check user's organization limit
      const userOrgsCount = await Org.countDocuments({
        $or: [
          { _id: { $in: user.organizations || [] } },
          { contactEmail: user.email }
        ],
        isDeleted: false
      });

      if (userOrgsCount >= 10) {
        throw new BadRequestError('User has reached maximum organization limit (10)');
      }

      // Generate unique slug
      const slug = await generateUniqueSlug('Org');

      // Create organization
      const org = new Org({
        slug,
        registeredName,
        shortName,
        accountType: accountType || 'individual',
        domain: domain || user.email.split('@')[1],
        contactEmail: contactEmail || user.email,
        onBoardingStatus: 'notConfigured',
        settings: {
          maxProjects: accountType === 'business' ? 100 : 10,
          maxUsers: accountType === 'business' ? 500 : 50,
          features: accountType === 'business'
            ? ['unlimited_projects', 'advanced_analytics', 'custom_branding', 'priority_support']
            : ['basic_features', 'standard_support']
        },
        metadata: {
          projectCount: 1, // Will create default project
          userCount: 1,
          storageUsed: 0
        },
        subscription: {
          plan: accountType === 'business' ? 'pro' : 'free'
        }
      });

      await org.save({ session });

      // Add org to user's organizations
      if (!user.organizations) {
        user.organizations = [];
      }
      user.organizations.push(org._id as any);
      if (!user.defaultOrgId) {
        user.defaultOrgId = org._id as any;
      }
      user.lastAccessedOrgId = org._id as any;
      await user.save({ session });

      // Create admin user group
      const adminGroup = new UserGroups({
        orgId: org._id,
        groupName: 'Administrators',
        type: 'admin',
        users: [userId],
        createdByUserId: userId
      });

      await adminGroup.save({ session });

      // Create default project
      const defaultProject = new Project({
        slug: 'general',
        orgId: org._id,
        name: 'General',
        description: 'Default project for general use',
        createdBy: userId,
        visibility: 'private',
        status: 'active',
        type: 'standard',
        settings: {
          allowGuestAccess: false,
          requireApproval: false,
          defaultUserRole: 'viewer',
          features: ['documents', 'conversations'],
          integrations: []
        },
        metrics: {
          documentCount: 0,
          conversationCount: 0,
          memberCount: 1,
          storageUsed: 0,
          lastActivityAt: new Date()
        },
        members: [{
          userId: userId,
          role: 'owner',
          joinedAt: new Date()
        }]
      });

      await defaultProject.save({ session });

      await session.commitTransaction();

      res.status(201).json({
        organization: {
          _id: org._id,
          slug: org.slug,
          registeredName: org.registeredName,
          shortName: org.shortName,
          accountType: org.accountType,
          domain: org.domain,
          settings: org.settings,
          subscription: org.subscription
        },
        defaultProject: {
          _id: defaultProject._id,
          slug: defaultProject.slug,
          name: defaultProject.name,
          description: defaultProject.description
        }
      });
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  }

  /**
   * Get organization details
   */
  async getOrganizationDetails(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { orgId } = req.params;
      const userId = req.user?.userId || (req as any).user?._id;

      const org = await Org.findById(orgId);
      if (!org) {
        throw new NotFoundError('Organization not found');
      }

      // Get user's role
      const adminGroup = await UserGroups.findOne({
        orgId: org._id,
        users: userId,
        type: 'admin'
      });

      const user = await Users.findById(userId);
      const isCreator = org.contactEmail === user?.email;

      // Get projects count
      const projectCount = await Project.countDocuments({
        orgId: org._id,
        status: { $ne: 'deleted' }
      });

      // Get member count
      const memberCount = await UserGroups.distinct('users', {
        orgId: org._id
      });

      res.status(200).json({
        organization: {
          ...org.toObject(),
          role: adminGroup || isCreator ? 'admin' : 'member',
          projectCount,
          memberCount: memberCount.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update organization details
   */
  async updateOrganization(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { orgId } = req.params;
      const updates = req.body;

      // Don't allow updating certain fields
      delete updates._id;
      delete updates.slug;
      delete updates.createdAt;
      delete updates.subscription;

      const org = await Org.findByIdAndUpdate(
        orgId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!org) {
        throw new NotFoundError('Organization not found');
      }

      res.status(200).json({
        organization: org
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete organization (soft delete)
   */
  async deleteOrganization(
    req: IMultiTenantRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { orgId } = req.params;
      const userId = req.user?.userId || (req as any).user?._id;

      const org = await Org.findById(orgId);
      if (!org) {
        throw new NotFoundError('Organization not found');
      }

      // Only org creator can delete
      const user = await Users.findById(userId);
      if (org.contactEmail !== user?.email) {
        throw new ForbiddenError('Only organization creator can delete the organization');
      }

      // Soft delete
      org.isDeleted = true;
      org.deletedByUser = userId;
      await org.save();

      // Remove org from user's organizations
      if (user.organizations) {
        user.organizations = user.organizations.filter(
          (o: any) => o.toString() !== orgId
        );
        await user.save();
      }

      res.status(200).json({
        message: 'Organization deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}