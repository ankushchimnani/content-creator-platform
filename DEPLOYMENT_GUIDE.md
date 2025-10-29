# Content Validation Platform - Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup & Migration](#database-setup--migration)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

### Required Software
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **PostgreSQL**: v14.x or higher
- **Git**: Latest version

### Required Accounts & API Keys
- **PostgreSQL Database**: Production database instance
- **OpenAI API Key**: For GPT-4 validation
- **Google Gemini API Key**: For dual LLM validation
- **Email Service**: SMTP credentials for notifications

---

## Environment Setup

### 1. Production Environment Variables

Create a `.env` file in the `apps/backend` directory with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# JWT Secret (MUST be different from development)
JWT_SECRET="your-production-jwt-secret-minimum-32-characters-long"

# API Keys
OPENAI_API_KEY="your-openai-api-key"
GEMINI_API_KEY="your-google-gemini-api-key"

# Email Configuration
SMTP_HOST="smtp.your-email-provider.com"
SMTP_PORT=587
SMTP_USER="your-smtp-username"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM_EMAIL="noreply@yourdomain.com"
SMTP_FROM_NAME="GUARD RAIL"

# Server Configuration
PORT=4000
NODE_ENV=production

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Frontend Environment Variables

Create a `.env` file in the `apps/frontend` directory:

```env
# Backend API URL (adjust based on your deployment)
VITE_API_URL="https://your-backend-domain.com"

# Environment
NODE_ENV=production
```

### Important Security Notes:
- **NEVER commit `.env` files to version control**
- Use different JWT secrets for development and production
- Rotate API keys regularly
- Use strong, unique passwords for database and SMTP

---

## Database Setup & Migration

### Step 1: Backup Current Database (If Applicable)

Before any database changes, always create a backup:

```bash
# Using pg_dump
pg_dump -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).dump

# Or using PostgreSQL tools
# Adjust connection details as needed
```

### Step 2: Review Database Schema

Check your current Prisma schema:

```bash
cd apps/backend
cat prisma/schema.prisma
```

Key models in the current schema:
- `User`: User management with roles (CREATOR, ADMIN, SUPER_ADMIN)
- `Content`: Content storage with review workflow
- `ContentAssignment`: Task assignments for creators
- `ValidationResult`: LLM validation results
- `PromptTemplate`: Customizable validation prompts
- `GuidelinesTemplate`: Content guidelines templates
- `LLMConfiguration`: LLM provider settings

### Step 3: Generate Prisma Client

```bash
cd apps/backend
npx prisma generate
```

### Step 4: Run Database Migrations

**For Fresh Database:**
```bash
npx prisma migrate deploy
```

**For Existing Database with Data:**
```bash
# First, check migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy

# If there are migration conflicts, resolve manually:
# 1. Review the migration SQL files in prisma/migrations/
# 2. Apply custom migrations if needed
# 3. Mark migrations as applied:
npx prisma migrate resolve --applied MIGRATION_NAME
```

### Step 5: Seed Initial Data (Optional)

If deploying for the first time, seed the database with initial data:

```bash
# Run seed script
npm run seed

# Or manually create super admin:
npm run seed:super-admin
```

**Default Super Admin Credentials** (Change immediately after first login):
- Email: `superadmin@example.com`
- Password: `SuperAdmin123!`

### Step 6: Verify Database Schema

```bash
# Check if all tables are created
npx prisma db pull

# Validate schema against database
npx prisma validate
```

---

## Backend Deployment

### Step 1: Clone Repository

```bash
git clone https://github.com/your-repo/content-creator-platform.git
cd content-creator-platform
```

### Step 2: Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd apps/backend
npm install
```

### Step 3: Build Backend

```bash
cd apps/backend
npm run build
```

This will:
- Compile TypeScript to JavaScript
- Output to `dist/` directory
- Include all necessary files for production

### Step 4: Start Production Server

**Option A: Using PM2 (Recommended for Production)**

```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Start the application
pm2 start npm --name "cvp-backend" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

