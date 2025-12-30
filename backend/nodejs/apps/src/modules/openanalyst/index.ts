/**
 * OpenAnalyst Module Exports
 *
 * Central export point for the OpenAnalyst desktop extension module.
 * Provides all necessary exports for integration with the main application.
 */

// Container
export { OpenAnalystContainer } from './container/openanalyst.container';

// Routes
export { createOpenAnalystRouter } from './routes/openanalyst.routes';

// Service
export { OpenAnalystService } from './services/openanalyst.service';

// Controller
export { OpenAnalystController } from './controller/openanalyst.controller';

// Schema exports
export {
  // AI Provider Profile
  AIProviderProfileModel,
  AIProvider,
  type IAIProviderProfile,
  type IProviderSettings,
  type IEncryptedApiKey,
  // Extension Settings
  ExtensionSettingsModel,
  ExtensionTheme,
  getDefaultExtensionSettings,
  type IExtensionSettings,
  type IGeneralSettings,
  type IEditorSettings,
  type IChatSettings,
} from './schema';
