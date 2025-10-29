# Migration: Add Section and Course Fields

**Migration ID**: `20251028000000_add_section_and_course`
**Date**: October 28, 2025
**Type**: Schema Addition (Backward Compatible)

## Purpose

This migration adds two new optional fields to organize content by course and learning phase:
- **Section**: Categorizes content into Pre-Order, In-Order, or Post-Order phases
- **Course**: Associates content with specific courses (e.g., "System Design", "Product Management")

## Changes

### 1. New Enum: `Section`
```sql
CREATE TYPE "Section" AS ENUM ('PRE_ORDER', 'IN_ORDER', 'POST_ORDER');
```

### 2. ContentAssignment Table
- Added `section` (Section, nullable)
- Added `course` (TEXT, nullable)

### 3. Content Table
- Added `section` (Section, nullable)
- Added `course` (TEXT, nullable)

## Backward Compatibility ✅

### Safe for Existing Data
- ✅ All new fields are **optional (nullable)**
- ✅ No default values enforced on existing records
- ✅ Existing assignments continue to work without modification
- ✅ No data loss or corruption risk

### How Existing Data is Handled
| Scenario | Behavior |
|----------|----------|
| **Existing Assignments** | `section` and `course` will be `NULL` |
| **Existing Content** | `section` and `course` will be `NULL` |
| **New Assignments** | Admin can optionally set section and course |
| **Filtering** | NULL values included in "All" filter |
| **Display** | UI shows "-" or "Not Specified" for NULL |

### Migration Safety Checklist
- [x] No required fields added
- [x] No data transformation needed
- [x] No foreign key constraints added
- [x] All fields nullable
- [x] Enum type created before usage
- [x] No default values that affect existing data
- [x] Can be rolled back safely

## Rollback Plan

If needed, rollback can be done safely:

```sql
-- Remove columns from Content table
ALTER TABLE "Content"
  DROP COLUMN IF EXISTS "section",
  DROP COLUMN IF EXISTS "course";

-- Remove columns from ContentAssignment table
ALTER TABLE "ContentAssignment"
  DROP COLUMN IF EXISTS "section",
  DROP COLUMN IF EXISTS "course";

-- Drop enum type
DROP TYPE IF EXISTS "Section";
```

## Testing Checklist

Before deploying to production:

1. **Schema Validation**
   ```bash
   npx prisma validate
   ```

2. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

3. **Run Migration on Test Database**
   ```bash
   npx prisma migrate deploy
   ```

4. **Verify Existing Data**
   ```sql
   -- Check existing assignments still load
   SELECT COUNT(*) FROM "ContentAssignment";

   -- Check section column is nullable
   SELECT COUNT(*) FROM "ContentAssignment" WHERE "section" IS NULL;

   -- Check course column is nullable
   SELECT COUNT(*) FROM "ContentAssignment" WHERE "course" IS NULL;
   ```

5. **Test Application**
   - [ ] Existing assignments display correctly
   - [ ] Can create new assignments with section/course
   - [ ] Can create new assignments without section/course
   - [ ] Filters work with NULL values
   - [ ] Edit existing assignments to add section/course

## Expected Impact

### Before Migration
- Assignments have no section or course categorization
- Content cannot be filtered by section or course
- Analytics cannot group by course/section

### After Migration
- ✅ Existing assignments continue to work (NULL values)
- ✅ New assignments can include section and course
- ✅ Admins can edit old assignments to add section/course
- ✅ Better content organization and analytics
- ✅ No breaking changes to existing flows

## Next Steps

After successful migration:

1. **Update Backend APIs** to accept section and course in assignment creation
2. **Update Frontend Forms** to add section and course dropdowns
3. **Update Display Components** to show section and course badges
4. **Add Filters** for section and course in assignment list
5. **Update Analytics** to include course/section breakdowns
6. **Gradually Backfill** old assignments (optional, admin can do manually)

## Support

If issues arise:
1. Check Prisma client is regenerated: `npx prisma generate`
2. Check migration applied: `npx prisma migrate status`
3. Review logs for TypeScript errors
4. Rollback if needed (see Rollback Plan above)
