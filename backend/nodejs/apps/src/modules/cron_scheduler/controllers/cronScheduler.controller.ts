/**
 * Cron Scheduler Controller
 * Provides API endpoints for the cron scheduler with proper authentication
 */

import { Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import { CronSchedulerService } from '../services/cronScheduler.service';
import { Logger } from '../../../libs/services/logger.service';
import { ICronJobRequest } from '../types/cronScheduler.types';

// Extend Request to include user from auth middleware
interface AuthenticatedRequest extends Request {
  user?: {
    userId?: string;
    _id?: string;
    id?: string;
    orgId?: string;
    email?: string;
  };
}

@injectable()
export class CronSchedulerController {
  constructor(
    @inject('CronSchedulerService') private schedulerService: CronSchedulerService,
    @inject('Logger') private logger: Logger
  ) {}

  /**
   * Get user ID from various possible fields in JWT payload
   */
  private getUserId(user: any): string | null {
    return user?.userId || user?._id || user?.id || null;
  }

  /**
   * Schedule a new job
   */
  async scheduleJob(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const jobData: ICronJobRequest = req.body;

      // Get orgId and userId from authenticated user
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const orgId = req.user.orgId;
      const userId = this.getUserId(req.user);

      if (!orgId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid authentication data'
        });
      }

      const job = await this.schedulerService.createJob(jobData, orgId, userId);

      return res.status(201).json({
        success: true,
        message: 'Job scheduled successfully',
        data: job
      });
    } catch (error: any) {
      this.logger.error('Failed to schedule job', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * List all jobs
   */
  async listJobs(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      if (!req.user || !req.user.orgId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const orgId = req.user.orgId;
      const result = await this.schedulerService.getJobs(orgId);

      return res.json(result);
    } catch (error: any) {
      this.logger.error('Failed to list jobs', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get job details
   */
  async getJob(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
      }

      if (!req.user || !req.user.orgId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const orgId = req.user.orgId;
      const job = await this.schedulerService.getJobById(id, orgId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      return res.json({
        success: true,
        data: job
      });
    } catch (error: any) {
      this.logger.error('Failed to get job', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update job
   */
  async updateJob(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
      }

      if (!req.user || !req.user.orgId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const updates = req.body;
      const orgId = req.user.orgId;

      const job = await this.schedulerService.updateJob(id, orgId, updates);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      return res.json({
        success: true,
        message: 'Job updated successfully',
        data: job
      });
    } catch (error: any) {
      this.logger.error('Failed to update job', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete job
   */
  async deleteJob(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
      }

      if (!req.user || !req.user.orgId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const orgId = req.user.orgId;

      await this.schedulerService.deleteJob(id, orgId);

      return res.json({
        success: true,
        message: 'Job deleted successfully'
      });
    } catch (error: any) {
      this.logger.error('Failed to delete job', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Pause job
   */
  async pauseJob(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
      }

      if (!req.user || !req.user.orgId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const orgId = req.user.orgId;

      const job = await this.schedulerService.pauseJob(id, orgId);

      return res.json({
        success: true,
        message: 'Job paused successfully',
        data: job
      });
    } catch (error: any) {
      this.logger.error('Failed to pause job', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Resume job
   */
  async resumeJob(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
      }

      if (!req.user || !req.user.orgId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const orgId = req.user.orgId;

      const job = await this.schedulerService.resumeJob(id, orgId);

      return res.json({
        success: true,
        message: 'Job resumed successfully',
        data: job
      });
    } catch (error: any) {
      this.logger.error('Failed to resume job', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get job execution history
   */
  async getJobHistory(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
      }

      if (!req.user || !req.user.orgId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const orgId = req.user.orgId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const history = await this.schedulerService.getJobHistory(id, orgId, page, limit);

      if (!history) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      return res.json({
        success: true,
        data: history
      });
    } catch (error: any) {
      this.logger.error('Failed to get job history', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(_req: Request, res: Response): Promise<Response> {
    try {
      return res.json({
        success: true,
        message: 'Cron scheduler is healthy',
        data: {
          status: 'healthy',
          timestamp: new Date()
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  }
}