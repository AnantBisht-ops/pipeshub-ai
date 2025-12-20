import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Interface for Project document in MongoDB
 */
export interface IProject extends Document {
  _id: Types.ObjectId;
  slug: string;
  orgId: Types.ObjectId;
  name: string;
  description?: string;
  members: Types.ObjectId[];
  admins: Types.ObjectId[];
  settings: {
    isPublic: boolean;
    allowGuestAccess: boolean;
    defaultPermissions: string;
  };
  metadata: {
    conversationCount: number;
    documentCount: number;
    lastActivityAt: Date;
  };
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;
}

/**
 * Project Schema definition for MongoDB
 */
const ProjectSchema = new Schema<IProject>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
      maxlength: 100,
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
      maxlength: 100,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'users',
      },
    ],
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: 'users',
      },
    ],
    settings: {
      isPublic: {
        type: Boolean,
        default: false,
      },
      allowGuestAccess: {
        type: Boolean,
        default: false,
      },
      defaultPermissions: {
        type: String,
        enum: ['read', 'write', 'admin'],
        default: 'read',
      },
    },
    metadata: {
      conversationCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      documentCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastActivityAt: {
        type: Date,
        default: Date.now,
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'users',
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
    collection: 'projects', // Explicit collection name
  },
);

// Indexes for performance optimization
ProjectSchema.index({ orgId: 1, isDeleted: 1 });
ProjectSchema.index({ orgId: 1, members: 1 });
ProjectSchema.index({ orgId: 1, slug: 1 });
ProjectSchema.index({ slug: 1 }, { unique: true });
ProjectSchema.index({ orgId: 1, name: 1 });
ProjectSchema.index({ createdAt: -1 });

// Virtual for member count
ProjectSchema.virtual('memberCount').get(function (this: IProject) {
  return this.members ? this.members.length : 0;
});

// Virtual for admin count
ProjectSchema.virtual('adminCount').get(function (this: IProject) {
  return this.admins ? this.admins.length : 0;
});

// Middleware to update updatedAt on save
ProjectSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Middleware to ensure admins are also in members array
ProjectSchema.pre('save', function (next) {
  if (this.admins && this.admins.length > 0) {
    // Ensure all admins are in members array
    const memberIds = this.members.map((m) => m.toString());
    this.admins.forEach((adminId) => {
      if (!memberIds.includes(adminId.toString())) {
        this.members.push(adminId);
      }
    });
  }
  next();
});

// Instance method to check if user is admin
ProjectSchema.methods.isUserAdmin = function (userId: string | Types.ObjectId): boolean {
  const userIdStr = userId.toString();
  return this.admins.some((adminId: Types.ObjectId) => adminId.toString() === userIdStr);
};

// Instance method to check if user is member
ProjectSchema.methods.isUserMember = function (userId: string | Types.ObjectId): boolean {
  const userIdStr = userId.toString();
  return this.members.some((memberId: Types.ObjectId) => memberId.toString() === userIdStr);
};

// Instance method to add member
ProjectSchema.methods.addMember = function (userId: Types.ObjectId): void {
  if (!this.isUserMember(userId)) {
    this.members.push(userId);
  }
};

// Instance method to remove member
ProjectSchema.methods.removeMember = function (userId: Types.ObjectId): void {
  this.members = this.members.filter(
    (memberId: Types.ObjectId) => memberId.toString() !== userId.toString(),
  );
  // Also remove from admins if they were an admin
  this.admins = this.admins.filter(
    (adminId: Types.ObjectId) => adminId.toString() !== userId.toString(),
  );
};

// Instance method to promote to admin
ProjectSchema.methods.promoteToAdmin = function (userId: Types.ObjectId): void {
  if (!this.isUserAdmin(userId)) {
    this.admins.push(userId);
    // Also ensure they're a member
    this.addMember(userId);
  }
};

// Instance method to demote from admin
ProjectSchema.methods.demoteFromAdmin = function (userId: Types.ObjectId): void {
  this.admins = this.admins.filter(
    (adminId: Types.ObjectId) => adminId.toString() !== userId.toString(),
  );
};

// Instance method for soft delete
ProjectSchema.methods.softDelete = function (userId: Types.ObjectId): void {
  this.isDeleted = true;
  this.deletedBy = userId;
  this.deletedAt = new Date();
};

// Instance method to restore soft deleted project
ProjectSchema.methods.restore = function (): void {
  this.isDeleted = false;
  this.deletedBy = undefined;
  this.deletedAt = undefined;
};

// Static method to find active projects for an organization
ProjectSchema.statics.findActiveByOrg = function (orgId: Types.ObjectId) {
  return this.find({ orgId, isDeleted: false }).sort({ createdAt: -1 });
};

// Static method to find projects for a user in an organization
ProjectSchema.statics.findByUserAndOrg = function (userId: Types.ObjectId, orgId: Types.ObjectId) {
  return this.find({
    orgId,
    members: userId,
    isDeleted: false,
  }).sort({ updatedAt: -1 });
};

// Static method to generate unique slug
ProjectSchema.statics.generateUniqueSlug = async function (name: string, orgId: Types.ObjectId): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  let slug = baseSlug;
  let counter = 1;

  // Check if slug exists and generate new one if needed
  while (await this.findOne({ slug, orgId })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

// Create and export the model
export const Project = mongoose.model<IProject>('projects', ProjectSchema);

// Export types for use in other modules
export type ProjectDocument = IProject;
export type ProjectModel = typeof Project;