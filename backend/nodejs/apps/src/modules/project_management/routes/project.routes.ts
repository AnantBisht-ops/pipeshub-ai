import express, { Response } from 'express';
import { Container } from 'inversify';
import { ProjectController } from '../controller/project.controller';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { Logger } from '../../../libs/services/logger.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { IMultiTenantRequest } from '../../../libs/types/multi-tenancy.types';

const router = express.Router();

// Initialize container and dependencies
const container = new Container();
const loggerInstance = new Logger({ service: 'ProjectService' });
container.bind('Logger').toConstantValue(loggerInstance);
container.bind('AuthTokenService').to(AuthTokenService).inSingletonScope();
container.bind(AuthMiddleware).toSelf().inSingletonScope();
container.bind(ProjectController).toSelf().inSingletonScope();

const authMiddleware = container.get(AuthMiddleware);
const controller = container.get(ProjectController);

// ============= Project CRUD Routes =============

/**
 * @route POST /api/v1/projects
 * @desc Create a new project
 * @access Private - Requires organization context
 */
router.post('/',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.verifyOrgAccess.bind(authMiddleware),
  controller.createProject.bind(controller)
);

/**
 * @route GET /api/v1/projects
 * @desc Get all projects for the current user in the current organization
 * @access Private - Requires organization context
 * @query includeArchived - Include archived projects (default: false)
 * @query includePublic - Include public/organization-wide projects (default: false)
 */
router.get('/',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.verifyOrgAccess.bind(authMiddleware),
  controller.getProjects.bind(controller)
);

/**
 * @route GET /api/v1/projects/:projectId
 * @desc Get project details by ID
 * @access Private - Requires project membership or public access
 */
router.get('/:projectId',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.verifyProjectAccess.bind(authMiddleware),
  controller.getProjectDetails.bind(controller)
);

/**
 * @route PATCH /api/v1/projects/:projectId
 * @desc Update project details
 * @access Private - Requires project admin/owner role
 */
router.patch('/:projectId',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.verifyProjectAccess.bind(authMiddleware),
  authMiddleware.requireProjectAdmin.bind(authMiddleware),
  controller.updateProject.bind(controller)
);

/**
 * @route PUT /api/v1/projects/:projectId/archive
 * @desc Archive or unarchive a project
 * @access Private - Requires project admin/owner role
 */
router.put('/:projectId/archive',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.verifyProjectAccess.bind(authMiddleware),
  authMiddleware.requireProjectAdmin.bind(authMiddleware),
  controller.archiveProject.bind(controller)
);

/**
 * @route DELETE /api/v1/projects/:projectId
 * @desc Delete a project (soft delete)
 * @access Private - Requires project owner role
 */
router.delete('/:projectId',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.verifyProjectAccess.bind(authMiddleware),
  controller.deleteProject.bind(controller)
);

// ============= Project Member Management Routes =============

/**
 * @route POST /api/v1/projects/:projectId/members
 * @desc Add members to a project
 * @access Private - Requires project admin/owner role
 * @body userIds - Array of user IDs to add
 * @body role - Role to assign (viewer, editor, admin)
 */
router.post('/:projectId/members',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.verifyProjectAccess.bind(authMiddleware),
  authMiddleware.requireProjectAdmin.bind(authMiddleware),
  controller.addProjectMembers.bind(controller)
);

/**
 * @route PATCH /api/v1/projects/:projectId/members/:userId
 * @desc Update member role in a project
 * @access Private - Requires project admin/owner role
 * @body role - New role (viewer, editor, admin)
 */
router.patch('/:projectId/members/:userId',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.verifyProjectAccess.bind(authMiddleware),
  authMiddleware.requireProjectAdmin.bind(authMiddleware),
  controller.updateProjectMemberRole.bind(controller)
);

/**
 * @route DELETE /api/v1/projects/:projectId/members/:userId
 * @desc Remove a member from a project
 * @access Private - Requires project admin/owner role OR self-removal
 */
router.delete('/:projectId/members/:userId',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.verifyProjectAccess.bind(authMiddleware),
  controller.removeProjectMember.bind(controller)
);

/**
 * @route POST /api/v1/projects/:projectId/transfer-ownership
 * @desc Transfer project ownership to another member
 * @access Private - Requires project owner role
 * @body newOwnerId - ID of the new owner
 */
router.post('/:projectId/transfer-ownership',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.verifyProjectAccess.bind(authMiddleware),
  controller.transferProjectOwnership.bind(controller)
);

// ============= Project Context Routes (for switching) =============

/**
 * @route POST /api/v1/projects/:projectId/switch
 * @desc Switch to a specific project context
 * @access Private - Requires project membership
 */
router.post('/:projectId/switch',
  authMiddleware.authenticate.bind(authMiddleware),
  authMiddleware.verifyProjectAccess.bind(authMiddleware),
  async (req: IMultiTenantRequest, res: Response): Promise<void> => {
    // The verifyProjectAccess middleware already sets the project context
    // Return the project context to the client
    res.json({
      success: true,
      message: 'Switched to project successfully',
      project: req.project,
      orgId: req.org?.orgId
    });
  }
);

export default router;