# Phase 1: Database Schema Deployment Guide

## 📋 Summary of Changes

We've successfully added **Section** and **Course** fields to organize content assignments:

### What Was Added:
1. ✅ **New Enum**: `Section` (PRE_ORDER, IN_ORDER, POST_ORDER)
2. ✅ **ContentAssignment table**: Added `section` and `course` (both optional)
3. ✅ **Content table**: Added `section` and `course` (both optional)

### Backward Compatibility:
- ✅ **100% Safe** - All fields are optional (nullable)
- ✅ Existing assignments continue to work without any changes
- ✅ No data loss or corruption risk
- ✅ Can rollback if needed

---

## 🚀 Deployment Steps

### Step 1: Verify Schema Changes
```bash
cd apps/backend
npx prisma validate
```
**Expected Output**: ✅ "The schema is valid"

### Step 2: Generate Prisma Client
```bash
npx prisma generate
```
**Expected Output**: ✅ "Generated Prisma Client"

### Step 3: Check Current Migration Status (Optional)
```bash
npx prisma migrate status
```
This shows which migrations are already applied.

### Step 4: Apply Migration

**Option A: Using Prisma Migrate (Recommended for Development)**
```bash
npx prisma migrate deploy
```

**Option B: Using Direct SQL (For Production)**
```bash
# Execute the migration file directly on your database
psql $DATABASE_URL -f prisma/migrations/20251028000000_add_section_and_course/migration.sql
```

**Expected Output**:
```
Applying migration `20251028000000_add_section_and_course`
✓ Applied migration successfully
```

### Step 5: Verify Migration Success
```bash
# Check migration status
npx prisma migrate status

# Should show:
# Database schema is up to date!
```

### Step 6: Verify Data Integrity

Run these queries in your database to confirm:

```sql
-- Check that existing assignments still exist and work
SELECT COUNT(*) FROM "ContentAssignment";

-- Check that new columns exist and are nullable
SELECT
  COUNT(*) as total,
  COUNT("section") as with_section,
  COUNT("course") as with_course
FROM "ContentAssignment";

-- Should show: total > 0, with_section = 0, with_course = 0
-- This confirms existing data is unaffected
```

### Step 7: Restart Backend Server
```bash
# Stop current backend
# Then start again
npm run dev
```

**Check logs**: Should start without errors

---

## ✅ Verification Checklist

After deployment, verify these:

- [ ] Backend starts without errors
- [ ] Existing assignments still load in Admin dashboard
- [ ] Can view existing assignments without issues
- [ ] No TypeScript compilation errors
- [ ] API endpoints respond correctly
- [ ] Database queries work as expected

---

## 🧪 Testing Commands

### Test 1: Schema Validation
```bash
npx prisma validate
```
✅ Should pass

### Test 2: Check Database Connection
```bash
npx prisma db pull
```
✅ Should connect successfully

### Test 3: Verify Types Generated
```bash
# Check that Section enum is available
grep -r "Section" node_modules/.prisma/client/index.d.ts
```
✅ Should find Section enum

---

## 📊 Expected Database State

### Before Migration:
```
ContentAssignment
├── id
├── topic
├── guidelines
├── ... (other existing fields)
```

### After Migration:
```
ContentAssignment
├── id
├── topic
├── guidelines
├── ... (other existing fields)
├── section (nullable) ← NEW
└── course (nullable)  ← NEW
```

**All existing records**: `section = NULL`, `course = NULL`

---

## 🔄 Rollback Plan (If Needed)

If something goes wrong, rollback is safe and simple:

### Step 1: Create Rollback Migration
Create: `prisma/migrations/20251028000001_rollback_section_course/migration.sql`

```sql
-- Rollback: Remove section and course fields

ALTER TABLE "Content"
  DROP COLUMN IF EXISTS "section",
  DROP COLUMN IF EXISTS "course";

ALTER TABLE "ContentAssignment"
  DROP COLUMN IF EXISTS "section",
  DROP COLUMN IF EXISTS "course";

DROP TYPE IF EXISTS "Section";
```

### Step 2: Apply Rollback
```bash
psql $DATABASE_URL -f prisma/migrations/20251028000001_rollback_section_course/migration.sql
```

### Step 3: Revert Schema File
```bash
git checkout HEAD -- prisma/schema.prisma
npx prisma generate
```

---

## 🐛 Troubleshooting

### Issue: "Type 'Section' already exists"
**Solution**: The enum was already created. Safe to ignore or drop and recreate:
```sql
DROP TYPE IF EXISTS "Section" CASCADE;
-- Then rerun migration
```

### Issue: "Column already exists"
**Solution**: Migration was partially applied. Check which columns exist:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'ContentAssignment';
```
Then modify migration to skip existing columns.

### Issue: Backend won't start after migration
**Solution**:
1. Check Prisma client is regenerated: `npx prisma generate`
2. Check for TypeScript errors: `npm run build`
3. Clear node_modules if needed: `rm -rf node_modules && npm install`

### Issue: Old assignments don't load
**Solution**: Check if nullable fields are handled in queries. Should be fine since they're optional.

---

## 📈 What's Next (Future Phases)

After successful deployment:

### Phase 2: Assignment Form Updates (Next Session)
- Add Section dropdown in create/edit form
- Add Course dropdown (filtered by creator's courses)
- Update form validation

### Phase 3: Display Updates
- Show section/course badges in assignment cards
- Add filters for section/course
- Update assignment details view

### Phase 4: Notifications
- Email notifications for task assignment
- Email notifications for submissions
- Email notifications for approvals/rejections

### Phase 5: Analytics
- Course-wise metrics
- Section-wise distribution
- Enhanced reporting

---

## 💾 Backup Recommendation

Before deploying to production:

```bash
# Backup database (PostgreSQL example)
pg_dump $DATABASE_URL > backup_before_section_migration_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_*.sql
```

---

## 📞 Support

If you encounter issues:
1. Check this guide's Troubleshooting section
2. Verify migration file syntax
3. Check database logs
4. Can safely rollback using Rollback Plan above

---

## ✨ Success Criteria

Deployment is successful when:
- ✅ Migration applied without errors
- ✅ Backend starts successfully
- ✅ Existing assignments still load
- ✅ No data loss
- ✅ Ready for Phase 2 (form updates)

---

**Created**: October 28, 2025
**Migration ID**: 20251028000000_add_section_and_course
**Status**: Ready for Deployment ✅
