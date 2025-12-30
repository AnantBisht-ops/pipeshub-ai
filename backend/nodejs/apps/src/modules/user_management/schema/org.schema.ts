import { Address } from '../../../libs/utils/address.utils';
import { generateUniqueSlug } from '../controller/counters.controller';
import mongoose, { Document, Schema } from 'mongoose';

// Define the interface for Org Document

export type AccountType = 'individual' | 'business';
export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface IOrg extends Document {
  slug: string;
  registeredName: string;
  shortName?: string;
  domain: string;
  contactEmail: string;
  accountType: AccountType;
  phoneNumber?: string;
  permanentAddress?: Address;
  isDeleted: boolean;
  deletedByUser?: string;
  onBoardingStatus: string;
  settings: {
    maxProjects: number;
    maxUsers: number;
    features: string[];
  };
  metadata: {
    projectCount: number;
    userCount: number;
    storageUsed: number;
  };
  subscription: {
    plan: SubscriptionPlan;
    validUntil?: Date;
  };
}

const orgSchema = new Schema<IOrg>(
  {
    slug: { type: String, unique: true },
    registeredName: {
      type: String,
      validate: {
        validator: function (this: IOrg, value: string) {
          // Required only when accountType is 'business'
          return this.accountType === 'business' ? !!value : true;
        },
        message: 'Registered Name is required for business accounts',
      },
    },
    shortName: {
      type: String,
    },
    domain: { type: String, required: true },
    contactEmail: {
      type: String,
      required: [true, 'Email required'],
      lowercase: true,
    },
    accountType: {
      type: String,
      required: true,
      enum: ['individual', 'business'], // Ensuring only valid values
    },
    phoneNumber: {
      type: String,
    },
    permanentAddress: {
      type: {
        addressLine1: { type: String },
        city: { type: String },
        state: { type: String },
        postCode: { type: String },
        country: { type: String, },
      },
    },
    onBoardingStatus: {
      type: String,
      enum: ['configured', 'notConfigured', 'skipped'],
    },
    settings: {
      maxProjects: {
        type: Number,
        default: 10,
        min: 1,
      },
      maxUsers: {
        type: Number,
        default: 50,
        min: 1,
      },
      features: [
        {
          type: String,
        },
      ],
    },
    metadata: {
      projectCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      userCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      storageUsed: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'starter', 'pro', 'enterprise'],
        default: 'free',
      },
      validUntil: {
        type: Date,
      },
    },
    isDeleted: { type: Boolean, default: false },
    deletedByUser: { type: String },
  },
  { timestamps: true },
);

// Add indexes for better query performance
orgSchema.index({ slug: 1 }, { unique: true });
orgSchema.index({ domain: 1 });
orgSchema.index({ contactEmail: 1 });
orgSchema.index({ isDeleted: 1 });
orgSchema.index({ accountType: 1 });
orgSchema.index({ 'subscription.plan': 1 });
orgSchema.index({ createdAt: -1 });

// Pre-save middleware for slug generation and default settings
orgSchema.pre<IOrg>('save', async function (next) {
  try {
    // Generate unique slug if not provided
    if (!this.slug) {
      this.slug = await generateUniqueSlug('Org');
    }

    // Set default settings based on account type if this is a new document
    if (this.isNew) {
      if (!this.settings) {
        this.settings = {
          maxProjects: this.accountType === 'business' ? 100 : 10,
          maxUsers: this.accountType === 'business' ? 500 : 50,
          features:
            this.accountType === 'business'
              ? ['unlimited_projects', 'advanced_analytics', 'custom_branding', 'priority_support']
              : ['basic_features', 'standard_support'],
        };
      }

      if (!this.subscription) {
        this.subscription = {
          plan: this.accountType === 'business' ? 'pro' : 'free',
        };
      }

      if (!this.metadata) {
        this.metadata = {
          projectCount: 0,
          userCount: 0,
          storageUsed: 0,
        };
      }
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

export const Org = mongoose.model<IOrg>('org', orgSchema, 'org');
