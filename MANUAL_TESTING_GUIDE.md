# Multi-Tenancy Manual Testing Guide

## Setup Instructions

### Prerequisites
- Docker running (MongoDB + Redis)
- Node.js installed
- No Python required!

---

## Step 1: Start Databases

Make sure your databases are running in Docker:

```bash
# Check if containers are running
docker ps

# You should see MongoDB and Redis containers
# If not running, start them:
docker-compose up -d mongodb redis
```

Verify connections:
```bash
# Test MongoDB
docker exec -it mongodb mongosh --eval "db.version()"

# Test Redis
docker exec -it redis redis-cli ping
```

---

## Step 2: Setup Backend

### Terminal 1 - Backend Node.js

```bash
# Navigate to backend directory
cd backend/nodejs/apps

# Install dependencies (if not already done)
npm install

# Set environment variables
set MONGODB_URI=mongodb://localhost:27017/es
set REDIS_URL=redis://localhost:6379
set MULTI_TENANT_ENABLED=true
set PORT=3000

# Start the backend server
npm run dev
# OR
node src/app.js
```

You should see:
```
✅ Server started on port 3000
✅ Connected to MongoDB
✅ Connected to Redis
```

**Keep this terminal running!**

---

## Step 3: Setup Frontend

### Terminal 2 - Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if not already done)
npm install

# Set environment variables
set VITE_API_URL=http://localhost:3000
set VITE_ENABLE_MULTI_TENANCY=true

# Start the frontend
npm run dev
```

You should see:
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Keep this terminal running!**

---

## Step 4: Run Multi-Tenancy Test Script

### Terminal 3 - Testing

```bash
# Navigate to project root
cd C:\Users\Rishabh\Desktop\pipeshub-ai

# Set MongoDB URI
set MONGODB_URI=mongodb://localhost:27017/es

# Run the test script
node test-multi-tenancy.js
```

### Interactive Testing Menu

You'll see:
```
╔══════════════════════════════════════════════════════╗
║     MULTI-TENANCY TESTING TOOL                      ║
╚══════════════════════════════════════════════════════╝

📊 Connecting to MongoDB...
✅ Connected to MongoDB

🔍 Checking existing data...
  Organizations: 0
  Users: 0
  Projects: 0
  Documents: 0
  Conversations: 0

🎯 Testing Mode:
1. Quick test (automatic)
2. Interactive menu

Select mode (1 or 2):
```

---

## Step 5: Quick Automated Test

Choose **Option 1** for quick test:

```bash
Select mode (1 or 2): 1
```

This will:
1. ✅ Create a test organization
2. ✅ Create a test project
3. ✅ Create a test user
4. ✅ Create a test document
5. ✅ Verify multi-tenancy structure

Expected output:
```
📦 Creating test organization...
✅ Created organization: Test Organization (64abc123...)

📁 Creating test project...
✅ Created project: Test Project (64abc456...)

👤 Creating test user...
✅ Created user: testuser@test.com (64abc789...)

📄 Creating test document...
✅ Created document: Test Document (64abcabc...)

✓ Verifying multi-tenancy structure...
✅ All organizations have settings
✅ All projects have orgId
✅ All documents have orgId
✅ All documents have projectId
✅ All users have organizations array

✅ Multi-tenancy test PASSED!
Your multi-tenant setup is working correctly.
```

---

## Step 6: Manual Frontend Testing

### Open Browser: http://localhost:5173

### Test 1: Organization Switcher
1. Log in to the application
2. Look for organization switcher in the top-left corner
3. Click it to see available organizations
4. Select "Create New Organization"
5. Fill in details and create

**Expected:** Organization switcher shows the new organization

### Test 2: Project Creation
1. Click the project selector (below organization switcher)
2. Click "Create New Project"
3. Enter project name: "My Test Project"
4. Set privacy: Public
5. Click "Create"

**Expected:** New project appears in the project list

### Test 3: Document Upload in Project Context
1. Select your test project from project selector
2. Go to Documents page
3. Upload a test document
4. Verify it appears in the documents list

### Test 4: Project Isolation
1. Create another project: "Second Project"
2. Upload a document to "Second Project"
3. Switch back to "My Test Project"
4. **Expected:** Only "My Test Project" documents are visible

### Test 5: All Projects View
1. Click project selector
2. Select "All Projects"
3. **Expected:** Documents from all projects are visible

---

## Step 7: API Testing with Postman/Thunder Client

### Test Organization API

**GET Organizations:**
```http
GET http://localhost:3000/api/organizations
Authorization: Bearer YOUR_TOKEN
```

**Create Organization:**
```http
POST http://localhost:3000/api/organizations
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "API Test Org",
  "type": "business",
  "domain": "apitest.com"
}
```

### Test Projects API

**GET Projects:**
```http
GET http://localhost:3000/api/organizations/:orgId/projects
Authorization: Bearer YOUR_TOKEN
X-Organization-Id: YOUR_ORG_ID
```

**Create Project:**
```http
POST http://localhost:3000/api/organizations/:orgId/projects
Authorization: Bearer YOUR_TOKEN
X-Organization-Id: YOUR_ORG_ID
Content-Type: application/json

