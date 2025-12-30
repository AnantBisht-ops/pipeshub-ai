/**
 * Extension Settings Schema
 *
 * Stores user preferences and settings for the OpenAnalyst desktop extension.
 * Settings are synced across devices and persisted to the database.
 *
 * Features:
 * - General settings (theme, language, telemetry)
 * - Editor integration settings (autocomplete, hints)
 * - Chat settings (streaming, history)
 * - Custom settings for future extensibility
 * - Version tracking for sync conflict resolution
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Theme options for extension UI
 */
export enum ExtensionTheme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

/**
 * General settings interface
 * Controls overall extension behavior
 */
export interface IGeneralSettings {
  /** UI theme preference */
  theme: ExtensionTheme;
  /** Language/locale code (e.g., 'en', 'es', 'fr') */
  language: string;
  /** Whether to send anonymous telemetry data */
  telemetryEnabled: boolean;
  /** Whether to automatically check for updates */
  autoUpdate: boolean;
}

/**
 * Editor integration settings interface
 * Controls how the extension integrates with the code editor
 */
export interface IEditorSettings {
  /** Enable AI-powered autocomplete suggestions */
  autoComplete: boolean;
  /** Show inline AI hints in the editor */
  inlineHints: boolean;
  /** Enable AI-powered code actions */
  codeActions: boolean;
  /** Show AI information on hover */
  hoverInfo: boolean;
  /** Show AI-powered diagnostics */
  diagnostics: boolean;
}

/**
 * Chat settings interface
 * Controls the AI chat panel behavior
 */
export interface IChatSettings {
  /** Stream responses as they are generated */
  streamResponses: boolean;
  /** Show timestamps on messages */
  showTimestamps: boolean;
  /** Persist chat history locally */
  persistHistory: boolean;
  /** Maximum number of history items to keep */
  maxHistoryItems: number;
}

/**
 * Extension Settings Document Interface
 */
export interface IExtensionSettings extends Document {
  /** User who owns these settings */
  userId: Types.ObjectId;
  /** Organization context */
  orgId: Types.ObjectId;
  /** General extension settings */
  general: IGeneralSettings;
  /** Editor integration settings */
  editor: IEditorSettings;
  /** Chat panel settings */
  chat: IChatSettings;
  /** Custom/plugin settings (flexible structure) */
  customSettings: Record<string, unknown>;
  /** Settings version for sync conflict resolution */
  version: number;
  /** Last sync timestamp */
  syncedAt: Date;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * General Settings Sub-Schema
 */
const generalSettingsSchema = new Schema<IGeneralSettings>(
  {
    theme: {
      type: String,
      enum: Object.values(ExtensionTheme),
      default: ExtensionTheme.SYSTEM,
    },
    language: {
      type: String,
      default: 'en',
      trim: true,
      maxlength: 10,
    },
    telemetryEnabled: {
      type: Boolean,
      default: true,
    },
    autoUpdate: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

/**
 * Editor Settings Sub-Schema
 */
const editorSettingsSchema = new Schema<IEditorSettings>(
  {
    autoComplete: { type: Boolean, default: true },
    inlineHints: { type: Boolean, default: true },
    codeActions: { type: Boolean, default: true },
    hoverInfo: { type: Boolean, default: true },
    diagnostics: { type: Boolean, default: true },
  },
  { _id: false },
);

/**
 * Chat Settings Sub-Schema
 */
const chatSettingsSchema = new Schema<IChatSettings>(
  {
    streamResponses: { type: Boolean, default: true },
    showTimestamps: { type: Boolean, default: false },
    persistHistory: { type: Boolean, default: true },
    maxHistoryItems: { type: Number, default: 100, min: 10, max: 1000 },
  },
  { _id: false },
);

/**
 * Extension Settings Schema
 */
const extensionSettingsSchema = new Schema<IExtensionSettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'orgs',
      required: true,
      index: true,
    },
    general: {
      type: generalSettingsSchema,
      default: () => ({}),
    },
    editor: {
      type: editorSettingsSchema,
      default: () => ({}),
    },
    chat: {
      type: chatSettingsSchema,
      default: () => ({}),
    },
    customSettings: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'extensionSettings',
  },
);

// Compound unique index - one settings doc per user per org
extensionSettingsSchema.index({ userId: 1, orgId: 1 }, { unique: true });

/**
 * Pre-save hook to update syncedAt and increment version
 */
extensionSettingsSchema.pre('save', function (next) {
  this.syncedAt = new Date();
  next();
});

/**
 * Pre-findOneAndUpdate hook to enforce validators
 */
extensionSettingsSchema.pre(
  'findOneAndUpdate',
  function (this: mongoose.Query<unknown, IExtensionSettings>, next) {
    this.setOptions({ runValidators: true });
    next();
  },
);

export const ExtensionSettingsModel = mongoose.model<IExtensionSettings>(
  'extensionSettings',
  extensionSettingsSchema,
  'extensionSettings',
);

/**
 * Default settings factory
 * Returns a new settings object with all default values
 */
export const getDefaultExtensionSettings = (): Omit<
  IExtensionSettings,
  keyof Document | 'userId' | 'orgId' | 'createdAt' | 'updatedAt'
> => ({
  general: {
    theme: ExtensionTheme.SYSTEM,
    language: 'en',
    telemetryEnabled: true,
    autoUpdate: true,
  },
  editor: {
    autoComplete: true,
    inlineHints: true,
    codeActions: true,
    hoverInfo: true,
    diagnostics: true,
  },
  chat: {
    streamResponses: true,
    showTimestamps: false,
    persistHistory: true,
    maxHistoryItems: 100,
  },
  customSettings: {},
  version: 1,
  syncedAt: new Date(),
});
