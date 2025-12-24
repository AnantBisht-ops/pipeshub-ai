/**
 * OpenAnalyst Service
 *
 * Business logic layer for OpenAnalyst desktop extension.
 * Manages AI provider profiles and extension settings.
 */

import { injectable, inject } from 'inversify';
import { Types } from 'mongoose';
import {
  AIProviderProfileModel,
  IAIProviderProfile,
  AIProvider,
  IProviderSettings,
  IEncryptedApiKey,
} from '../schema/aiProviderProfile.schema';
import {
  ExtensionSettingsModel,
  IExtensionSettings,
  getDefaultExtensionSettings,
} from '../schema/extensionSettings.schema';
import { Logger } from '../../../libs/services/logger.service';
import {
  NotFoundError,
  BadRequestError,
} from '../../../libs/errors/http.errors';
import {
  encrypt,
  decrypt,
  EncryptedData,
} from '../../../libs/utils/encryption.util';

@injectable()
export class OpenAnalystService {
  constructor(
    @inject('Logger') private logger: Logger,
    @inject('EncryptionKey') private encryptionKey: string,
  ) {}

  // ============ PROVIDER PROFILE METHODS ============

  /**
   * Get all provider profiles for a user
   */
  async getProviderProfiles(
    userId: string,
    orgId: string,
  ): Promise<IAIProviderProfile[]> {
    const profiles = await AIProviderProfileModel.find({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    }).sort({ isDefault: -1, updatedAt: -1 });

    this.logger.debug('[OpenAnalyst] Retrieved provider profiles', {
      userId,
      count: profiles.length,
    });

    return profiles;
  }

  /**
   * Get a single provider profile by ID
   */
  async getProviderProfile(
    profileId: string,
    userId: string,
  ): Promise<IAIProviderProfile> {
    const profile = await AIProviderProfileModel.findOne({
      _id: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
    });

    if (!profile) {
      throw new NotFoundError('Provider profile not found');
    }

    return profile;
  }

  /**
   * Get the default provider profile for a user
   */
  async getDefaultProviderProfile(
    userId: string,
    orgId: string,
  ): Promise<IAIProviderProfile | null> {
    const profile = await AIProviderProfileModel.findOne({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      isDefault: true,
      isActive: true,
    });

    return profile;
  }

  /**
   * Create a new provider profile
   */
  async createProviderProfile(
    userId: string,
    orgId: string,
    data: {
      name: string;
      provider: AIProvider;
      apiKey?: string;
      settings?: IProviderSettings;
      isDefault?: boolean;
    },
  ): Promise<IAIProviderProfile> {
    // Encrypt API key if provided
    let encryptedApiKey: IEncryptedApiKey | undefined;
    if (data.apiKey) {
      const encrypted = encrypt(data.apiKey, this.encryptionKey);
      encryptedApiKey = {
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        tag: encrypted.tag,
      };
    }

    // Check if this is the first profile - make it default
    const existingCount = await AIProviderProfileModel.countDocuments({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    });

    const isDefault = data.isDefault ?? existingCount === 0;

    const profile = new AIProviderProfileModel({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      name: data.name,
      provider: data.provider,
      encryptedApiKey,
      settings: data.settings || {},
      isDefault,
      isActive: true,
    });

    await profile.save();

    this.logger.info('[OpenAnalyst] Created provider profile', {
      userId,
      profileId: profile._id,
      provider: data.provider,
      isDefault,
    });

    return profile;
  }

