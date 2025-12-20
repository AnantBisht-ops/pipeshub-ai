// auth.middleware.ts
import { Response, NextFunction, Request, RequestHandler } from 'express';
import { UnauthorizedError, ForbiddenError, BadRequestError } from '../errors/http.errors';
import { Logger } from '../services/logger.service';
import { AuthenticatedServiceRequest, AuthenticatedUserRequest } from './types';
import { AuthTokenService } from '../services/authtoken.service';
import { inject, injectable } from 'inversify';
import { Org } from '../../modules/user_management/schema/org.schema';
import { Users } from '../../modules/user_management/schema/users.schema';
import { Project } from '../../modules/project_management/schema/project.schema';
import { IMultiTenantRequest } from '../types/multi-tenancy.types';

@injectable()
export class AuthMiddleware {
  constructor(
    @inject('Logger') private logger: Logger,
    @inject('AuthTokenService') private tokenService: AuthTokenService,
  ) {
    this.authenticate = this.authenticate.bind(this);
  }

  async authenticate(
    req: AuthenticatedUserRequest,
    _res: Response,
    next: NextFunction,
  ) {
    try {
      const token = this.extractToken(req);
      if (!token) {
        throw new UnauthorizedError('No token provided');
      }

      const decoded = await this.tokenService.verifyToken(token);
      req.user = decoded;

      this.logger.debug('User authenticated', decoded);
      next();
    } catch (error) {
      next(error);
    }
  }

  scopedTokenValidator = (scope: string): RequestHandler => {
    return async (
      req: AuthenticatedServiceRequest,
      _res: Response,
      next: NextFunction,
    ) => {
      try {
        const token = this.extractToken(req);

        if (!token) {
          throw new UnauthorizedError('No token provided');
        }

        const decoded = await this.tokenService.verifyScopedToken(token, scope);
        req.tokenPayload = decoded;

        this.logger.debug('User authenticated', decoded);
        next();
      } catch (error) {
        next(error);
      }
    };
  };

  extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const [bearer, token] = authHeader.split(' ');
    return bearer === 'Bearer' && token ? token : null;
  }

  /**
   * Verify user has access to the specified organization
   */
  async verifyOrgAccess(
    req: IMultiTenantRequest,
    _res: Response,
    next: NextFunction
  ) {
    try {
      const orgId = req.params.orgId || req.body.orgId || req.query.orgId;
      const userId = req.user?.userId || (req.user as any)?._id;

      if (!orgId) {
        // If no orgId specified, try to get from JWT
        const decodedToken = req.user as any;
        if (decodedToken?.orgId) {
          req.org = {
            orgId: decodedToken.orgId,
            orgSlug: decodedToken.orgSlug || '',
            subscription: {
              plan: 'free',
              features: []
            }
          };
          return next();
        }
        throw new BadRequestError('Organization ID is required');
      }

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      // Check if user has access to this org
      const user = await Users.findById(userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Check if user is in org's members or is the contact
      const org = await Org.findById(orgId);
      if (!org) {
        throw new BadRequestError('Organization not found');
      }

      const hasAccess =
        (user.organizations && user.organizations.some((o: any) => o.toString() === orgId)) ||
        org.contactEmail === user.email;

      if (!hasAccess) {
        throw new ForbiddenError('User does not have access to this organization');
      }

      // Add org context to request
      req.org = {
        orgId: org._id.toString(),
        orgSlug: org.slug,
        subscription: {
          plan: org.subscription?.plan || 'free',
          features: org.settings?.features || []
        }
      };

      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify user has access to the specified project
   */
  async verifyProjectAccess(
    req: IMultiTenantRequest,
    _res: Response,
    next: NextFunction
  ) {
    try {
      const projectId = req.params.projectId || req.body.projectId || req.query.projectId;
      const userId = req.user?.userId || (req.user as any)?._id;

      if (!projectId) {
        // No project specified, continue without project context
        return next();
      }

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      // Find project and check access
      const project = await Project.findOne({
        _id: projectId,
        status: { $ne: 'deleted' }
      });

      if (!project) {
        throw new BadRequestError('Project not found');
      }

      // Check if user is a member of the project
      const isMember = project.members.some((member: any) =>
        member.userId.toString() === userId.toString()
      );

      if (!isMember) {
        throw new ForbiddenError('User does not have access to this project');
      }

      // Get user's role in the project
      const member = project.members.find((m: any) =>
        m.userId.toString() === userId.toString()
      );

      // Add project context to request
      req.project = {
        projectId: project._id.toString(),
        projectSlug: project.slug,
        permissions: member?.role === 'owner' || member?.role === 'admin'
          ? ['admin', 'write', 'read']
          : member?.role === 'editor'
            ? ['write', 'read']
            : ['read']
      };

      // Ensure org context matches
      if (!req.org || req.org.orgId !== project.orgId.toString()) {
        req.org = {
          orgId: project.orgId.toString(),
          orgSlug: '',
          subscription: {
            plan: 'free',
            features: []
          }
        };
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Require admin role in organization
   */
  async requireOrgAdmin(
    req: IMultiTenantRequest,
    _res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.userId || (req.user as any)?._id;
      const orgId = req.org?.orgId;

      if (!userId || !orgId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user is org admin
      const { UserGroups } = await import('../../modules/user_management/schema/userGroup.schema');
      const adminGroup = await UserGroups.findOne({
        orgId: orgId,
        users: userId,
        type: 'admin'
      });

      if (!adminGroup) {
        // Check if user is org creator
        const org = await Org.findById(orgId);
        const user = await Users.findById(userId);
        if (org?.contactEmail !== user?.email) {
          throw new ForbiddenError('Admin access required');
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Require admin or owner role in project
   */
  async requireProjectAdmin(
    req: IMultiTenantRequest,
    _res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.userId || (req.user as any)?._id;
      const projectId = req.project?.projectId;

      if (!userId || !projectId) {
        throw new UnauthorizedError('Authentication required');
      }

      const project = await Project.findById(projectId);
      if (!project) {
        throw new BadRequestError('Project not found');
      }

      const member = project.members.find((m: any) =>
        m.userId.toString() === userId.toString()
      );

      if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        throw new ForbiddenError('Admin access required');
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}
