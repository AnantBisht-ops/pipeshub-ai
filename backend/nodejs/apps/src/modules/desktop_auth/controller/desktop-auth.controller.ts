import { Response, NextFunction } from 'express';
import { injectable } from 'inversify';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { Logger } from '../../../libs/services/logger.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { Users } from '../../user_management/schema/users.schema';
import { Org } from '../../user_management/schema/org.schema';
import { Project } from '../../project_management/schema/project.schema';
import { UserCredentials } from '../../auth/schema/userCredentials.schema';
import { UserGroups } from '../../user_management/schema/userGroup.schema';
import { BadRequestError, UnauthorizedError } from '../../../libs/errors/http.errors';
import { passwordValidator } from '../../auth/utils/passwordValidator';
import { SALT_ROUNDS } from '../../auth/controller/userAccount.controller';
import {
  DesktopSignupRequest,
  DesktopSigninRequest,
  DesktopRefreshRequest
} from '../types/desktop-auth.types';

/**
 * Desktop Authentication Controller
 * Handles authentication for desktop code editor applications
 */
@injectable()
export class DesktopAuthController {
  private logger: Logger;
  private authTokenService: AuthTokenService;

  constructor(logger: Logger, authTokenService: AuthTokenService) {
    this.logger = logger;
    this.authTokenService = authTokenService;
  }

  /**
   * Sign up new user from desktop app
   * Creates user + organization + default project
   */
  async signup(
    req: any,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password, fullName, organizationName, accountType = 'individual' }: DesktopSignupRequest = req.body;

      // Validate required fields
      if (!email || !password || !fullName || !organizationName) {
        throw new BadRequestError('Email, password, fullName, and organizationName are required');
      }

      // Validate password strength
      if (!passwordValidator(password)) {
        throw new BadRequestError(
          'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
        );
      }

      // Check if email already exists
      const existingUser = await Users.findOne({ email });
      if (existingUser) {
        throw new BadRequestError('Email already registered');
      }

      // Generate slug for organization
      const orgSlug = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Check if org slug exists
      let finalOrgSlug = orgSlug;
      let counter = 1;
      while (await Org.findOne({ slug: finalOrgSlug })) {
        finalOrgSlug = `${orgSlug}-${counter}`;
        counter++;
      }

      // Extract domain from email
      const domain = email.split('@')[1];

      // Create organization
      const org = new Org({
        registeredName: organizationName,
        shortName: organizationName,
        slug: finalOrgSlug,
        domain,
        contactEmail: email,
        accountType,
        onBoardingStatus: 'notConfigured'
      });

      await org.save();

      // Create user
      const user = new Users({
        fullName,
        email,
        orgId: org._id,
        organizations: [org._id],
        defaultOrgId: org._id
      });

      await user.save();

      // Hash password and create credentials
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const userCredentials = new UserCredentials({
        userId: user._id,
        orgId: org._id,
        hashedPassword,
        isDeleted: false
      });

      await userCredentials.save();

      // Create admin user group
      const adminGroup = new UserGroups({
        type: 'admin',
        name: 'admin',
        orgId: org._id,
        users: [user._id]
      });

      await adminGroup.save();

      // Create default project
      const defaultProject = new Project({
        name: 'General',
        slug: 'general',
        description: 'Default project',
        orgId: org._id,
        members: [{
          userId: user._id,
          role: 'owner',
          joinedAt: new Date()
        }],
        admins: [user._id],
        createdBy: user._id
      });

      await defaultProject.save();

      // Get IDs as ObjectId for type safety
      const userId = user._id as Types.ObjectId;
      const orgId = org._id as Types.ObjectId;

      // Generate JWT tokens
      const accessToken = this.authTokenService.generateToken({
        userId: userId.toString(),
        email: user.email,
        orgId: orgId.toString(),
        orgSlug: org.slug,
        type: 'access'
      });

      const refreshToken = this.authTokenService.generateToken({
        userId: userId.toString(),
        type: 'refresh'
      });

