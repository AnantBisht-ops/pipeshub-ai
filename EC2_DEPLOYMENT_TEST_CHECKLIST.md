# EC2 Deployment & Testing Checklist

## Pre-Deployment Verification ✅

### Code Verification (Local)
- ✅ Multi-tenancy routes imported in app.ts (lines 15-16)
- ✅ Organization management controller exists
- ✅ Project management controller exists
- ✅ User schema has `organizations` array support
- ✅ TypeScript compilation successful (no errors)
- ✅ Desktop extension flow implemented with `?source=extension`
- ✅ Pushed to GitHub: feature/desktop-oauth-flow branch

---

## EC2 Deployment Steps

### Step 1: Pull Latest Code

```bash
ssh -i openanalyst-web.pem ubuntu@51.20.239.3

cd ~/pipeshub-ai
git fetch origin
git checkout feature/desktop-oauth-flow
git reset --hard origin/feature/desktop-oauth-flow
git status  # Should show "up to date"
```

**Verify:** Should show commit `41834683`

---

### Step 2: Build Backend

```bash
cd ~/pipeshub-ai/backend/nodejs/apps
npm install
npm run build
```

**Expected:** Build completes with no errors

---

### Step 3: Build Docker Image from Source (CRITICAL!)

```bash
cd ~/pipeshub-ai

# This builds from YOUR source code, not Docker Hub
docker build -t pipeshubai/pipeshub-ai:latest -f Dockerfile .
```

**Expected:**
- Takes 5-10 minutes
- Completes successfully
- Shows "Successfully tagged pipeshubai/pipeshub-ai:latest"

**Why this is critical:**
- Without this, Docker uses OLD image from Docker Hub
- OLD image doesn't have multi-tenancy or desktop OAuth code

---

### Step 4: Deploy Containers

```bash
cd ~/pipeshub-ai/deployment/docker-compose

# Stop containers
docker-compose -f docker-compose.prod.yml down

# Start with new image
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps
```

**Expected:** All containers show "Up" or "healthy"

---

### Step 5: Verify Container Has New Code

```bash
# Check which code version is running
docker exec pipeshub-ai ls -la /app/backend/dist/modules/ | grep -E "(org_management|project_management)"
```

**Expected:** Should show:
```
drwxr-xr-x org_management
drwxr-xr-x project_management
```

**If these don't exist:** The Docker image wasn't built from source. Go back to Step 3.

---

### Step 6: Check Logs

```bash
docker-compose -f docker-compose.prod.yml logs --tail=100 pipeshub-ai | grep -i "error\|failed"
```

**Expected:** No MongoDB connection errors, no "already an organization" errors

---

## Testing Checklist

### Test 1: Multi-Tenancy - Create New Organization ✓

```bash
# Test creating a new organization (should work now!)
curl -X POST https://web.openanalyst.com/api/v1/org \
  -H "Content-Type: application/json" \
  -d '{
    "contactEmail": "neworg@test.com",
    "registeredName": "Test Organization 2",
    "adminFullName": "Test Admin",
    "sendEmail": false
  }'
```

**Expected:**
- ✅ Status: 201 Created
- ✅ Returns organization data with slug, orgId, etc.

**Previously Failed With:**
- ❌ "There is already an organization" error
- This proves multi-tenancy is working!

---

### Test 2: Web Authentication Flow (No Source) ✓

```bash
# Step 1: Init auth (no source parameter)
curl -X POST https://web.openanalyst.com/api/v1/userAccount/initAuth \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}' \
  -v
```

**Expected:**
- Status: 200
- Returns: `x-session-token` header
- Returns: `allowedMethods` array

```bash
# Step 2: Authenticate (use session token from step 1)
curl -X POST https://web.openanalyst.com/api/v1/userAccount/authenticate \
  -H "Content-Type: application/json" \
  -H "x-session-token: YOUR_SESSION_TOKEN_HERE" \
  -d '{
    "method": "password",
    "credentials": {"password": "YourPassword123!"}
  }'
```

**Expected:**
- Status: 200
- Content-Type: application/json
- Response body:
  ```json
  {
    "message": "Fully authenticated",
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
  ```

**This proves:** Web flow still works normally!

---

### Test 3: Extension Authentication Flow (source=extension) ✓

