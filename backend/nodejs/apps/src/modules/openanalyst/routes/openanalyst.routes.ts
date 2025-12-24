/**
 * OpenAnalyst Routes
 *
 * API routes for OpenAnalyst desktop extension.
 * All routes except /health require JWT authentication.
 */

import { Router, Response, NextFunction } from 'express';
import { Container } from 'inversify';
import { OpenAnalystController } from '../controller/openanalyst.controller';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { AuthenticatedUserRequest } from '../../../libs/middlewares/types';

export function createOpenAnalystRouter(container: Container): Router {
  const router = Router();
  const controller = container.get<OpenAnalystController>('OpenAnalystController');
  const authMiddleware = container.get<AuthMiddleware>('AuthMiddleware');

  // ============ PUBLIC ENDPOINTS ============

  /**
   * Health check - no auth required
   * GET /api/v1/openanalyst/health
   */
  router.get('/health', (req, res) => controller.healthCheck(req, res));

  // ============ AUTHENTICATED ENDPOINTS ============
  // All routes below require JWT authentication

  // ============ PROVIDER PROFILE ROUTES ============

  /**
   * Get all provider profiles
   * GET /api/v1/openanalyst/providers
   */
  router.get(
    '/providers',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.getProviders(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Get default provider profile
   * GET /api/v1/openanalyst/providers/default
   */
  router.get(
    '/providers/default',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.getDefaultProvider(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Get a specific provider profile
   * GET /api/v1/openanalyst/providers/:id
   */
  router.get(
    '/providers/:id',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.getProvider(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Check if provider has API key configured
   * GET /api/v1/openanalyst/providers/:id/has-key
   */
  router.get(
    '/providers/:id/has-key',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.checkProviderApiKey(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Create a new provider profile
   * POST /api/v1/openanalyst/providers
   */
  router.post(
    '/providers',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.createProvider(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Update a provider profile
   * PUT /api/v1/openanalyst/providers/:id
   */
  router.put(
    '/providers/:id',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.updateProvider(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Set a provider as default
   * POST /api/v1/openanalyst/providers/:id/default
   */
  router.post(
    '/providers/:id/default',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.setDefaultProvider(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Delete a provider profile
   * DELETE /api/v1/openanalyst/providers/:id
   */
  router.delete(
    '/providers/:id',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.deleteProvider(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  // ============ EXTENSION SETTINGS ROUTES ============

  /**
   * Get extension settings
   * GET /api/v1/openanalyst/settings
   */
  router.get(
    '/settings',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.getSettings(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Update extension settings
   * PUT /api/v1/openanalyst/settings
   */
  router.put(
    '/settings',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.updateSettings(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Reset settings to defaults
   * POST /api/v1/openanalyst/settings/reset
   */
  router.post(
    '/settings/reset',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.resetSettings(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Sync settings with version check (conflict resolution)
   * PUT /api/v1/openanalyst/settings/sync
   */
  router.put(
    '/settings/sync',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.syncSettings(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  // ============ USER PROFILE ROUTE ============

  /**
   * Get user profile
   * GET /api/v1/openanalyst/user/profile
   */
  router.get(
    '/user/profile',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
      try {
        await controller.getUserProfile(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