      // Log successful signup
      this.logger.info(`Desktop signup successful for ${email}`);

      // Return response with isNewUser: true
      res.status(201).json({
        success: true,
        isNewUser: true,  // Always true for signup
        data: {
          accessToken,
          refreshToken,
          expiresIn: 3600,  // 1 hour
          user: {
            _id: userId.toString(),
            email: user.email,
            fullName: user.fullName,
            slug: user.slug
          },
          organizations: [{
            _id: orgId.toString(),
            name: org.registeredName,
            slug: org.slug,
            role: 'owner',
            accountType: org.accountType
          }],
          currentOrgId: orgId.toString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sign in existing user from desktop app
   */
  async signin(
    req: any,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password }: DesktopSigninRequest = req.body;

      // Validate required fields
      if (!email || !password) {
        throw new BadRequestError('Email and password are required');
      }

      // Find user by email
      const user = await Users.findOne({ email, isDeleted: false });
      if (!user) {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Get user credentials
      const userCredentials = await UserCredentials.findOne({
        userId: user._id,
        isDeleted: false
      });

      if (!userCredentials || !userCredentials.hashedPassword) {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, userCredentials.hashedPassword);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Get user's organizations
      const userOrgs = await Org.find({
        _id: { $in: user.organizations || [] },
        isDeleted: false
      });

      // Get user's role in each organization
      const organizationsWithRoles = await Promise.all(
        userOrgs.map(async (org) => {
          const adminGroup = await UserGroups.findOne({
            orgId: org._id,
            type: 'admin',
            users: user._id
          });

          return {
            _id: (org._id as Types.ObjectId).toString(),
            name: org.registeredName,
            slug: org.slug,
            role: adminGroup ? 'admin' : 'member',
            accountType: org.accountType
          };
        })
      );

      // Determine current org (use default or last accessed or first)
      const currentOrgId = (user.defaultOrgId || user.organizations?.[0] || userOrgs[0]?._id) as Types.ObjectId;

      // Generate JWT tokens
      const accessToken = this.authTokenService.generateToken({
        userId: (user._id as Types.ObjectId).toString(),
        email: user.email,
        orgId: currentOrgId.toString(),
        orgSlug: userOrgs[0]?.slug || '',
        type: 'access'
      });

      const refreshToken = this.authTokenService.generateToken({
        userId: (user._id as Types.ObjectId).toString(),
        type: 'refresh'
      });

      // Log successful signin
      this.logger.info(`Desktop signin successful for ${email}`);

      // Return response with isNewUser: false (user already existed)
      res.status(200).json({
        success: true,
        isNewUser: false,  // User already existed
        data: {
          accessToken,
          refreshToken,
          expiresIn: 3600,
          user: {
            _id: (user._id as Types.ObjectId).toString(),
            email: user.email,
            fullName: user.fullName,
            slug: user.slug
          },
          organizations: organizationsWithRoles,
          currentOrgId: currentOrgId.toString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    req: any,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken }: DesktopRefreshRequest = req.body;

      // Validate required field
      if (!refreshToken) {
        throw new BadRequestError('Refresh token is required');
      }

      // Verify refresh token
      const decoded = await this.authTokenService.verifyToken(refreshToken);

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedError('Invalid refresh token type');
      }

      // Get user
      const user = await Users.findById(decoded.userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Get user's default/first organization
      const currentOrgId = (user.defaultOrgId || user.organizations?.[0]) as Types.ObjectId;
      const org = await Org.findById(currentOrgId);

      // Generate new access token
      const newAccessToken = this.authTokenService.generateToken({
        userId: decoded.userId,
        email: user.email,
        orgId: currentOrgId?.toString() || '',
        orgSlug: org?.slug || '',
        type: 'access'
      });

      // Log successful refresh
      this.logger.info(`Desktop token refresh successful for user ${decoded.userId}`);

      // Return new access token
      res.status(200).json({
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: 3600
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