**Option B: Using Node directly**

```bash
# From apps/backend directory
npm start
```

**Option C: Using Docker**

```bash
# Build Docker image
docker build -t cvp-backend -f apps/backend/Dockerfile .

# Run container
docker run -d \
  --name cvp-backend \
  --env-file apps/backend/.env \
  -p 4000:4000 \
  cvp-backend
```

### Step 5: Verify Backend is Running

```bash
# Check if server is responding
curl http://localhost:4000/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-XX-XX..."}
```

---

## Frontend Deployment

### Step 1: Install Dependencies

```bash
cd apps/frontend
npm install
```

### Step 2: Build Frontend

```bash
npm run build
```

This will:
- Bundle the React application
- Optimize assets and code
- Output to `dist/` directory

### Step 3: Deploy Frontend

**Option A: Static Hosting (Vercel, Netlify, etc.)**

```bash
# For Vercel
vercel --prod

# For Netlify
netlify deploy --prod
```

**Option B: Serve with Nginx**

1. Copy build files:
```bash
cp -r dist/* /var/www/cvp-frontend/
```

2. Configure Nginx (`/etc/nginx/sites-available/cvp-frontend`):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/cvp-frontend;
    index index.html;

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

3. Enable site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/cvp-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**Option C: Docker**

```bash
# Build Docker image
docker build -t cvp-frontend -f apps/frontend/Dockerfile .

# Run container
docker run -d \
  --name cvp-frontend \
  -p 3000:80 \
  cvp-frontend
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Backend health check
curl https://your-backend-domain.com/api/health

# Frontend accessibility
curl https://your-frontend-domain.com
```

### 2. Functional Testing

1. **Login Flow**:
   - Navigate to the frontend
   - Test login with super admin credentials
   - Verify JWT token is stored correctly

2. **User Management**:
   - Create a test admin user
   - Create a test creator user
   - Verify role-based access control

3. **Content Creation & Validation**:
   - Create a test assignment
   - Submit content for validation
   - Verify LLM validation works (both OpenAI and Gemini)
   - Check validation results are stored in database

4. **Email Notifications**:
   - Test password reset email
   - Test assignment notification email
   - Test content submission notification

5. **Super Admin Analytics**:
   - Navigate to Super Admin dashboard
   - Verify analytics load correctly
   - Check filters work (course, month, admin)
   - Verify charts display data accurately

### 3. Performance Testing

```bash
# Basic load testing with Apache Bench
ab -n 1000 -c 10 https://your-backend-domain.com/api/health

# Or use artillery for more comprehensive testing
npm install -g artillery
artillery quick --count 100 --num 10 https://your-backend-domain.com/api/health
```

### 4. Database Verification

```bash
# Connect to production database
psql $DATABASE_URL

# Check key tables
\dt

# Verify data integrity
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Content";
SELECT COUNT(*) FROM "ContentAssignment";
SELECT COUNT(*) FROM "ValidationResult";

# Exit psql
\q
```

---

## Rollback Procedures

### Database Rollback

**If Migration Fails:**

```bash
# Restore from backup
pg_restore -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -v backup_TIMESTAMP.dump

# Or using psql
psql $DATABASE_URL < backup_TIMESTAMP.sql
```

**If Need to Revert Specific Migration:**

```bash
# Mark migration as rolled back
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Manually run down migration SQL if available
# (Prisma doesn't support automatic rollback, manual SQL required)
```

### Application Rollback

**Using PM2:**

```bash
# Stop current version
pm2 stop cvp-backend

# Checkout previous working version
git checkout <previous-commit-hash>

# Rebuild and restart
cd apps/backend
npm install
npm run build
pm2 restart cvp-backend
```

**Using Docker:**

```bash
# Stop and remove current container
docker stop cvp-backend
docker rm cvp-backend

# Pull previous image version
docker pull cvp-backend:previous-tag

# Run previous version
docker run -d \
  --name cvp-backend \
  --env-file apps/backend/.env \
  -p 4000:4000 \
  cvp-backend:previous-tag
```

