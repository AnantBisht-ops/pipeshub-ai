import { Document, Schema, Types } from 'mongoose';
import mongoose from 'mongoose';
import { jurisdictions } from '../../../libs/utils/juridiction.utils';

import { Address } from '../../../libs/utils/address.utils';
import { generateUniqueSlug } from '../controller/counters.controller';

export interface User extends Document, Address {
  slug?: string;
  orgId: Types.ObjectId; // Primary organization (for backward compatibility)
  organizations?: Types.ObjectId[]; // Array of all organizations user belongs to
  defaultOrgId?: Types.ObjectId; // User's default organization
  lastAccessedOrgId?: Types.ObjectId; // Last accessed organization
  fullName?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  email: string;
  mobile?: string;
  hasLoggedIn?: boolean;
  designation?: string;
  address?: Address;
  isDeleted?: boolean;
  deletedBy?: string;
}

const userSchema = new Schema<User>(
  {
    slug: { type: String, unique: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'orgs', required: true },
    organizations: [{
      type: Schema.Types.ObjectId,
      ref: 'orgs'
    }],
    defaultOrgId: {
      type: Schema.Types.ObjectId,
      ref: 'orgs'
    },
    lastAccessedOrgId: {
      type: Schema.Types.ObjectId,
      ref: 'orgs'
    },
    fullName: { type: String, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    middleName: { type: String, trim: true },
    email: {
      type: String,
      required: [true, 'Email required'],
      lowercase: true,
      unique: true,
    },
    mobile: { type: String },
    hasLoggedIn: { type: Boolean, default: false },
    designation: { type: String, trim: true },
    address: {
      type: {
        addressLine1: { type: String },
        city: { type: String },
        state: { type: String },
        postCode: { type: String },
        country: { type: String, enum: Object.values(jurisdictions) },
      },
    },
    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: String },
  },
  { timestamps: true },
);

userSchema.pre<User>('save', async function (next) {
  try {
    if (!this.slug) {
      this.slug = await generateUniqueSlug('User');
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

export const Users = mongoose.model<User>('users', userSchema, 'users');
