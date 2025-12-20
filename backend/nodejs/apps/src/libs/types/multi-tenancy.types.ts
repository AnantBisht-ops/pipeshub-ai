import { Types } from 'mongoose';
import { Request } from 'express';

/**
 * Multi-Tenancy Type Definitions
 * This file contains all the TypeScript types for the multi-tenancy architecture
 */

// ============= Organization Types =============

export type AccountType = 'individual' | 'business';
export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type OnboardingStatus = 'configured' | 'notConfigured' | 'skipped';

export interface OrganizationSettings {
  maxProjects: number;
  maxUsers: number;
  features: string[];
}

export interface OrganizationMetadata {
  projectCount: number;
  userCount: number;
  storageUsed: number;
}

export interface OrganizationSubscription {
  plan: SubscriptionPlan;
  validUntil?: Date;
}

export interface IOrganization {
  _id: Types.ObjectId;
  slug: string;
  registeredName?: string;
  shortName?: string;
  domain: string;
  contactEmail: string;
  accountType: AccountType;
  phoneNumber?: string;
  permanentAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postCode?: string;
    country?: string;
  };
  onBoardingStatus: OnboardingStatus;
  settings: OrganizationSettings;
  metadata: OrganizationMetadata;
  subscription: OrganizationSubscription;
  isDeleted: boolean;
  deletedByUser?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============= Project Types =============

export type ProjectVisibility = 'public' | 'private' | 'organization';
export type ProjectStatus = 'active' | 'archived' | 'deleted';
export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type ProjectType = 'standard' | 'research' | 'development' | 'marketing' | 'other';

export interface ProjectSettings {
  allowGuestAccess: boolean;
  requireApproval: boolean;
  autoArchiveAfterDays?: number;
  defaultUserRole: MemberRole;
  features: string[];
  integrations: string[];
}

export interface ProjectMetrics {
  documentCount: number;
  conversationCount: number;
  memberCount: number;
  storageUsed: number;
  lastActivityAt: Date;
}

export interface ProjectMember {
  userId: Types.ObjectId;
  role: MemberRole;
  joinedAt: Date;
  invitedBy?: Types.ObjectId;
  permissions?: string[];
}

export interface IProject {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  description?: string;
  orgId: Types.ObjectId;
  createdBy: Types.ObjectId;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  type: ProjectType;
  settings: ProjectSettings;
  metrics: ProjectMetrics;
  members: ProjectMember[];
  tags?: string[];
  metadata?: Record<string, any>;
  archivedBy?: Types.ObjectId;
  archivedAt?: Date;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============= Resource Access Context Types =============

/**
 * Context for accessing resources within the multi-tenant system
 */
export interface AccessContext {
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  projectId?: Types.ObjectId;
  role?: MemberRole;
  permissions?: string[];
}

/**
 * Query filters for multi-tenant resources
 */
export interface TenantQueryFilter {
  orgId: Types.ObjectId;
  projectId?: Types.ObjectId;
  isDeleted?: boolean;
}

/**
 * Base interface for all tenant-scoped resources
 */
export interface ITenantResource {
  orgId: Types.ObjectId;
  projectId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ============= Permission Types =============

export type ResourceType =
  | 'organization'
  | 'project'
  | 'document'
  | 'conversation'
  | 'agent'
  | 'citation'
  | 'notification';

export type ActionType =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'share'
  | 'archive'
  | 'restore'
  | 'manage_members'
  | 'manage_settings';

export interface Permission {
  resource: ResourceType;
  action: ActionType;
  resourceId?: Types.ObjectId;
  conditions?: Record<string, any>;
}

export interface RolePermissions {
  role: MemberRole;
  permissions: Permission[];
}

// ============= User Context Types =============

export interface UserProjectAccess {
  projectId: Types.ObjectId;
  role: MemberRole;
  permissions: string[];
  joinedAt: Date;
}

export interface UserOrganizationContext {
  orgId: Types.ObjectId;
  role: MemberRole;
  projects: UserProjectAccess[];
}

export interface UserMultiTenantContext {
  userId: Types.ObjectId;
  organizations: UserOrganizationContext[];
  currentOrgId?: Types.ObjectId;
  currentProjectId?: Types.ObjectId;
}

// ============= Request Context Types (for Express middleware) =============

export interface IOrgContext {
  orgId: string;
  orgSlug: string;
  subscription: {
    plan: string;
    features: string[];
  };
}

export interface IProjectContext {
  projectId: string;
  projectSlug: string;
  permissions: string[];
}

export interface IMultiTenantRequest extends Request {
  user?: any;
  org?: IOrgContext;
  project?: IProjectContext;
}

export interface MultiTenantRequest {
  user?: {
    _id: Types.ObjectId;
    email: string;
    orgId: Types.ObjectId;
    projectId?: Types.ObjectId;
    role?: MemberRole;
    permissions?: string[];
  };
  organization?: IOrganization;
  project?: IProject;
}

// ============= Migration Types =============

export interface MigrationContext {
  orgId: Types.ObjectId;
  projectId?: Types.ObjectId;
  batchSize: number;
  dryRun: boolean;
}

export interface MigrationResult {
  success: boolean;
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  errors?: Array<{
    recordId: string;
    error: string;
  }>;
}

// ============= Utility Types =============

/**
 * Type guard to check if a resource is project-scoped
 */
export function isProjectScoped(resource: ITenantResource): resource is ITenantResource & { projectId: Types.ObjectId } {
  return !!resource.projectId;
}

/**
 * Type guard to check if user has admin role
 */
export function isAdmin(role?: MemberRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Type guard to check if user can edit
 */
export function canEdit(role?: MemberRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

/**
 * Type guard to check if user can view
 */
export function canView(role?: MemberRole): boolean {
  return !!role; // All roles can view
}

// ============= Response Types =============

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ProjectListResponse {
  projects: IProject[];
  userRole?: MemberRole;
  canCreateNew: boolean;
}

export interface OrganizationDashboard {
  organization: IOrganization;
  projects: IProject[];
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
    userId: Types.ObjectId;
    projectId?: Types.ObjectId;
  }>;
  stats: {
    totalProjects: number;
    activeProjects: number;
    totalUsers: number;
    storageUsed: number;
    documentsCount: number;
    conversationsCount: number;
  };
}

// ============= Error Types =============

export class MultiTenantError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'MultiTenantError';
  }
}

export class OrganizationNotFoundError extends MultiTenantError {
  constructor(orgId: string) {
    super(`Organization ${orgId} not found`, 'ORG_NOT_FOUND', 404);
  }
}

export class ProjectNotFoundError extends MultiTenantError {
  constructor(projectId: string) {
    super(`Project ${projectId} not found`, 'PROJECT_NOT_FOUND', 404);
  }
}

export class UnauthorizedAccessError extends MultiTenantError {
  constructor(resource: string, action: string) {
    super(
      `Unauthorized to ${action} ${resource}`,
      'UNAUTHORIZED_ACCESS',
      403
    );
  }
}

export class ProjectLimitExceededError extends MultiTenantError {
  constructor(limit: number) {
    super(
      `Project limit of ${limit} exceeded`,
      'PROJECT_LIMIT_EXCEEDED',
      403
    );
  }
}

export class InvalidProjectContextError extends MultiTenantError {
  constructor() {
    super(
      'Project context is required for this operation',
      'INVALID_PROJECT_CONTEXT',
      400
    );
  }
}