### Emergency Rollback Checklist

- [ ] Notify team of rollback
- [ ] Stop current application
- [ ] Restore database backup if needed
- [ ] Deploy previous stable version
- [ ] Verify functionality
- [ ] Document rollback reason
- [ ] Plan fix for next deployment

---

## Monitoring & Maintenance

### 1. Application Monitoring

**Using PM2:**

```bash
# View logs
pm2 logs cvp-backend

# Monitor application metrics
pm2 monit

# Check application status
pm2 status
```

**Log Locations:**
- Backend logs: `apps/backend/logs/` (if configured)
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`

### 2. Database Monitoring

```bash
# Monitor active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Monitor slow queries (if pg_stat_statements enabled)
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"
```

### 3. Performance Metrics to Monitor

- **API Response Times**: Track average response time for key endpoints
- **Database Query Performance**: Identify and optimize slow queries
- **Error Rates**: Monitor application errors and exceptions
- **Resource Usage**: CPU, memory, disk usage
- **LLM API Usage**: Track API calls and costs for OpenAI and Gemini

### 4. Regular Maintenance Tasks

**Daily:**
- [ ] Check application logs for errors
- [ ] Verify backup completion
- [ ] Monitor disk space

**Weekly:**
- [ ] Review error logs and fix issues
- [ ] Check database performance
- [ ] Verify email delivery
- [ ] Review API usage and costs

**Monthly:**
- [ ] Update dependencies (security patches)
- [ ] Review and optimize database indexes
- [ ] Rotate API keys if needed
- [ ] Archive old logs
- [ ] Performance testing

### 5. Database Backup Strategy

**Automated Daily Backups:**

```bash
# Create backup script (backup.sh)
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/cvp"
mkdir -p $BACKUP_DIR

pg_dump $DATABASE_URL -F c -b -v -f $BACKUP_DIR/backup_$TIMESTAMP.dump

# Keep only last 30 days of backups
find $BACKUP_DIR -type f -name "backup_*.dump" -mtime +30 -delete

# Add to crontab for daily execution at 2 AM
# 0 2 * * * /path/to/backup.sh >> /var/log/cvp-backup.log 2>&1
```

### 6. Security Recommendations

1. **Enable HTTPS**: Use Let's Encrypt or similar for SSL certificates
2. **Database Security**:
   - Use strong passwords
   - Restrict network access to database
   - Enable SSL for database connections
3. **API Security**:
   - Implement rate limiting (already configured)
   - Use CORS properly
   - Keep JWT secrets secure
4. **Regular Updates**: Keep all dependencies up to date
5. **Access Control**: Use principle of least privilege for all accounts

---

## Troubleshooting Common Issues

### Issue: Database Connection Fails

**Solution:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Verify connection string format
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL
```

### Issue: Backend Won't Start

**Solution:**
```bash
# Check for port conflicts
lsof -i :4000

# Review application logs
pm2 logs cvp-backend --lines 100

# Verify environment variables
node -e "console.log(process.env.DATABASE_URL ? 'DB URL set' : 'DB URL missing')"
```

### Issue: Frontend Can't Reach Backend

**Solution:**
1. Check CORS configuration in backend
2. Verify `VITE_API_URL` in frontend `.env`
3. Check network/firewall rules
4. Review Nginx proxy configuration

### Issue: LLM Validation Fails

**Solution:**
```bash
# Verify API keys are set
node -e "console.log(process.env.OPENAI_API_KEY ? 'OpenAI key set' : 'Missing')"
node -e "console.log(process.env.GEMINI_API_KEY ? 'Gemini key set' : 'Missing')"

# Check API key validity by testing directly
# (Use Postman or curl to test API keys with provider APIs)

# Review validation logs for specific error messages
```

---

## Contact & Support

For issues or questions during deployment:
- Check application logs first
- Review this deployment guide
- Contact system administrator
- Document any issues encountered for future reference

---

**Version**: 1.0
**Last Updated**: 2025-10-29
**Maintained By**: Development Team
