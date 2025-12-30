/**
 * MCP Integration Routes
 *
 * Defines API routes for MCP integration management
 */

import { Router } from 'express';
import {
  getConnectedIntegrations,
  connectIntegration,
  disconnectIntegration,
  getIntegrationStatus,
  checkHealth,
} from '../controllers/mcp-integration.controller';

const router = Router();

/**
 * GET /mcp/integrations
 * Get all connected integrations for the authenticated user
 */
router.get('/integrations', getConnectedIntegrations);

/**
 * POST /mcp/integrations/connect
 * Start OAuth flow to connect a new integration
 */
router.post('/integrations/connect', connectIntegration);

/**
 * DELETE /mcp/integrations/:provider
 * Disconnect an existing integration
 */
router.delete('/integrations/:provider', disconnectIntegration);

/**
 * GET /mcp/integrations/:provider/status
 * Get status of a specific integration
 */
router.get('/integrations/:provider/status', getIntegrationStatus);

/**
 * GET /mcp/health
 * Health check for MCP service connectivity
 */
router.get('/health', checkHealth);

export default router;
