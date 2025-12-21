import express from 'express';

import { OrganizationController } from '../controller/organization.controller';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { Logger } from '../../../libs/services/logger.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';

const router = express.Router();

// Initialize container and dependencies
// Initialize dependencies manually
const loggerInstance = new Logger({ service: 'OrganizationService' });

const authTokenService = new AuthTokenService(
  process.env.JWT_SECRET || 'secret',
  process.env.JWT_REFRESH_SECRET || 'refresh_secret'
);

const authMiddleware = new AuthMiddleware(loggerInstance, authTokenService);
const controller = new OrganizationController();

// Get controller instance from DI container
const getController = () => {
    return controller;
};

// Get user's organizations
router.get('/my-organizations',
  authMiddleware.authenticate.bind(authMiddleware),
  async (req, res, next) => {
    const controller = getController();
    await controller.getUserOrganizations(req as any, res, next);
  }
);

// Switch organization
router.post('/switch/:orgId',
  authMiddleware.authenticate.bind(authMiddleware),
  async (req, res, next) => {
    const controller = getController();
    await controller.switchOrganization(req as any, res, next);
  }
);

// Create new organization
router.post('/create',
  authMiddleware.authenticate.bind(authMiddleware),
  async (req, res, next) => {
    const controller = getController();
    await controller.createOrganization(req as any, res, next);
  }
);

// Get organization details
router.get('/:orgId',
  authMiddleware.authenticate.bind(authMiddleware),
  async (req, res, next) => {
    const controller = getController();
    await controller.getOrganizationDetails(req as any, res, next);
  }
);

// Update organization
router.patch('/:orgId',
  authMiddleware.authenticate.bind(authMiddleware),
  async (req, res, next) => {
    const controller = getController();
    await controller.updateOrganization(req as any, res, next);
  }
);

// Delete organization
router.delete('/:orgId',
  authMiddleware.authenticate.bind(authMiddleware),
  async (req, res, next) => {
    const controller = getController();
    await controller.deleteOrganization(req as any, res, next);
  }
);

export default router;