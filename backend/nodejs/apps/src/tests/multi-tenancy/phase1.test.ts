/**
 * Phase 1 Implementation Tests
 * Tests for Foundation & Schema Updates
 */

import 'mocha';
import { expect } from 'chai';
import mongoose from 'mongoose';
import { Org } from '../../modules/user_management/schema/org.schema';
import { Project } from '../../modules/project_management/schema/project.schema';
import { DocumentModel } from '../../modules/storage/schema/document.schema';
import { Conversation } from '../../modules/enterprise_search/schema/conversation.schema';
import { AgentConversation } from '../../modules/enterprise_search/schema/agent.conversation.schema';
import EnterpriseSemanticSearch from '../../modules/enterprise_search/schema/search.schema';
import Citation from '../../modules/enterprise_search/schema/citation.schema';
import { Notifications } from '../../modules/notification/schema/notification.schema';
import {
  AccountType,
  ProjectVisibility,
  MemberRole,
  isAdmin,
  canEdit,
  canView,
  OrganizationNotFoundError,
  ProjectNotFoundError
} from '../../libs/types/multi-tenancy.types';

describe('Phase 1: Multi-Tenancy Foundation Tests', () => {
  let testOrg: any;
  let testProject: any;
  let testUserId: mongoose.Types.ObjectId;

  before(async () => {
    // Connect to test database
    const testDbUri = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/pipeshub_test';
    await mongoose.connect(testDbUri);

    // Clean up test data
    await Promise.all([
      Org.deleteMany({ domain: 'test.com' }),
      Project.deleteMany({ name: { $regex: /^Test/ } }),
      DocumentModel.deleteMany({ documentName: { $regex: /^test/ } }),
      Conversation.deleteMany({ title: { $regex: /^Test/ } }),
      AgentConversation.deleteMany({ title: { $regex: /^Test/ } }),
      EnterpriseSemanticSearch.deleteMany({ query: { $regex: /^test/ } }),
      Notifications.deleteMany({ title: { $regex: /^Test/ } })
    ]);

    testUserId = new mongoose.Types.ObjectId();
  });

  after(async () => {
    // Clean up and disconnect
    await Promise.all([
      Org.deleteMany({ domain: 'test.com' }),
      Project.deleteMany({ name: { $regex: /^Test/ } }),
      DocumentModel.deleteMany({ documentName: { $regex: /^test/ } }),
      Conversation.deleteMany({ title: { $regex: /^Test/ } }),
      AgentConversation.deleteMany({ title: { $regex: /^Test/ } }),
      EnterpriseSemanticSearch.deleteMany({ query: { $regex: /^test/ } }),
      Notifications.deleteMany({ title: { $regex: /^Test/ } })
    ]);

    await mongoose.disconnect();
  });

  describe('Organization Schema Tests', () => {
    it('should create an organization with all new fields', async () => {
      const orgData = {
        registeredName: 'Test Organization',
        shortName: 'TestOrg',
        domain: 'test.com',
        contactEmail: 'admin@test.com',
        accountType: 'business' as AccountType,
        phoneNumber: '+1234567890',
        onBoardingStatus: 'configured',
        settings: {
          maxProjects: 100,
          maxUsers: 500,
          features: ['advanced_analytics', 'custom_branding']
        },
        metadata: {
          projectCount: 0,
          userCount: 1,
          storageUsed: 0
        },
        subscription: {
          plan: 'pro' as const,
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        }
      };

      testOrg = await Org.create(orgData);

      expect(testOrg).to.exist;
      expect(testOrg.slug).to.exist;
      expect(testOrg.accountType).to.equal('business');
      expect(testOrg.settings.maxProjects).to.equal(100);
      expect(testOrg.subscription.plan).to.equal('pro');
      expect(testOrg.metadata.projectCount).to.equal(0);
    });

    it('should auto-generate slug if not provided', async () => {
      expect(testOrg.slug).to.exist;
      expect(testOrg.slug).to.be.a('string');
      expect(testOrg.slug.length).to.be.greaterThan(0);
    });

    it('should have proper indexes', async () => {
      const indexes = await Org.collection.getIndexes();
      const indexKeys = Object.keys(indexes).map(key => (indexes as any)[key].key);

      // Check for required indexes
      expect(indexKeys).to.deep.include({ slug: 1 });
      expect(indexKeys).to.deep.include({ domain: 1 });
      expect(indexKeys).to.deep.include({ contactEmail: 1 });
    });
  });

  describe('Project Schema Tests', () => {
    it('should create a project with all required fields', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test project for multi-tenancy',
        orgId: testOrg._id,
        createdBy: testUserId,
        visibility: 'private' as ProjectVisibility,
        status: 'active' as const,
        type: 'development' as const,
        settings: {
          allowGuestAccess: false,
          requireApproval: true,
          defaultUserRole: 'viewer' as MemberRole,
          features: ['documents', 'conversations'],
          integrations: []
        },
        metrics: {
          documentCount: 0,
          conversationCount: 0,
          memberCount: 1,
          storageUsed: 0,
          lastActivityAt: new Date()
        },
        members: [{
          userId: testUserId,
          role: 'owner' as MemberRole,
          joinedAt: new Date()
        }]
      };

      testProject = await Project.create(projectData);

      expect(testProject).to.exist;
      expect(testProject.slug).to.exist;
      expect(testProject.orgId.toString()).to.equal(testOrg._id.toString());
      expect(testProject.visibility).to.equal('private');
      expect(testProject.members).to.have.length(1);
      expect(testProject.members[0].role).to.equal('owner');
    });

    it('should add member to project', async () => {
      const newUserId = new mongoose.Types.ObjectId();
      await testProject.addMember(newUserId, 'editor' as MemberRole, testUserId);

      const updatedProject = await Project.findById(testProject._id);
      expect(updatedProject?.members).to.have.length(2);

      const newMember = updatedProject?.members.find(
        (m: any) => m.userId.toString() === newUserId.toString()
      );
      expect(newMember).to.exist;
      expect((newMember as any)?.role).to.equal('editor');
    });

    it('should update member role', async () => {
      const memberId = (testProject.members[0] as any).userId;
      await testProject.updateMemberRole(memberId, 'admin' as MemberRole);

      const updatedProject = await Project.findById(testProject._id);
      const member = updatedProject?.members.find(
        (m: any) => m.userId.toString() === memberId.toString()
      );
      expect((member as any)?.role).to.equal('admin');
    });

    it('should remove member from project', async () => {
      const memberToRemove = (testProject.members[1] as any).userId;
      await testProject.removeMember(memberToRemove);

      const updatedProject = await Project.findById(testProject._id);
      expect(updatedProject?.members).to.have.length(1);

      const removedMember = updatedProject?.members.find(
        (m: any) => m.userId.toString() === memberToRemove.toString()
      );
      expect(removedMember).to.not.exist;
    });

    it('should soft delete project', async () => {
      await testProject.softDelete(testUserId);

      const deletedProject = await Project.findById(testProject._id);
      expect((deletedProject as any)?.status).to.equal('deleted');
      expect((deletedProject as any)?.deletedBy?.toString()).to.equal(testUserId.toString());
      expect((deletedProject as any)?.deletedAt).to.exist;
    });

    it('should have proper indexes', async () => {
      const indexes = await Project.collection.getIndexes();
      const indexKeys = Object.keys(indexes).map(key => (indexes as any)[key].key);

      // Check for required indexes
      expect(indexKeys).to.deep.include({ orgId: 1 });
      expect(indexKeys).to.deep.include({ slug: 1 });
      expect(indexKeys).to.deep.include({ orgId: 1, slug: 1 });
    });
  });

  describe('Document Schema Tests', () => {
    it('should create document with orgId and projectId', async () => {
      const documentData = {
        documentName: 'test-document.pdf',
        documentPath: '/test/path',
        orgId: testOrg._id,
        projectId: testProject._id,
        initiatorUserId: testUserId,
        sizeInBytes: 1024,
        mimeType: 'application/pdf',
        extension: 'pdf',
        storageVendor: 'S3',
        s3: {
          url: 'https://s3.amazonaws.com/test/document.pdf'
        }
      };

      const document = await DocumentModel.create(documentData);

      expect(document).to.exist;
      expect(document.orgId.toString()).to.equal(testOrg._id.toString());
      expect((document as any).projectId?.toString()).to.equal(testProject._id.toString());
      expect(document.storageVendor).to.equal('S3');
    });

    it('should have proper compound indexes', async () => {
      const indexes = await DocumentModel.collection.getIndexes();
      const indexKeys = Object.keys(indexes).map(key => (indexes as any)[key].key);

      // Check for required indexes
      expect(indexKeys).to.deep.include({ orgId: 1, isDeleted: 1 });
      expect(indexKeys).to.deep.include({ orgId: 1, projectId: 1 });
      expect(indexKeys).to.deep.include({ orgId: 1, projectId: 1, isDeleted: 1 });
    });
  });

  describe('Conversation Schema Tests', () => {
    it('should create conversation with projectId', async () => {
      const conversationData = {
        userId: testUserId,
        orgId: testOrg._id,
        projectId: testProject._id,
        title: 'Test Conversation',
        initiator: testUserId,
        messages: [{
          messageType: 'user_query' as const,
          content: 'Test message',
          contentFormat: 'MARKDOWN' as const
        }]
      };

      const conversation = await Conversation.create(conversationData);

      expect(conversation).to.exist;
      expect(conversation.orgId.toString()).to.equal(testOrg._id.toString());
      expect(conversation.projectId?.toString()).to.equal(testProject._id.toString());
      expect(conversation.messages).to.have.length(1);
    });
  });

  describe('Agent Conversation Schema Tests', () => {
    it('should create agent conversation with projectId', async () => {
      const agentConversationData = {
        agentKey: 'test-agent-key',
        userId: testUserId,
        orgId: testOrg._id,
        projectId: testProject._id,
        title: 'Test Agent Conversation',
        initiator: testUserId,
        messages: [{
          messageType: 'user_query' as const,
          content: 'Test agent message',
          contentFormat: 'MARKDOWN' as const
        }],
        conversationSource: 'agent_chat' as const
      };

      const agentConversation = await AgentConversation.create(agentConversationData);

      expect(agentConversation).to.exist;
      expect(agentConversation.agentKey).to.equal('test-agent-key');
      expect(agentConversation.orgId.toString()).to.equal(testOrg._id.toString());
      expect(agentConversation.projectId?.toString()).to.equal(testProject._id.toString());
      expect(agentConversation.conversationSource).to.equal('agent_chat');
    });
  });

  describe('Search Schema Tests', () => {
    it('should create search record with projectId', async () => {
      const searchData = {
        query: 'test search query',
        limit: 10,
        orgId: testOrg._id,
        projectId: testProject._id,
        userId: testUserId,
        citationIds: [],
        records: {}
      };

      const search = await EnterpriseSemanticSearch.create(searchData);

      expect(search).to.exist;
      expect(search.orgId.toString()).to.equal(testOrg._id.toString());
      expect(search.projectId?.toString()).to.equal(testProject._id.toString());
      expect(search.query).to.equal('test search query');
    });
  });

  describe('Citation Schema Tests', () => {
    it('should create citation with projectId in metadata', async () => {
      const citationData = {
        content: 'Test citation content',
        chunkIndex: 0,
        citationType: 'document',
        metadata: {
          orgId: testOrg._id.toString(),
          projectId: testProject._id.toString(),
          mimeType: 'text/plain',
          recordId: 'test-record-id',
          recordName: 'test-record',
          origin: 'test',
          webUrl: 'https://example.com',
          chunkIndex: 0,
          recordVersion: 1
        }
      };

      const citation = await Citation.create(citationData);

      expect(citation).to.exist;
      expect(citation.metadata.orgId).to.equal(testOrg._id.toString());
      expect(citation.metadata.projectId).to.equal(testProject._id.toString());
      expect(citation.content).to.equal('Test citation content');
    });
  });

  describe('Notification Schema Tests', () => {
    it('should create notification with optional projectId', async () => {
      // Org-level notification
      const orgNotificationData = {
        title: 'Test Org Notification',
        orgId: testOrg._id,
        type: 'system',
        link: '/notifications',
        assignedTo: testUserId
      };

      const orgNotification = await Notifications.create(orgNotificationData);

      expect(orgNotification).to.exist;
      expect(orgNotification.orgId.toString()).to.equal(testOrg._id.toString());
      expect(orgNotification.projectId).to.not.exist;

      // Project-level notification
      const projectNotificationData = {
        title: 'Test Project Notification',
        orgId: testOrg._id,
        projectId: testProject._id,
        type: 'document_shared',
        link: '/documents/123',
        assignedTo: testUserId
      };

      const projectNotification = await Notifications.create(projectNotificationData);

      expect(projectNotification).to.exist;
      expect(projectNotification.orgId.toString()).to.equal(testOrg._id.toString());
      expect(projectNotification.projectId?.toString()).to.equal(testProject._id.toString());
    });
  });

  describe('TypeScript Type Tests', () => {
    it('should validate type guard functions', () => {
      // Test isAdmin
      expect(isAdmin('owner')).to.be.true;
      expect(isAdmin('admin')).to.be.true;
      expect(isAdmin('editor')).to.be.false;
      expect(isAdmin('viewer')).to.be.false;

      // Test canEdit
      expect(canEdit('owner')).to.be.true;
      expect(canEdit('admin')).to.be.true;
      expect(canEdit('editor')).to.be.true;
      expect(canEdit('viewer')).to.be.false;

      // Test canView
      expect(canView('owner')).to.be.true;
      expect(canView('admin')).to.be.true;
      expect(canView('editor')).to.be.true;
      expect(canView('viewer')).to.be.true;
      expect(canView(undefined)).to.be.false;
    });

    it('should validate custom error classes', () => {
      const orgError = new OrganizationNotFoundError('test-org-id');
      expect(orgError.message).to.include('test-org-id');
      expect(orgError.code).to.equal('ORG_NOT_FOUND');
      expect(orgError.statusCode).to.equal(404);

      const projectError = new ProjectNotFoundError('test-project-id');
      expect(projectError.message).to.include('test-project-id');
      expect(projectError.code).to.equal('PROJECT_NOT_FOUND');
      expect(projectError.statusCode).to.equal(404);
    });
  });

  describe('Index Validation Tests', () => {
    it('should validate all compound indexes are created', async () => {
      // Check Document indexes
      const docIndexes = await DocumentModel.collection.getIndexes();
      expect(Object.keys(docIndexes)).to.include.members([
        'orgId_1_isDeleted_1',
        'orgId_1_projectId_1',
        'orgId_1_projectId_1_isDeleted_1'
      ]);

      // Check Conversation indexes
      const convIndexes = await Conversation.collection.getIndexes();
      expect(Object.keys(convIndexes).some(key => key.includes('orgId') && key.includes('projectId'))).to.be.true;

      // Check Search indexes
      const searchIndexes = await EnterpriseSemanticSearch.collection.getIndexes();
      expect(Object.keys(searchIndexes).some(key => key.includes('orgId') && key.includes('projectId'))).to.be.true;
    });
  });
});

// Export test runner
export default describe;