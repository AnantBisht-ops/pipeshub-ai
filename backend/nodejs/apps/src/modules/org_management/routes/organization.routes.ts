import express from 'express';
import { OrganizationController } from '../controller/organization.controller';
import { authenticate } from '../../../libs/middlewares/auth.middleware';
import { container } from '../../../inversify.config';

const router = express.Router();

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
  authenticate,
  async (req, res, next) => {
    const controller = getController();
    await controller.getUserOrganizations(req as any, res, next);
  }
);

// Switch organization
router.post('/switch/:orgId',
  authenticate,
  async (req, res, next) => {
    const controller = getController();
    await controller.switchOrganization(req as any, res, next);
  }
);

// Create new organization
router.post('/create',
  authenticate,
  async (req, res, next) => {
    const controller = getController();
    await controller.createOrganization(req as any, res, next);
  }
);

// Get organization details
router.get('/:orgId',
  authenticate,
  async (req, res, next) => {
    const controller = getController();
    await controller.getOrganizationDetails(req as any, res, next);
  }
);

// Update organization
router.patch('/:orgId',
  authenticate,
  async (req, res, next) => {
    const controller = getController();
    await controller.updateOrganization(req as any, res, next);
  }
);

// Delete organization
router.delete('/:orgId',
  authenticate,
  async (req, res, next) => {
    const controller = getController();
    await controller.deleteOrganization(req as any, res, next);
  }
);

export default router;