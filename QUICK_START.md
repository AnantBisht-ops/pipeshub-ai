# Quick Start - Multi-Tenancy Testing

## 🚀 Super Quick Setup (Copy & Paste)

### Terminal 1 - Backend
```bash
cd backend\nodejs\apps
set MONGODB_URI=mongodb://localhost:27017/es
set REDIS_URL=redis://localhost:6379
set MULTI_TENANT_ENABLED=true
set PORT=3000
npm run dev
```

### Terminal 2 - Frontend
```bash
cd frontend
set VITE_API_URL=http://localhost:3000
set VITE_ENABLE_MULTI_TENANCY=true
npm run dev
```

### Terminal 3 - Test Script
```bash
set MONGODB_URI=mongodb://localhost:27017/es
node test-multi-tenancy.js
```

Then choose **Option 1** for quick automated test.

---

## ✅ Expected Results

### Backend Terminal Should Show:
```
✅ Server started on port 3000
✅ Connected to MongoDB
✅ Connected to Redis
```

### Frontend Terminal Should Show:
```
➜  Local:   http://localhost:5173/
```

### Test Script Should Show:
```
✅ Multi-tenancy test PASSED!
Your multi-tenant setup is working correctly.
```

---

## 🌐 Open in Browser

http://localhost:5173

You should see:
- Organization switcher (top-left)
- Project selector (below organization)
- Ability to create new organizations and projects

---

## 🔍 Quick Verification Commands

### Check MongoDB Data:
```bash
mongosh mongodb://localhost:27017/es --eval "db.orgs.countDocuments(); db.projects.countDocuments()"
```

### Check Redis Cache:
```bash
docker exec -it redis redis-cli KEYS "mt:*"
```

### Check Backend Health:
```bash
curl http://localhost:3000/health
```

---

## 🐛 Troubleshooting

### Backend won't start?
```bash
# Check if port is in use
netstat -ano | findstr :3000

# Use different port
set PORT=3001
```

### Can't connect to MongoDB?
```bash
# Check if MongoDB container is running
docker ps | findstr mongodb

# Restart MongoDB
docker restart mongodb
```

### Frontend shows errors?
1. Make sure backend is running first
2. Check VITE_API_URL matches backend port
3. Clear browser cache (Ctrl+Shift+R)

---

## 📊 Interactive Test Menu

When you run `node test-multi-tenancy.js` and choose **Option 2**, you get:

```
1. Check existing data
2. Create test organization
3. Create test project
4. Create test user
5. Create test document
6. Run data isolation test
7. Verify multi-tenancy structure
8. View sample organization
9. View sample project
0. Exit
```

### Recommended Flow:
1. Option 1 → Check existing data
2. Option 2 → Create test organization (note the ID)
3. Option 3 → Create test project (use org ID from step 2)
4. Option 5 → Create test document (use org ID and project ID)
5. Option 7 → Verify everything is correct

---

## 🎯 What to Test in Browser

### Test 1: Create Organization
1. Click organization switcher (top-left)
2. Click "Create New Organization"
3. Fill: Name = "My Company", Type = "Business"
4. Click Create
5. ✅ Should see new organization in switcher

### Test 2: Create Project
1. Click project selector
2. Click "Create New Project"
3. Fill: Name = "Project Alpha"
4. Click Create
5. ✅ Should see new project in selector

### Test 3: Upload Document
1. Select "Project Alpha" from project selector
2. Go to Documents
3. Upload a test file
4. ✅ Document should appear

### Test 4: Test Isolation
1. Create another project: "Project Beta"
2. Upload different document to "Project Beta"
3. Switch to "Project Alpha"
4. ✅ Should ONLY see Alpha's documents
5. Select "All Projects"
6. ✅ Should see documents from both projects

---

## 📝 Test Checklist

**Before Testing:**
- [ ] Docker containers running
- [ ] MongoDB accessible (port 27017)
- [ ] Redis accessible (port 6379)

**Backend:**
- [ ] Backend starts without errors
- [ ] Can access http://localhost:3000/health
- [ ] Environment variables set correctly

**Frontend:**
- [ ] Frontend starts without errors
- [ ] Can access http://localhost:5173
- [ ] No console errors in browser

**Multi-Tenancy:**
- [ ] Test script passes (Option 1)
- [ ] Can create organizations
- [ ] Can create projects
- [ ] Can switch between organizations
- [ ] Can switch between projects
- [ ] Documents filter by project correctly
- [ ] Redis cache has keys (mt:*)

---

## 🎉 Success!

If all checkboxes are ✅, your multi-tenancy implementation is working perfectly!

**What You've Tested:**
- ✅ Organization management
- ✅ Project management
- ✅ Data isolation
- ✅ Context switching
- ✅ Backend APIs
- ✅ Frontend UI
- ✅ Database schema
- ✅ Redis caching

---

## 📚 Next Steps

1. Read [MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md) for detailed testing
2. Read [docs/MULTI_TENANCY_GUIDE.md](./docs/MULTI_TENANCY_GUIDE.md) for full documentation
3. Test with real user scenarios
4. Plan staging deployment

---

## 🆘 Need Help?

Check the detailed guides:
- **Full Testing Guide:** `MANUAL_TESTING_GUIDE.md`
- **User Guide:** `docs/MULTI_TENANCY_GUIDE.md`
- **API Migration:** `docs/MULTI_TENANCY_API_MIGRATION.md`
- **Troubleshooting:** See MANUAL_TESTING_GUIDE.md section