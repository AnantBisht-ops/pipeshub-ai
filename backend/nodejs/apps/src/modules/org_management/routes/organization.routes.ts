import express from 'express';
import { Container } from 'inversify';
import { OrganizationController } from '../controller/organization.controller';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { Logger } from '../../../libs/services/logger.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';

const router = express.Router();

// Initialize container and dependencies
const container = new Container();
container.bind('Logger').to(Logger).inSingletonScope();
container.bind('AuthTokenService').to(AuthTokenService).inSingletonScope();
container.bind(AuthMiddleware).toSelf().inSingletonScope();
container.bind(OrganizationController).toSelf().inSingletonScope();

const authMiddleware = container.get(AuthMiddleware);

// Get controller instance from DI container
const getController = () => {
  try {
    return container.get<OrganizationController>(OrganizationController);
  } catch (error) {
    // If not in container, create new instance
    return new OrganizationController();
  }
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