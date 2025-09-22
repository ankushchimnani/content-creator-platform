# Development Setup

## Environment Configuration

The frontend automatically detects the environment and uses appropriate API endpoints:

### Automatic Environment Detection:
- **Development** (`npm run dev`): Uses `http://localhost:4000`
- **Production** (`npm run build`): Uses `http://43.205.238.172:4000`

### Manual Override (Optional):
Create environment files to override defaults:

#### For Local Development:
Create `apps/frontend/.env.development`:
```
VITE_API_BASE_URL=http://localhost:4000
```

#### For Production:
Create `apps/frontend/.env.production`:
```
VITE_API_BASE_URL=http://43.205.238.172:4000
```

## Local Development Workflow

### 1. Start Backend (Terminal 1):
```bash
cd apps/backend
npm run dev
```
Backend will run on `http://localhost:4000`

### 2. Start Frontend (Terminal 2):
```bash
cd apps/frontend  
npm run dev
```
Frontend will run on `http://localhost:5173`

### 3. Test Locally:
- Frontend automatically connects to local backend
- Login with: `admin@masaischool.com` / `admin123` or `creator@masaischool.com` / `creator123`

### 4. Deploy to Production:
```bash
npm run build
# Deploy the built files
```
Production build automatically uses production API endpoints.

## Database Configuration

### Local Development:
- Backend uses the same production database by default
- Users created via `scripts/onboard-users.js` work in both environments

### Environment Variables:
Backend environment variables (optional):
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret  
- `OPENAI_API_KEY` - OpenAI API key
- `GEMINI_API_KEY` - Google Gemini API key
- `PORT` - Server port (default: 4000)