```bash
# Step 1: Init auth WITH source=extension
curl -X POST 'https://web.openanalyst.com/api/v1/userAccount/initAuth?source=extension' \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}' \
  -v
```

**Expected:**
- Status: 200
- Returns: `x-session-token` header
- Session should have `source: "extension"` stored

```bash
# Step 2: Authenticate (use session token from step 1)
curl -X POST https://web.openanalyst.com/api/v1/userAccount/authenticate \
  -H "Content-Type: application/json" \
  -H "x-session-token: YOUR_SESSION_TOKEN_HERE" \
  -d '{
    "method": "password",
    "credentials": {"password": "YourPassword123!"}
  }' \
  -v
```

**Expected:**
- Status: 200
- Content-Type: text/html
- Response body: HTML page with:
  - "Authentication Successful!" heading
  - Green checkmark icon
  - "Open OpenAnalyst" button
  - Link to: `openanalyst://auth/callback?token=...`
  - Auto-redirect JavaScript

**This proves:** Extension flow returns HTML redirect page!

---

### Test 4: Browser Test - Extension Flow 🌐

**Manual Browser Test:**

1. Open browser to: `https://web.openanalyst.com/auth/signin?source=extension`
2. Sign in with test account
3. After successful auth, you should see:
   - Beautiful HTML page
   - "Authentication Successful!" heading
   - Green ✓ checkmark
   - "Open OpenAnalyst" button
   - Info box about desktop app
4. Browser will try to open `openanalyst://` URL
5. You'll see "No app found" (expected - desktop app not installed)

**This proves:** The full extension flow works end-to-end!

---

### Test 5: Browser Test - Web Flow 🌐

**Manual Browser Test:**

1. Open browser to: `https://web.openanalyst.com/auth/signin` (NO source parameter)
2. Sign in with test account
3. After successful auth, you should be redirected to dashboard (normal web flow)

**Expected:** Normal web app behavior, no desktop redirect page

**This proves:** Web flow is not broken!

---

### Test 6: Multi-Organization Support ✓

```bash
# Create a second organization
curl -X POST https://web.openanalyst.com/api/v1/org \
  -H "Content-Type: application/json" \
  -d '{
    "contactEmail": "org2@test.com",
    "registeredName": "Second Organization",
    "adminFullName": "Admin Two"
  }'
```

**Expected:**
- ✅ Status: 201
- ✅ No "already an organization" error
- ✅ Returns different orgId than first org

**Then test extension auth** for a user with multiple orgs:

The JWT payload should include ALL organizations in the `organizations` array.

---

## Success Criteria

All tests must pass:
- ✅ Build succeeds with no TypeScript errors
- ✅ Multi-tenancy endpoints exist in container
- ✅ Can create multiple organizations
- ✅ Web flow returns JSON (backward compatible)
- ✅ Extension flow returns HTML redirect
- ✅ JWT includes all user organizations
- ✅ No MongoDB connection errors
- ✅ No "already an organization" errors

---

## Common Issues & Fixes

### Issue: "There is already an organization"
**Cause:** Docker image not built from source
**Fix:** Run `docker build` command from Step 3

### Issue: 404 on /api/v1/organizations
**Cause:** Routes not registered or old image
**Fix:** Rebuild Docker image from source

### Issue: Extension flow returns JSON instead of HTML
**Cause:** Session source parameter not preserved
**Fix:** Check initAuth logs, verify source is stored in session

### Issue: MongoDB "Authentication failed"
**Cause:** MONGO_URI in docker-compose is wrong
**Fix:** Ensure docker-compose.prod.yml has `- MONGO_URI=${MONGO_URI}`

---

## Deployment Confirmation

After deployment, verify with:

```bash
# Check what's actually running
docker exec pipeshub-ai cat /app/backend/package.json | grep version

# Check routes
curl https://web.openanalyst.com/api/v1/organizations

# Should NOT return 404
```

---

## Next Steps After Successful Deployment

1. Share with desktop team:
   - URL format: `https://web.openanalyst.com/auth/signin?source=extension`
   - JWT secret for token decoding
   - DESKTOP_AUTH_API.md documentation

2. Update frontend (later):
   - Add logic to differentiate web vs extension
   - Currently all web users see extension flow (temporary)

---

**Created:** 2025-12-23
**Branch:** feature/desktop-oauth-flow
**Commit:** 41834683
