/**
 * AI Provider Profile Schema
 *
 * Stores AI provider configurations for OpenAnalyst desktop extension.
 * Each user can have multiple provider profiles (OpenAI, Anthropic, etc.)
 * with encrypted API keys and provider-specific settings.
 *
 * Features:
 * - Encrypted API key storage
 * - Per-user, per-org profiles
 * - Provider-specific settings
 * - Default profile selection
 * - Activity tracking (lastUsedAt)
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Supported AI Providers
 */
export enum AIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  AZURE_OPENAI = 'azure-openai',
  COHERE = 'cohere',
  MISTRAL = 'mistral',
  OLLAMA = 'ollama',
  CUSTOM = 'custom',
}

/**
 * Provider-specific settings interface
 * Allows flexible configuration per provider
 */
export interface IProviderSettings {
  /** Model identifier (e.g., 'gpt-4', 'claude-3-opus') */
  model?: string;
  /** Temperature for response generation (0-2) */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Top-p sampling parameter (0-1) */
  topP?: number;
  /** Frequency penalty (-2 to 2) */
  frequencyPenalty?: number;
  /** Presence penalty (-2 to 2) */
  presencePenalty?: number;
  /** Custom base URL for API (for self-hosted or proxied endpoints) */
  baseUrl?: string;
  /** API version (for Azure OpenAI) */
  apiVersion?: string;
  /** Deployment name (for Azure OpenAI) */
  deploymentName?: string;
  /** Allow additional provider-specific fields */
  [key: string]: unknown;
}

/**
 * Encrypted API Key structure
 * Stores encryption metadata alongside the encrypted data
 */
export interface IEncryptedApiKey {
  /** Encrypted API key data (base64) */
  encryptedData: string;
  /** Initialization vector (base64) */
  iv: string;
  /** Authentication tag (base64) */
  tag: string;
}

/**
 * AI Provider Profile Document Interface
 */
export interface IAIProviderProfile extends Document {
  /** User who owns this profile */
  userId: Types.ObjectId;
  /** Organization context */
  orgId: Types.ObjectId;
  /** Display name for this profile */
  name: string;
  /** AI provider type */
  provider: AIProvider;
  /** Encrypted API key with encryption metadata */
  encryptedApiKey?: IEncryptedApiKey;
  /** Provider-specific settings */
  settings: IProviderSettings;
  /** Whether this profile is active */
  isActive: boolean;
  /** Whether this is the user's default profile */
  isDefault: boolean;
  /** Last time this profile was used for API calls */
  lastUsedAt?: Date;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Encrypted API Key Sub-Schema
 */
const encryptedApiKeySchema = new Schema<IEncryptedApiKey>(
  {
    encryptedData: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
  },
  { _id: false },
);

/**
 * Provider Settings Sub-Schema
 */
const providerSettingsSchema = new Schema<IProviderSettings>(
  {
    model: { type: String },
    temperature: { type: Number, min: 0, max: 2, default: 0.7 },
    maxTokens: { type: Number, min: 1 },
    topP: { type: Number, min: 0, max: 1 },
    frequencyPenalty: { type: Number, min: -2, max: 2 },
    presencePenalty: { type: Number, min: -2, max: 2 },
    baseUrl: { type: String },
    apiVersion: { type: String },
    deploymentName: { type: String },
  },
  { _id: false, strict: false }, // Allow additional provider-specific fields
);

/**
 * AI Provider Profile Schema
 */
const aiProviderProfileSchema = new Schema<IAIProviderProfile>(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    provider: {
      type: String,
      enum: Object.values(AIProvider),
      required: true,
      index: true,
    },
    encryptedApiKey: {
      type: encryptedApiKeySchema,
      select: false, // Don't return by default for security
    },
    settings: {
      type: providerSettingsSchema,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    lastUsedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'aiProviderProfiles',
  },
);

// Compound index for efficient user queries
aiProviderProfileSchema.index({ userId: 1, orgId: 1, provider: 1 });
aiProviderProfileSchema.index({ userId: 1, isDefault: 1 });

/**
 * Pre-save hook to ensure only one default profile per user per org
 */
aiProviderProfileSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Unset default on all other profiles for this user/org
    await AIProviderProfileModel.updateMany(
      {
        userId: this.userId,
        orgId: this.orgId,
        _id: { $ne: this._id },
      },
      { isDefault: false },
    );
  }
  next();
});

/**
 * Pre-findOneAndUpdate hook to enforce validators
 */
aiProviderProfileSchema.pre(
  'findOneAndUpdate',
  function (this: mongoose.Query<unknown, IAIProviderProfile>, next) {
    this.setOptions({ runValidators: true });
    next();
  },
);

export const AIProviderProfileModel = mongoose.model<IAIProviderProfile>(
  'aiProviderProfiles',
  aiProviderProfileSchema,
  'aiProviderProfiles',
);
