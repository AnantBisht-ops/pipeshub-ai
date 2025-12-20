/**
 * MCP Integration Controller
 *
 * Handles HTTP requests for MCP integration management
 * Acts as a proxy between frontend and external MCP service
 */

import { Request, Response, NextFunction } from 'express';
import { mcpIntegrationService } from '../services/mcp-integration.service';
const jwt = require('jsonwebtoken');

/**
 * Extract user ID from JWT token
 * The MCP service expects user_id, not JWT authentication
 */
function extractUserIdFromToken(jwtToken: string): string {
  try {
    // Decode without verification since we just need the user ID
    // The token has already been validated by upstream middleware if needed
    const decoded = jwt.decode(jwtToken) as any;

    if (!decoded) {
      throw new Error('Failed to decode JWT token');
    }

    // Try different possible fields for user ID
    const userId = decoded.id ||
                  decoded.userId ||
                  decoded.user_id ||
                  decoded.sub ||
                  decoded.google_id ||
                  decoded.email ||
                  decoded._id;

    if (!userId) {
      console.error('[MCP Controller] JWT payload:', JSON.stringify(decoded));
      throw new Error('User ID not found in JWT token');
    }

    console.log(`[MCP Controller] Extracted user ID from JWT: ${userId}`);
    return userId;
  } catch (error: any) {
    console.error('[MCP Controller] Failed to extract user ID from JWT:', error);
    throw new Error(`Failed to extract user ID: ${error.message}`);
  }
}

/**
 * Get connected integrations for the authenticated user
 * GET /mcp/integrations
 */
export const getConnectedIntegrations = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  try {
    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'No authorization token provided',
        message: 'Please provide a valid JWT token',
      });
      return;
    }

    const jwtToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Extract user ID from JWT token
    const userId = extractUserIdFromToken(jwtToken);

    // Call MCP service with user ID
    const integrations = await mcpIntegrationService.getConnectedIntegrations(userId);

    res.status(200).json(integrations);
  } catch (error: any) {
    console.error('[MCP Controller] Error getting integrations:', error);

    // Return more specific error information
    res.status(500).json({
      error: 'Failed to get integrations',
      detail: error.message || 'An unexpected error occurred'
    });
  }
};

/**
 * Connect a new integration (start OAuth flow)
 * POST /mcp/integrations/connect
 */
export const connectIntegration = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  // Extract request body first (needed for error handling)
  const { provider, redirect_uri, force_reauth } = req.body;

  try {
    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'No authorization token provided',
        message: 'Please provide a valid JWT token',
      });
      return;
    }

    const jwtToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Extract user ID from JWT token
    const userId = extractUserIdFromToken(jwtToken);

    // Validate required fields
    if (!provider) {
      res.status(400).json({
        error: 'Missing required field: provider',
        message: 'Provider must be specified (gmail, slack, etc.)',
      });
      return;
    }

    if (!redirect_uri) {
      res.status(400).json({
        error: 'Missing required field: redirect_uri',
        message: 'Redirect URI must be specified',
      });
      return;
    }

    // Call MCP service with user ID
    const response = await mcpIntegrationService.connectIntegration(
      userId,
      provider,
      redirect_uri,
      force_reauth || false
    );

    res.status(200).json(response);
  } catch (error: any) {
    console.error('[MCP Controller] Error connecting integration:', error);

    // Return more specific error information
    if (error.message?.includes('MCP Service Error')) {
      // This is already a processed MCP error
      res.status(500).json({
        error: error.message,
        detail: 'Failed to connect to MCP service',
        provider: provider
      });
    } else {
      // Log the full error for debugging
      console.error('[MCP Controller] Full error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });

      res.status(500).json({
        error: 'Failed to connect integration',
        detail: error.message || 'An unexpected error occurred',
        provider: provider
      });
    }
  }
};

/**
 * Disconnect an existing integration
 * DELETE /mcp/integrations/:provider
 */
export const disconnectIntegration = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  try {
    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'No authorization token provided',
        message: 'Please provide a valid JWT token',
      });
      return;
    }

    const jwtToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Extract user ID from JWT token
    const userId = extractUserIdFromToken(jwtToken);

    // Extract provider from URL params
    const { provider } = req.params;

    if (!provider) {
      res.status(400).json({
        error: 'Missing required parameter: provider',
        message: 'Provider must be specified in URL',
      });
      return;
    }

    // Call MCP service with user ID
    const response = await mcpIntegrationService.disconnectIntegration(userId, provider);

    res.status(200).json(response);
  } catch (error: any) {
    console.error('[MCP Controller] Error disconnecting integration:', error);

    // Return more specific error information
    res.status(500).json({
      error: 'Failed to disconnect integration',
      detail: error.message || 'An unexpected error occurred'
    });
  }
};

/**
 * Get status of a specific integration
 * GET /mcp/integrations/:provider/status
 */
export const getIntegrationStatus = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  try {
    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'No authorization token provided',
        message: 'Please provide a valid JWT token',
      });
      return;
    }

    const jwtToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Extract user ID from JWT token
    const userId = extractUserIdFromToken(jwtToken);

    // Extract provider from URL params
    const { provider } = req.params;

    if (!provider) {
      res.status(400).json({
        error: 'Missing required parameter: provider',
        message: 'Provider must be specified in URL',
      });
      return;
    }

    // Call MCP service with user ID
    const status = await mcpIntegrationService.getIntegrationStatus(userId, provider);

    res.status(200).json(status);
  } catch (error: any) {
    console.error('[MCP Controller] Error getting integration status:', error);

    // Return more specific error information
    res.status(500).json({
      error: 'Failed to get integration status',
      detail: error.message || 'An unexpected error occurred'
    });
  }
};

/**
 * Health check endpoint
 * GET /mcp/health
 */
export const checkHealth = async (
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  try {
    const health = await mcpIntegrationService.checkHealth();
    res.status(200).json(health);
  } catch (error: any) {
    console.error('[MCP Controller] Health check failed:', error);

    // Return more specific error information
    res.status(503).json({
      error: 'MCP Service Unavailable',
      detail: error.message || 'Health check failed'
    });
  }
};
