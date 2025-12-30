import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';

/**
 * Project Context Middleware
 *
 * Extracts projectId from various sources (query, body, params, headers)
 * and adds it to the request context for use in controllers and queries.
 *
 * This bridges the gap between frontend sending projectId as parameters
 * and backend expecting it in req.project.projectId
 */
export class ProjectContextMiddleware {
  /**
   * Extract and validate projectId from request
   */
  static extractProjectContext = (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Extract projectId from various sources (priority order)
      let projectId =
        req.query.projectId as string ||
        req.body?.projectId ||
        req.params?.projectId ||
        req.headers['x-project-id'] as string;

      // Validate if projectId is a valid MongoDB ObjectId
      if (projectId) {
        if (!Types.ObjectId.isValid(projectId)) {
          // Invalid projectId format, skip setting it
          projectId = undefined;
        }
      }

      // Add project context to request
      (req as any).project = {
        projectId: projectId || undefined,
        projectSlug: req.query.projectSlug as string || undefined,
      };

      next();
    } catch (error) {
      console.error('Error in project context middleware:', error);
      next(); // Continue without project context
    }
  };

  /**
   * Require project context - use for project-specific endpoints
   */
  static requireProjectContext = (req: Request, res: Response, next: NextFunction) => {
    const projectId = (req as any).project?.projectId;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project context is required for this operation',
        error: 'PROJECT_CONTEXT_REQUIRED'
      });
    }

    return next();
  };

  /**
   * Optional project context - allows both project-scoped and org-scoped access
   */
  static optionalProjectContext = (req: Request, _res: Response, next: NextFunction) => {
    // Just extract if available, don't require it
    ProjectContextMiddleware.extractProjectContext(req, _res, next);
  };
}

export const projectContextMiddleware = ProjectContextMiddleware.extractProjectContext;
export const requireProjectContext = ProjectContextMiddleware.requireProjectContext;
export const optionalProjectContext = ProjectContextMiddleware.optionalProjectContext;