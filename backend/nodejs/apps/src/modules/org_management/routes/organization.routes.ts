import express from 'express';

import { OrganizationController } from '../controller/organization.controller';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { Logger } from '../../../libs/services/logger.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { AppConfig } from '../../tokens_manager/config/config';

// Factory function to create organization routes with proper config
export function createOrganizationRouter(appConfig: AppConfig) {
  const router = express.Router();

  // Initialize dependencies with config from ETCD
  const loggerInstance = new Logger({ service: 'OrganizationService' });

  const authTokenService = new AuthTokenService(
    appConfig.jwtSecret,
    appConfig.scopedJwtSecret
  );

  const authMiddleware = new AuthMiddleware(loggerInstance, authTokenService);
  const controller = new OrganizationController();

  // Get controller instance
  const getController = () => {
    return controller;
  };

  // Get user's organizations
  router.get('/my-organizations',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req, res, next) => {
      const ctrl = getController();
      await ctrl.getUserOrganizations(req as any, res, next);
    }
  );

  // Switch organization
  router.post('/switch/:orgId',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req, res, next) => {
      const ctrl = getController();
      await ctrl.switchOrganization(req as any, res, next);
    }
  );

  // Create new organization
  router.post('/create',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req, res, next) => {
      const ctrl = getController();
      await ctrl.createOrganization(req as any, res, next);
    }
  );

  // Get organization details
  router.get('/:orgId',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req, res, next) => {
      const ctrl = getController();
      await ctrl.getOrganizationDetails(req as any, res, next);
    }
  );

  // Update organization
  router.patch('/:orgId',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req, res, next) => {
      const ctrl = getController();
      await ctrl.updateOrganization(req as any, res, next);
    }
  );

  // Delete organization
  router.delete('/:orgId',
    authMiddleware.authenticate.bind(authMiddleware),
    async (req, res, next) => {
      const ctrl = getController();
      await ctrl.deleteOrganization(req as any, res, next);
    }
  );

  return router;
}