{
  "name": "API Test Project",
  "description": "Created via API",
  "isPrivate": false
}
```

### Test Documents with Project Context

**GET Documents (filtered by project):**
```http
GET http://localhost:3000/api/documents?projectId=YOUR_PROJECT_ID
Authorization: Bearer YOUR_TOKEN
X-Organization-Id: YOUR_ORG_ID
X-Project-Id: YOUR_PROJECT_ID
```

**Create Document:**
```http
POST http://localhost:3000/api/documents
Authorization: Bearer YOUR_TOKEN
X-Organization-Id: YOUR_ORG_ID
X-Project-Id: YOUR_PROJECT_ID
Content-Type: application/json

{
  "name": "API Test Document",
  "content": "Test content",
  "projectId": "YOUR_PROJECT_ID"
}
```

---

## Step 8: Database Verification

### Using MongoDB Compass or mongosh

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/es

# Check organizations
db.orgs.find().pretty()

# Check projects
db.projects.find().pretty()

# Check if documents have projectId
db.documents.find({}, { documentName: 1, orgId: 1, projectId: 1 }).pretty()

# Check if users have organizations array
db.users.find({}, { email: 1, organizations: 1, defaultOrgId: 1 }).pretty()

# Verify data isolation - this should return 0
db.documents.find({
  $expr: {
    $ne: [
      { $arrayElemAt: [{ $objectToArray: "$orgId" }, 0] },
      { $arrayElemAt: [{ $objectToArray: { $arrayElemAt: ["$projectId", 0] } }, 0] }
    ]
  }
}).count()
```

---

## Step 9: Redis Cache Verification

```bash
# Connect to Redis
docker exec -it redis redis-cli

# Check cached keys
KEYS mt:*

# Check cache for an organization
GET mt:org:YOUR_ORG_ID

# Check cache statistics
INFO stats

# Check cache hit rate
INFO stats | grep keyspace_hits
INFO stats | grep keyspace_misses
```

---

## Common Issues & Solutions

### Issue 1: Backend won't start
**Solution:**
```bash
# Check if port 3000 is already in use
netstat -ano | findstr :3000

# Kill the process or use a different port
set PORT=3001
npm run dev
```

### Issue 2: MongoDB connection error
**Solution:**
```bash
# Verify MongoDB is running
docker ps | findstr mongodb

# Check logs
docker logs mongodb

# Restart if needed
docker restart mongodb
```

### Issue 3: Frontend can't connect to backend
**Solution:**
```bash
# Check backend is running on correct port
curl http://localhost:3000/health

# Verify VITE_API_URL in frontend
echo %VITE_API_URL%

# Should be: http://localhost:3000
```

### Issue 4: No organizations showing up
**Solution:**
```bash
# Run the test script to create sample data
node test-multi-tenancy.js

# Choose option 1 for quick test
# Or use option 2 to create manually
```

---

## Quick Verification Checklist

- [ ] Docker containers running (MongoDB, Redis)
- [ ] Backend running on http://localhost:3000
- [ ] Frontend running on http://localhost:5173
- [ ] Can access frontend in browser
- [ ] Can create organization
- [ ] Can create project
- [ ] Can switch between organizations
- [ ] Can switch between projects
- [ ] Documents show correct project context
- [ ] Cache is working (check Redis keys)

---

## Test Data Cleanup

If you want to start fresh:

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/es

# Drop test data (CAREFUL!)
db.orgs.deleteMany({ slug: /^test-org/ })
db.projects.deleteMany({ slug: /^test-project/ })
db.users.deleteMany({ email: /^testuser/ })
db.documents.deleteMany({ documentName: /^Test Document/ })

# Clear Redis cache
docker exec -it redis redis-cli FLUSHDB
```

---

## Success Criteria

✅ **You've successfully tested multi-tenancy if:**

1. You can create and switch between organizations
2. You can create and switch between projects
3. Documents are properly filtered by project
4. Data from one organization doesn't appear in another
5. Cache is working (Redis keys exist)
6. All APIs respond with proper headers
7. Database has correct schema (orgId, projectId fields)

---

## Next Steps

Once testing is complete:
1. Review any issues found
2. Test with real user data (carefully!)
3. Run performance benchmarks (optional)
4. Deploy to staging environment
5. Plan production migration

---

## Support

If you encounter issues:
1. Check the logs in Terminal 1 (backend)
2. Check browser console (F12)
3. Review MULTI_TENANCY_GUIDE.md for troubleshooting
4. Check MongoDB/Redis are accessible

**Happy Testing! 🚀**