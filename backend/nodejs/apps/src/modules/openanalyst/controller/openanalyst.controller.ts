/**
 * OpenAnalyst Controller
 *
 * HTTP request handlers for OpenAnalyst desktop extension API.
 * Handles AI provider profiles, extension settings, and user profile endpoints.
 */

import { injectable, inject } from 'inversify';
import { Request, Response, NextFunction } from 'express';
import { OpenAnalystService } from '../services/openanalyst.service';
import { AuthenticatedUserRequest } from '../../../libs/middlewares/types';
import {
  BadRequestError,
  UnauthorizedError,
} from '../../../libs/errors/http.errors';
import { AIProvider } from '../schema/aiProviderProfile.schema';

@injectable()
export class OpenAnalystController {
  constructor(
    @inject('OpenAnalystService') private openAnalystService: OpenAnalystService,
  ) {}

  // ============ HEALTH CHECK ============

  /**
   * GET /api/v1/openanalyst/health
   * Public health check endpoint
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      service: 'PipesHub OpenAnalyst API',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  }

  // ============ PROVIDER PROFILE ENDPOINTS ============

  /**
   * GET /api/v1/openanalyst/providers
   * Get all provider profiles for authenticated user
   */
  async getProviders(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;

      if (!userId || !orgId) {
        throw new UnauthorizedError('User context required');
      }

      const profiles = await this.openAnalystService.getProviderProfiles(
        userId,
        orgId,
      );

      res.status(200).json({
        success: true,
        data: profiles,
        count: profiles.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/openanalyst/providers/:id
   * Get a specific provider profile
   */
  async getProvider(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const profileId = req.params.id;

      if (!userId) {
        throw new UnauthorizedError('User context required');
      }

      if (!profileId) {
        throw new BadRequestError('Profile ID is required');
      }

      const profile = await this.openAnalystService.getProviderProfile(
        profileId,
        userId,
      );

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/openanalyst/providers/default
   * Get the default provider profile
   */
  async getDefaultProvider(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;

      if (!userId || !orgId) {
        throw new UnauthorizedError('User context required');
      }

      const profile = await this.openAnalystService.getDefaultProviderProfile(
        userId,
        orgId,
      );

      res.status(200).json({
        success: true,
        data: profile,
        hasDefault: !!profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/openanalyst/providers
   * Create a new provider profile
   */
  async createProvider(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;
      const { name, provider, apiKey, settings, isDefault } = req.body;

      if (!userId || !orgId) {
        throw new UnauthorizedError('User context required');
      }

      if (!name) {
        throw new BadRequestError('Name is required');
      }

      if (!provider) {
        throw new BadRequestError('Provider is required');
      }

      if (!Object.values(AIProvider).includes(provider)) {
        throw new BadRequestError(
          `Invalid provider: ${provider}. Valid providers: ${Object.values(AIProvider).join(', ')}`,
        );
      }

      const profile = await this.openAnalystService.createProviderProfile(
        userId,
        orgId,
        { name, provider, apiKey, settings, isDefault },
      );

      res.status(201).json({
        success: true,
        data: profile,
        message: 'Provider profile created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/openanalyst/providers/:id
   * Update a provider profile
   */
  async updateProvider(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const profileId = req.params.id;
      const { name, apiKey, settings, isActive, isDefault } = req.body;

      if (!userId) {
        throw new UnauthorizedError('User context required');
      }

      if (!profileId) {
        throw new BadRequestError('Profile ID is required');
      }

      const profile = await this.openAnalystService.updateProviderProfile(
        profileId,
        userId,
        { name, apiKey, settings, isActive, isDefault },
      );

      res.status(200).json({
        success: true,
        data: profile,
        message: 'Provider profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/openanalyst/providers/:id
   * Delete a provider profile
   */
  async deleteProvider(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const profileId = req.params.id;

      if (!userId) {
        throw new UnauthorizedError('User context required');
      }

      if (!profileId) {
        throw new BadRequestError('Profile ID is required');
      }

      await this.openAnalystService.deleteProviderProfile(profileId, userId);

      res.status(200).json({
        success: true,
        message: 'Provider profile deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/openanalyst/providers/:id/default
   * Set a provider profile as default
   */
  async setDefaultProvider(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;
      const profileId = req.params.id;

      if (!userId || !orgId) {
        throw new UnauthorizedError('User context required');
      }

      if (!profileId) {
        throw new BadRequestError('Profile ID is required');
      }

      const profile = await this.openAnalystService.setDefaultProviderProfile(
        profileId,
        userId,
        orgId,
      );

      res.status(200).json({
        success: true,
        data: profile,
        message: 'Default provider set successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/openanalyst/providers/:id/has-key
   * Check if a provider has an API key configured
   */
  async checkProviderApiKey(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const profileId = req.params.id;

      if (!userId) {
        throw new UnauthorizedError('User context required');
      }

      if (!profileId) {
        throw new BadRequestError('Profile ID is required');
      }

      const hasKey = await this.openAnalystService.hasApiKey(profileId, userId);

      res.status(200).json({
        success: true,
        hasApiKey: hasKey,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============ EXTENSION SETTINGS ENDPOINTS ============

  /**
   * GET /api/v1/openanalyst/settings
   * Get extension settings for authenticated user
   */
  async getSettings(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;

      if (!userId || !orgId) {
        throw new UnauthorizedError('User context required');
      }

      const settings = await this.openAnalystService.getExtensionSettings(
        userId,
        orgId,
      );

      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/openanalyst/settings
   * Update extension settings
   */
  async updateSettings(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;
      const { general, editor, chat, customSettings } = req.body;

      if (!userId || !orgId) {
        throw new UnauthorizedError('User context required');
      }

      const settings = await this.openAnalystService.updateExtensionSettings(
        userId,
        orgId,
        { general, editor, chat, customSettings },
      );

      res.status(200).json({
        success: true,
        data: settings,
        message: 'Settings updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/openanalyst/settings/reset
   * Reset extension settings to defaults
   */
  async resetSettings(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;

      if (!userId || !orgId) {
        throw new UnauthorizedError('User context required');
      }

      const settings = await this.openAnalystService.resetExtensionSettings(
        userId,
        orgId,
      );

      res.status(200).json({
        success: true,
        data: settings,
        message: 'Settings reset to defaults',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/openanalyst/settings/sync
   * Conditionally update settings with version check (for sync conflict resolution)
   */
  async syncSettings(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;
      const { version, general, editor, chat, customSettings } = req.body;

      if (!userId || !orgId) {
        throw new UnauthorizedError('User context required');
      }

      if (version === undefined || typeof version !== 'number') {
        throw new BadRequestError('Version number is required for sync');
      }

      const result = await this.openAnalystService.updateSettingsIfVersionMatches(
        userId,
        orgId,
        version,
        { general, editor, chat, customSettings },
      );

      if (!result.updated) {
        res.status(409).json({
          success: false,
          error: 'Version conflict - settings have been modified',
          currentVersion: result.settings.version,
          data: result.settings,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.settings,
        message: 'Settings synced successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============ USER PROFILE ENDPOINT ============

  /**
   * GET /api/v1/openanalyst/user/profile
   * Get current user profile for desktop app
   */
  async getUserProfile(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = req.user;

      if (!user) {
        throw new UnauthorizedError('User context required');
      }

      res.status(200).json({
        success: true,
        data: {
          userId: user.userId,
          email: user.email,
          fullName: user.fullName || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          orgId: user.orgId,
          accountType: user.accountType || 'individual',
          authSource: user.authSource || 'web',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
