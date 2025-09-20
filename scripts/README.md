# User Onboarding Scripts

This directory contains utility scripts for managing users in the Content Validation Platform.

## User Onboarding Script

The `onboard-users.js` script allows you to create multiple users with their email, password, and role in bulk.

### Setup

1. **Install dependencies:**
   ```bash
   cd scripts
   npm install
   ```

2. **Set your database URL:**
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/contentdb"
   ```
   
   Or modify the `DATABASE_URL` variable directly in the script.

### Usage

1. **Edit the user data:**
   Open `onboard-users.js` and modify the `USERS_TO_CREATE` array with your actual users:

   ```javascript
   const USERS_TO_CREATE = [
     {
       email: 'admin@yourcompany.com',
       password: 'securepassword123',
       name: 'Admin User',
       role: 'ADMIN'
     },
     {
       email: 'creator1@yourcompany.com',
       password: 'securepassword123',
       name: 'Creator One',
       role: 'CREATOR'
     },
     // Add more users...
   ];
   ```

2. **Run the script:**
   ```bash
   npm run onboard
   ```

   Or directly:
   ```bash
   node onboard-users.js
   ```

### Features

- ✅ **Bulk user creation** with email, password, and role
- ✅ **Password hashing** using bcryptjs
- ✅ **Duplicate prevention** - skips users that already exist
- ✅ **Admin-Creator assignments** - automatically assigns creators to admins
- ✅ **Error handling** - continues processing even if some users fail
- ✅ **Detailed logging** - shows progress and results
- ✅ **Summary report** - displays all created users at the end

### User Roles

- **ADMIN**: Can review content, create tasks, and manage creators
- **CREATOR**: Can create content, view assigned tasks, and submit for review

### Admin-Creator Assignments

You can specify which creators should be assigned to which admins by modifying the `CREATOR_ADMIN_ASSIGNMENTS` object:

```javascript
const CREATOR_ADMIN_ASSIGNMENTS = {
  'creator1@example.com': 'admin@example.com',  // creator1 assigned to admin
  'creator2@example.com': 'admin2@example.com'  // creator2 assigned to admin2
};
```

### Example Output

```
🚀 Starting user onboarding process...

✅ Created admin: admin@example.com (ID: 1)
✅ Created creator: creator1@example.com (ID: 2)
✅ Created creator: creator2@example.com (ID: 3)
✅ Created admin: admin2@example.com (ID: 4)

🔗 Assigning creators to admins...
✅ Assigned creator1@example.com to admin@example.com
✅ Assigned creator2@example.com to admin2@example.com

🎉 User onboarding completed!

📋 Summary:
Users created:
  - admin@example.com (ADMIN)
  - creator1@example.com (CREATOR) (assigned to Admin User)
  - creator2@example.com (CREATOR) (assigned to Admin Two)
  - admin2@example.com (ADMIN)
```

### Security Notes

- Passwords are automatically hashed using bcryptjs
- The script skips users that already exist to prevent duplicates
- Database connection uses the same Prisma client as the main application
- All sensitive data should be handled securely in production environments

### Troubleshooting

- **Database connection issues**: Verify your `DATABASE_URL` is correct
- **Permission errors**: Ensure the database user has CREATE and UPDATE permissions
- **Duplicate users**: The script automatically skips existing users
- **Missing dependencies**: Run `npm install` in the scripts directory
