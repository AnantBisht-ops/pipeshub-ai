/**
 * OpenAnalyst Schema Exports
 *
 * Central export point for all OpenAnalyst database schemas.
 */

// AI Provider Profile exports
export {
  AIProviderProfileModel,
  AIProvider,
  type IAIProviderProfile,
  type IProviderSettings,
  type IEncryptedApiKey,
} from './aiProviderProfile.schema';

// Extension Settings exports
export {
  ExtensionSettingsModel,
  ExtensionTheme,
  getDefaultExtensionSettings,
  type IExtensionSettings,
  type IGeneralSettings,
  type IEditorSettings,
  type IChatSettings,
} from './extensionSettings.schema';
