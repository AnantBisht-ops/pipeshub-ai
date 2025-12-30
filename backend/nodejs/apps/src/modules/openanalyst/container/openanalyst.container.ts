/**
 * OpenAnalyst Container
 *
 * Inversify IoC container configuration for OpenAnalyst module.
 * Initializes all services and controllers with their dependencies.
 */

import { Container } from 'inversify';
import { OpenAnalystService } from '../services/openanalyst.service';
import { OpenAnalystController } from '../controller/openanalyst.controller';
import { Logger } from '../../../libs/services/logger.service';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { AppConfig } from '../../tokens_manager/config/config';

const loggerConfig = {
  service: 'OpenAnalyst Container',
};

export class OpenAnalystContainer {
  private static instance: Container;
  private static logger: Logger = Logger.getInstance(loggerConfig);

  /**
   * Initialize the OpenAnalyst container with required dependencies
   *
   * @param parentContainer - The parent auth service container for shared dependencies
   * @param appConfig - Application configuration
   * @returns Initialized container
   */
  static async initialize(
    parentContainer: Container,
    appConfig: AppConfig,
  ): Promise<Container> {
    const container = new Container();

    try {
      // Bind logger
      container.bind<Logger>('Logger').toConstantValue(this.logger);

      // Get AuthMiddleware from parent container
      const authMiddleware = parentContainer.get<AuthMiddleware>('AuthMiddleware');
      container
        .bind<AuthMiddleware>('AuthMiddleware')
        .toConstantValue(authMiddleware);

      // Bind encryption key (using JWT secret as encryption key)
      const encryptionKey = appConfig.jwtSecret;
      container.bind<string>('EncryptionKey').toConstantValue(encryptionKey);

      // Bind OpenAnalyst Service
      container
        .bind<OpenAnalystService>('OpenAnalystService')
        .toDynamicValue(() => {
          return new OpenAnalystService(this.logger, encryptionKey);
        })
        .inSingletonScope();

      // Bind OpenAnalyst Controller
      container
        .bind<OpenAnalystController>('OpenAnalystController')
        .toDynamicValue(() => {
          const service = container.get<OpenAnalystService>('OpenAnalystService');
          return new OpenAnalystController(service);
        })
        .inSingletonScope();

      this.instance = container;
      this.logger.info('OpenAnalyst container initialized successfully');

      return container;
    } catch (error) {
      this.logger.error('Failed to initialize OpenAnalyst container', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get the singleton instance of the container
   */
  static getInstance(): Container {
    if (!this.instance) {
      throw new Error('OpenAnalyst container not initialized');
    }
    return this.instance;
  }

  /**
   * Dispose of the container and cleanup resources
   */
  static async dispose(): Promise<void> {
    if (this.instance) {
      try {
        this.logger.info('Disposing OpenAnalyst container...');
        // No specific cleanup needed for this module
        this.logger.info('OpenAnalyst container disposed successfully');
      } catch (error) {
        this.logger.error('Error disposing OpenAnalyst container', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        this.instance = null!;
      }
    }
  }
}
