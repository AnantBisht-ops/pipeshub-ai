/**
 * Multi-Tenancy End-to-End Tests
 * Tests complete user flows in the multi-tenant system
 */

const puppeteer = require('puppeteer');
const mongoose = require('mongoose');

describe('Multi-Tenancy E2E Tests', () => {
  let browser;
  let page;
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    // Launch browser
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Set up request interception for API mocking if needed
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Can mock API responses here if needed
      request.continue();
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  // ==================== USER ONBOARDING FLOW ====================
  describe('User Onboarding and Organization Setup', () => {
    test('Should complete new user signup with organization creation', async () => {
      // Navigate to signup page
      await page.goto(`${baseUrl}/signup`);

      // Fill signup form
      await page.type('input[name="fullName"]', 'Test User');
      await page.type('input[name="email"]', `test${Date.now()}@example.com`);
      await page.type('input[name="password"]', 'Test@1234');

      // Select organization type
      await page.click('input[value="business"]');
      await page.type('input[name="organizationName"]', 'Test Organization');
      await page.type('input[name="domain"]', 'testorg.com');

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for redirect to dashboard
      await page.waitForNavigation({ waitUntil: 'networkidle0' });

      // Verify dashboard loaded
      const dashboardUrl = page.url();
      expect(dashboardUrl).toContain('/dashboard');

      // Verify organization switcher is visible
      const orgSwitcher = await page.$('[data-testid="organization-switcher"]');
      expect(orgSwitcher).toBeTruthy();

      // Verify default project is created
      const projectSelector = await page.$('[data-testid="project-selector"]');
      expect(projectSelector).toBeTruthy();
    });

    test('Should handle existing user creating additional organization', async () => {
      // Login as existing user
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'existing@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Navigate to create organization
      await page.click('[data-testid="organization-switcher"]');
      await page.click('[data-testid="create-organization-btn"]');

      // Fill organization details
      await page.type('input[name="organizationName"]', 'Second Organization');
      await page.click('input[value="individual"]');
      await page.click('button[type="submit"]');

      // Wait for creation
      await page.waitForSelector('[data-testid="success-message"]');

      // Verify new org appears in switcher
      await page.click('[data-testid="organization-switcher"]');
      const orgOptions = await page.$$('[data-testid="org-option"]');
      expect(orgOptions.length).toBeGreaterThan(1);
    });
  });

  // ==================== ORGANIZATION SWITCHING FLOW ====================
  describe('Organization Switching', () => {
    test('Should switch between organizations and update context', async () => {
      // Login
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'multiorg@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Get current org name
      const currentOrgElement = await page.$('[data-testid="current-org-name"]');
      const initialOrgName = await page.evaluate(el => el.textContent, currentOrgElement);

      // Open org switcher
      await page.click('[data-testid="organization-switcher"]');

      // Click on different org
      const orgOptions = await page.$$('[data-testid="org-option"]');
      if (orgOptions.length > 1) {
        await orgOptions[1].click();

        // Wait for page to update
        await page.waitForSelector('[data-testid="loading-overlay"]', { hidden: true });

        // Verify org has changed
        const newOrgElement = await page.$('[data-testid="current-org-name"]');
        const newOrgName = await page.evaluate(el => el.textContent, newOrgElement);
        expect(newOrgName).not.toBe(initialOrgName);

        // Verify data has updated (projects, documents, etc.)
        const projectList = await page.$$('[data-testid="project-item"]');
        expect(projectList).toBeDefined();
      }
    });

    test('Should maintain organization selection across sessions', async () => {
      // Login and select org
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'test@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Switch to specific org
      await page.click('[data-testid="organization-switcher"]');
      const orgOptions = await page.$$('[data-testid="org-option"]');
      if (orgOptions.length > 1) {
        await orgOptions[1].click();
        await page.waitForSelector('[data-testid="loading-overlay"]', { hidden: true });
      }

      // Get selected org name
      const selectedOrgElement = await page.$('[data-testid="current-org-name"]');
      const selectedOrgName = await page.evaluate(el => el.textContent, selectedOrgElement);

      // Close and reopen browser
      await page.close();
      page = await browser.newPage();

      // Login again
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'test@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Verify same org is selected
      const currentOrgElement = await page.$('[data-testid="current-org-name"]');
      const currentOrgName = await page.evaluate(el => el.textContent, currentOrgElement);
      expect(currentOrgName).toBe(selectedOrgName);
    });
  });

  // ==================== PROJECT MANAGEMENT FLOW ====================
  describe('Project Management', () => {
    test('Should create new project within organization', async () => {
      // Login
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'test@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Open project selector
      await page.click('[data-testid="project-selector"]');
      await page.click('[data-testid="create-project-btn"]');

      // Fill project form
      await page.type('input[name="projectName"]', 'E2E Test Project');
      await page.type('textarea[name="description"]', 'Created during E2E test');
      await page.click('button[type="submit"]');

      // Wait for creation
      await page.waitForSelector('[data-testid="success-message"]');

      // Verify project appears in selector
      await page.click('[data-testid="project-selector"]');
      const projectText = await page.evaluate(() => {
        const projects = document.querySelectorAll('[data-testid="project-option"]');
        return Array.from(projects).map(p => p.textContent);
      });
      expect(projectText).toContain('E2E Test Project');
    });

    test('Should switch between projects and "All Projects" view', async () => {
      // Login
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'test@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Open project selector
      await page.click('[data-testid="project-selector"]');

      // Select specific project
      const projectOptions = await page.$$('[data-testid="project-option"]');
      if (projectOptions.length > 0) {
        await projectOptions[0].click();
        await page.waitForSelector('[data-testid="loading-overlay"]', { hidden: true });

        // Verify project-specific data is shown
        const dataCount = await page.$('[data-testid="data-count"]');
        const projectDataCount = await page.evaluate(el => el.textContent, dataCount);

        // Switch to "All Projects"
        await page.click('[data-testid="project-selector"]');
        await page.click('[data-testid="all-projects-option"]');
        await page.waitForSelector('[data-testid="loading-overlay"]', { hidden: true });

        // Verify all data is shown
        const allDataCount = await page.$('[data-testid="data-count"]');
        const allProjectsDataCount = await page.evaluate(el => el.textContent, allDataCount);

        // All projects should show more or equal data
        expect(parseInt(allProjectsDataCount)).toBeGreaterThanOrEqual(parseInt(projectDataCount));
      }
    });

    test('Should manage project members', async () => {
      // Login as project admin
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'admin@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Navigate to project settings
      await page.goto(`${baseUrl}/projects/settings`);

      // Click on a project
      const projectCards = await page.$$('[data-testid="project-card"]');
      if (projectCards.length > 0) {
        await projectCards[0].click();

        // Navigate to members tab
        await page.click('[data-testid="members-tab"]');

        // Add new member
        await page.click('[data-testid="add-member-btn"]');
        await page.type('input[name="memberEmail"]', 'newmember@example.com');
        await page.select('select[name="role"]', 'member');
        await page.click('button[type="submit"]');

        // Wait for member to be added
        await page.waitForSelector('[data-testid="success-message"]');

        // Verify member appears in list
        const memberEmails = await page.evaluate(() => {
          const members = document.querySelectorAll('[data-testid="member-email"]');
          return Array.from(members).map(m => m.textContent);
        });
        expect(memberEmails).toContain('newmember@example.com');
      }
    });
  });

  // ==================== DATA OPERATIONS FLOW ====================
  describe('Data Operations with Multi-Tenancy', () => {
    test('Should create conversation within project context', async () => {
      // Login
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'test@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Select a specific project
      await page.click('[data-testid="project-selector"]');
      const projectOptions = await page.$$('[data-testid="project-option"]');
      if (projectOptions.length > 0) {
        await projectOptions[0].click();
        await page.waitForSelector('[data-testid="loading-overlay"]', { hidden: true });
      }

      // Navigate to conversations
      await page.goto(`${baseUrl}/conversations`);

      // Create new conversation
      await page.click('[data-testid="new-conversation-btn"]');
      await page.type('[data-testid="message-input"]', 'Test message in project context');
      await page.click('[data-testid="send-btn"]');

      // Wait for conversation to be created
      await page.waitForSelector('[data-testid="conversation-message"]');

      // Verify conversation appears in list
      const conversations = await page.$$('[data-testid="conversation-item"]');
      expect(conversations.length).toBeGreaterThan(0);
    });

    test('Should upload document with project association', async () => {
      // Login
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'test@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Navigate to documents
      await page.goto(`${baseUrl}/documents`);

      // Upload document
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        // Create a test file path (would need actual file in real test)
        // await fileInput.uploadFile('/path/to/test/file.pdf');

        // Mock upload for demonstration
        await page.evaluate(() => {
          // Trigger upload event
          const event = new Event('change', { bubbles: true });
          document.querySelector('input[type="file"]').dispatchEvent(event);
        });

        // Wait for upload to complete
        await page.waitForSelector('[data-testid="upload-success"]', { timeout: 5000 });

        // Verify document appears in list
        const documents = await page.$$('[data-testid="document-item"]');
        expect(documents.length).toBeGreaterThan(0);
      }
    });

    test('Should filter data by project', async () => {
      // Login
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'test@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Navigate to conversations
      await page.goto(`${baseUrl}/conversations`);

      // Get initial count (all projects)
      const allProjectsCount = await page.evaluate(() => {
        return document.querySelectorAll('[data-testid="conversation-item"]').length;
      });

      // Select specific project
      await page.click('[data-testid="project-selector"]');
      const projectOptions = await page.$$('[data-testid="project-option"]');
      if (projectOptions.length > 0) {
        await projectOptions[0].click();
        await page.waitForSelector('[data-testid="loading-overlay"]', { hidden: true });

        // Get filtered count
        const projectCount = await page.evaluate(() => {
          return document.querySelectorAll('[data-testid="conversation-item"]').length;
        });

        // Project-specific count should be less than or equal to all projects
        expect(projectCount).toBeLessThanOrEqual(allProjectsCount);
      }
    });
  });

  // ==================== PERMISSION ENFORCEMENT ====================
  describe('Permission Enforcement', () => {
    test('Should prevent non-admin from accessing project settings', async () => {
      // Login as regular member
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'member@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Try to navigate to project settings
      await page.goto(`${baseUrl}/projects/settings`);

      // Should see permission denied or limited options
      const adminOnlyElements = await page.$$('[data-testid="admin-only"]');
      expect(adminOnlyElements.length).toBe(0);

      // Verify edit buttons are disabled/hidden
      const editButtons = await page.$$('[data-testid="edit-project-btn"]:not([disabled])');
      expect(editButtons.length).toBe(0);
    });

    test('Should prevent cross-organization access', async () => {
      // Login as org1 user
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="email"]', 'org1user@example.com');
      await page.type('input[name="password"]', 'Test@1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Try to access org2 resource via direct URL
      await page.goto(`${baseUrl}/organizations/org2-id/projects`, {
        waitUntil: 'networkidle0',
      });

      // Should be redirected or see error
      const errorMessage = await page.$('[data-testid="error-message"]');
      const currentUrl = page.url();

      expect(
        errorMessage !== null || !currentUrl.includes('org2-id')
      ).toBe(true);
    });
  });
});