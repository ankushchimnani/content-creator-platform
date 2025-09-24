# Content Validation Platform - Deployment Guide

## 🚀 Production Deployment Checklist

### ✅ **Ready for Deployment**

1. **API Configuration** ✅
   - Environment-aware API base URLs configured
   - Development: `http://localhost:4000`
   - Production: `http://43.205.238.172:4000` (or your domain)
   - Environment variable support: `VITE_API_BASE_URL`

2. **CORS Configuration** ✅
   - Production domains whitelisted:
     - `https://content-creators.masaischool.com`
     - `https://content-api.masaischool.com`
   - Localhost allowed for development
   - Proper headers and methods configured

3. **Database Configuration** ✅
   - PostgreSQL with Prisma ORM
   - Environment variable: `DATABASE_URL`
   - Docker container ready for local development

4. **Build Scripts** ✅
   - Frontend: `npm run build` (TypeScript + Vite)
   - Backend: `npm run build` (TypeScript compilation)
   - Production start: `npm start`

5. **Security** ✅
   - Helmet.js for security headers
   - JWT authentication with configurable secret
   - Password hashing with bcrypt
   - CORS protection

### ⚠️ **Required for Production**

1. **Environment Variables** (Create `.env` file)
   ```bash
   # Database
   DATABASE_URL="postgresql://user:password@host:port/database"
   
   # Security
   JWT_SECRET="your-super-secret-jwt-key"
   
   # AI APIs (optional)
   OPENAI_API_KEY="your-openai-key"
   GEMINI_API_KEY="your-gemini-key"
   
   # Server
   PORT=4000
   NODE_ENV=production
   ```

2. **SSL/HTTPS Configuration**
   - Configure SSL certificates
   - Update CORS origins to use HTTPS
   - Update API base URL to use HTTPS

3. **Domain Configuration**
   - Update `VITE_API_BASE_URL` to your production domain
   - Configure DNS for your domains
   - Update CORS allowed origins

### 🐳 **Docker Deployment**

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Build and run backend
cd apps/backend
npm run build
npm start

# Build frontend
cd apps/frontend
npm run build
# Serve with nginx/apache or static hosting
```

### 🌐 **Production URLs**

- **Frontend**: `https://content-creators.masaischool.com`
- **Backend API**: `https://content-api.masaischool.com`
- **Health Check**: `https://content-api.masaischool.com/health`

### 📋 **Deployment Steps**

1. **Setup Environment**
   ```bash
   # Create production .env file
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Database Setup**
   ```bash
   # Run migrations
   npx prisma migrate deploy
   # Generate Prisma client
   npx prisma generate
   ```

3. **Build Applications**
   ```bash
   # Build backend
   cd apps/backend && npm run build
   
   # Build frontend
   cd apps/frontend && npm run build
   ```

4. **Deploy**
   - Deploy backend to your server
   - Deploy frontend to static hosting/CDN
   - Configure reverse proxy (nginx/apache)
   - Setup SSL certificates

### 🔧 **Configuration Files**

- **Backend**: `apps/backend/src/index.ts` (CORS, port, security)
- **Frontend**: `apps/frontend/src/utils/api.ts` (API base URL)
- **Database**: `apps/backend/prisma/schema.prisma`
- **Docker**: `docker-compose.yml`

### 🚨 **Security Notes**

- Change default JWT secret in production
- Use strong database passwords
- Enable HTTPS in production
- Regularly update dependencies
- Monitor logs and errors

### 📊 **Monitoring**

- Health check endpoint: `/health`
- Logging with Pino logger
- Error handling with proper HTTP status codes
- Database connection monitoring

---

**Status**: ✅ **READY FOR DEPLOYMENT** (with environment configuration)