  /**
   * Update a provider profile
   */
  async updateProviderProfile(
    profileId: string,
    userId: string,
    data: {
      name?: string;
      apiKey?: string;
      settings?: IProviderSettings;
      isActive?: boolean;
      isDefault?: boolean;
    },
  ): Promise<IAIProviderProfile> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.settings !== undefined) {
      updateData.settings = data.settings;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    if (data.isDefault !== undefined) {
      updateData.isDefault = data.isDefault;
    }

    // Encrypt new API key if provided
    if (data.apiKey) {
      const encrypted = encrypt(data.apiKey, this.encryptionKey);
      updateData.encryptedApiKey = {
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        tag: encrypted.tag,
      };
    }

    const profile = await AIProviderProfileModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
      },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!profile) {
      throw new NotFoundError('Provider profile not found');
    }

    this.logger.info('[OpenAnalyst] Updated provider profile', {
      userId,
      profileId,
    });

    return profile;
  }

  /**
   * Delete a provider profile
   */
  async deleteProviderProfile(
    profileId: string,
    userId: string,
  ): Promise<void> {
    const profile = await AIProviderProfileModel.findOne({
      _id: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
    });

    if (!profile) {
      throw new NotFoundError('Provider profile not found');
    }

    const wasDefault = profile.isDefault;
    const orgId = profile.orgId;

    await AIProviderProfileModel.deleteOne({
      _id: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
    });

    // If deleted profile was default, set another as default
    if (wasDefault) {
      const nextProfile = await AIProviderProfileModel.findOne({
        userId: new Types.ObjectId(userId),
        orgId: orgId,
        isActive: true,
      }).sort({ updatedAt: -1 });

      if (nextProfile) {
        nextProfile.isDefault = true;
        await nextProfile.save();
      }
    }

    this.logger.info('[OpenAnalyst] Deleted provider profile', {
      userId,
      profileId,
    });
  }

  /**
   * Set a provider profile as default
   */
  async setDefaultProviderProfile(
    profileId: string,
    userId: string,
    orgId: string,
  ): Promise<IAIProviderProfile> {
    // Unset current default
    await AIProviderProfileModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        orgId: new Types.ObjectId(orgId),
        isDefault: true,
      },
      { $set: { isDefault: false } },
    );

    // Set new default
    const profile = await AIProviderProfileModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
      },
      { $set: { isDefault: true } },
      { new: true },
    );

    if (!profile) {
      throw new NotFoundError('Provider profile not found');
    }

    this.logger.info('[OpenAnalyst] Set default provider profile', {
      userId,
      profileId,
    });

    return profile;
  }

  /**
   * Get decrypted API key for a profile
   */
  async getProviderApiKey(
    profileId: string,
    userId: string,
  ): Promise<string | null> {
    const profile = await AIProviderProfileModel.findOne({
      _id: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
    }).select('+encryptedApiKey');

    if (!profile || !profile.encryptedApiKey) {
      return null;
    }

    try {
      const encryptedData: EncryptedData = {
        encryptedData: profile.encryptedApiKey.encryptedData,
        iv: profile.encryptedApiKey.iv,
        tag: profile.encryptedApiKey.tag,
      };

      return decrypt(encryptedData, this.encryptionKey);
    } catch (error) {
      this.logger.error('[OpenAnalyst] Failed to decrypt API key', {
        profileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Update last used timestamp for a profile
   */
  async updateProfileLastUsed(
    profileId: string,
    userId: string,
  ): Promise<void> {
    await AIProviderProfileModel.updateOne(
      {
        _id: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
      },
      { $set: { lastUsedAt: new Date() } },
    );
  }

  /**
   * Check if API key is configured for a profile
   */
  async hasApiKey(profileId: string, userId: string): Promise<boolean> {
    const profile = await AIProviderProfileModel.findOne({
      _id: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
    }).select('+encryptedApiKey');

    return !!(profile?.encryptedApiKey?.encryptedData);
  }

  // ============ EXTENSION SETTINGS METHODS ============

  /**
   * Get extension settings for a user
   */
  async getExtensionSettings(
    userId: string,
    orgId: string,
  ): Promise<IExtensionSettings> {
    let settings = await ExtensionSettingsModel.findOne({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    });

    // Create default settings if none exist
    if (!settings) {
      const defaults = getDefaultExtensionSettings();
      settings = new ExtensionSettingsModel({
        userId: new Types.ObjectId(userId),
        orgId: new Types.ObjectId(orgId),
        ...defaults,
      });
      await settings.save();

      this.logger.info('[OpenAnalyst] Created default extension settings', {
        userId,
      });
    }

    return settings;
  }

  /**
   * Update extension settings
   */
  async updateExtensionSettings(
    userId: string,
    orgId: string,
    data: {
      general?: Partial<IExtensionSettings['general']>;
      editor?: Partial<IExtensionSettings['editor']>;
      chat?: Partial<IExtensionSettings['chat']>;
      customSettings?: Record<string, unknown>;
    },
  ): Promise<IExtensionSettings> {
    const updateData: Record<string, unknown> = {};

    // Build nested update operations for partial updates
    if (data.general) {
      Object.keys(data.general).forEach((key) => {
        updateData[`general.${key}`] = (data.general as Record<string, unknown>)[key];
      });
    }

    if (data.editor) {
      Object.keys(data.editor).forEach((key) => {
        updateData[`editor.${key}`] = (data.editor as Record<string, unknown>)[key];
      });
    }

    if (data.chat) {
      Object.keys(data.chat).forEach((key) => {
        updateData[`chat.${key}`] = (data.chat as Record<string, unknown>)[key];
      });
    }

    if (data.customSettings !== undefined) {
      updateData.customSettings = data.customSettings;
    }

    // Update syncedAt and increment version
    updateData.syncedAt = new Date();

    const settings = await ExtensionSettingsModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        orgId: new Types.ObjectId(orgId),
      },
      {
        $set: updateData,
        $inc: { version: 1 },
      },
      { new: true, upsert: true, runValidators: true },
    );

    if (!settings) {
      throw new BadRequestError('Failed to update settings');
    }

    this.logger.info('[OpenAnalyst] Updated extension settings', {
      userId,
      version: settings.version,
    });

    return settings;
  }

  /**
   * Reset extension settings to defaults
   */
  async resetExtensionSettings(
    userId: string,
    orgId: string,
  ): Promise<IExtensionSettings> {
    // Delete existing settings
    await ExtensionSettingsModel.deleteOne({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    });

    // Create new default settings
    const settings = await this.getExtensionSettings(userId, orgId);

    this.logger.info('[OpenAnalyst] Reset extension settings to defaults', {
      userId,
    });

    return settings;
  }

  /**
   * Get settings version for sync conflict detection
   */
  async getSettingsVersion(userId: string, orgId: string): Promise<number> {
    const settings = await ExtensionSettingsModel.findOne({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    }).select('version');

    return settings?.version || 0;
  }

  /**
   * Conditionally update settings only if version matches
   */
  async updateSettingsIfVersionMatches(
    userId: string,
    orgId: string,
    expectedVersion: number,
    data: {
      general?: Partial<IExtensionSettings['general']>;
      editor?: Partial<IExtensionSettings['editor']>;
      chat?: Partial<IExtensionSettings['chat']>;
      customSettings?: Record<string, unknown>;
    },
  ): Promise<{ updated: boolean; settings: IExtensionSettings }> {
    const currentSettings = await this.getExtensionSettings(userId, orgId);

    if (currentSettings.version !== expectedVersion) {
      return {
        updated: false,
        settings: currentSettings,
      };
    }

    const updatedSettings = await this.updateExtensionSettings(
      userId,
      orgId,
      data,
    );

    return {
      updated: true,
      settings: updatedSettings,
    };
  }
}
