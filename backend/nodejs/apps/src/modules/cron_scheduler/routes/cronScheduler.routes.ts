/**
 * Simplified Cron Scheduler Routes for Testing
 * Basic routes without complex validation
 */

import { Router, Request, Response } from 'express';
import { Container } from 'inversify';
import { CronSchedulerController } from '../controllers/cronScheduler.controller';

export function createCronSchedulerRoutes(container: Container): Router {
  const router = Router();
  const controller = container.get<CronSchedulerController>('CronSchedulerController');

  // Health check
  router.get('/health', async (req: Request, res: Response) => {
    await controller.healthCheck(req, res);
  });

  // Schedule a new job
  router.post('/schedule', async (req: Request, res: Response) => {
    await controller.scheduleJob(req, res);
  });

  // List all jobs
  router.get('/jobs', async (req: Request, res: Response) => {
    await controller.listJobs(req, res);
  });

  // Get job details
  router.get('/jobs/:id', async (req: Request, res: Response) => {
    await controller.getJob(req, res);
  });

  // Update job
  router.patch('/jobs/:id', async (req: Request, res: Response) => {
    await controller.updateJob(req, res);
  });

  // Delete job
  router.delete('/jobs/:id', async (req: Request, res: Response) => {
    await controller.deleteJob(req, res);
  });

  // Pause job
  router.patch('/jobs/:id/pause', async (req: Request, res: Response) => {
    await controller.pauseJob(req, res);
  });

  // Resume job
  router.patch('/jobs/:id/resume', async (req: Request, res: Response) => {
    await controller.resumeJob(req, res);
  });

  // Get job execution history
  router.get('/jobs/:id/history', async (req: Request, res: Response) => {
    await controller.getJobHistory(req, res);
  });

  return router;
}