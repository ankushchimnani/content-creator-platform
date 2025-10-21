#!/usr/bin/env node

/**
 * 🚀 DEPLOYMENT READINESS TEST
 * Comprehensive test to verify if the Content Validation Platform is ready for production deployment
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 CONTENT VALIDATION PLATFORM - DEPLOYMENT READINESS TEST');
console.log('='.repeat(60));

let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  total: 0
};

function runTest(testName, testFunction) {
  testResults.total++;
  console.log(`\n📋 ${testName}`);
  try {
    const result = testFunction();
    if (result.success) {
      console.log(`✅ ${result.message}`);
      testResults.passed++;
    } else {
      console.log(`❌ ${result.message}`);
      testResults.failed++;
    }
    if (result.warning) {
      console.log(`⚠️  ${result.warning}`);
      testResults.warnings++;
    }
  } catch (error) {
    console.log(`❌ ${testName} failed with error: ${error.message}`);
    testResults.failed++;
  }
}

// Test 1: Environment Configuration
runTest('Environment Configuration', () => {
  const envPath = path.join(__dirname, 'apps/backend/.env');
  if (!fs.existsSync(envPath)) {
    return { success: false, message: 'Backend .env file not found' };
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'OPENAI_API_KEY', 'GEMINI_API_KEY'];
  const missingVars = requiredVars.filter(varName => !envContent.includes(varName));
  
  if (missingVars.length > 0) {
    return { success: false, message: `Missing environment variables: ${missingVars.join(', ')}` };
  }
  
  return { 
    success: true, 
    message: 'All required environment variables configured',
    warning: envContent.includes('your-super-secret-jwt-key-change-this-in-production') ? 
      'JWT_SECRET should be changed in production' : null
  };
});

// Test 2: Frontend Build
runTest('Frontend Build', () => {
  try {
    execSync('npm run build', { 
      cwd: path.join(__dirname, 'apps/frontend'), 
      stdio: 'pipe' 
    });
    
    const distPath = path.join(__dirname, 'apps/frontend/dist');
    if (!fs.existsSync(distPath)) {
      return { success: false, message: 'Frontend build output not found' };
    }
    
    const files = fs.readdirSync(distPath);
    if (!files.includes('index.html')) {
      return { success: false, message: 'Frontend index.html not found in build output' };
    }
    
    return { success: true, message: 'Frontend builds successfully' };
  } catch (error) {
    return { success: false, message: `Frontend build failed: ${error.message}` };
  }
});

// Test 3: Backend Build
runTest('Backend Build', () => {
  try {
    execSync('npm run build', { 
      cwd: path.join(__dirname, 'apps/backend'), 
      stdio: 'pipe' 
    });
    
    const distPath = path.join(__dirname, 'apps/backend/dist');
    if (!fs.existsSync(distPath)) {
      return { success: false, message: 'Backend build output not found' };
    }
    
    return { success: true, message: 'Backend builds successfully' };
  } catch (error) {
    return { success: false, message: `Backend build failed: ${error.message}` };
  }
});

// Test 4: Package Dependencies
runTest('Package Dependencies', () => {
  const frontendPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'apps/frontend/package.json'), 'utf8'));
  const backendPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'apps/backend/package.json'), 'utf8'));
  
  const frontendDeps = Object.keys(frontendPkg.dependencies || {});
  const frontendDevDeps = Object.keys(frontendPkg.devDependencies || {});
  const backendDeps = Object.keys(backendPkg.dependencies || {});
  const backendDevDeps = Object.keys(backendPkg.devDependencies || {});
  
  const criticalFrontendDeps = ['react', 'react-dom'];
  const criticalFrontendDevDeps = ['vite'];
  const criticalBackendDeps = ['express', 'bcrypt', 'jsonwebtoken', 'express-rate-limit'];
  const criticalBackendDevDeps = ['prisma'];
  
  const missingFrontend = criticalFrontendDeps.filter(dep => !frontendDeps.includes(dep));
  const missingFrontendDev = criticalFrontendDevDeps.filter(dep => !frontendDevDeps.includes(dep));
  const missingBackend = criticalBackendDeps.filter(dep => !backendDeps.includes(dep));
  const missingBackendDev = criticalBackendDevDeps.filter(dep => !backendDevDeps.includes(dep));
  
  if (missingFrontend.length > 0 || missingFrontendDev.length > 0 || missingBackend.length > 0 || missingBackendDev.length > 0) {
    return { 
      success: false, 
      message: `Missing critical dependencies - Frontend: ${missingFrontend.join(', ')}, Frontend Dev: ${missingFrontendDev.join(', ')}, Backend: ${missingBackend.join(', ')}, Backend Dev: ${missingBackendDev.join(', ')}` 
    };
  }
  
  return { success: true, message: 'All critical dependencies present' };
});

// Test 5: Database Schema
runTest('Database Schema', () => {
  const schemaPath = path.join(__dirname, 'apps/backend/prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    return { success: false, message: 'Prisma schema file not found' };
  }
  
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const requiredModels = ['User', 'ContentAssignment', 'Content', 'ValidationResult'];
  const missingModels = requiredModels.filter(model => !schemaContent.includes(`model ${model}`));
  
  if (missingModels.length > 0) {
    return { success: false, message: `Missing database models: ${missingModels.join(', ')}` };
  }
  
  return { success: true, message: 'Database schema is complete' };
});

// Test 6: Docker Configuration
runTest('Docker Configuration', () => {
  const dockerPath = path.join(__dirname, 'docker-compose.yml');
  if (!fs.existsSync(dockerPath)) {
    return { 
      success: false, 
      message: 'Docker compose file not found',
      warning: 'Docker configuration is optional but recommended for deployment'
    };
  }
  
  const dockerContent = fs.readFileSync(dockerPath, 'utf8');
  if (!dockerContent.includes('postgres') || !dockerContent.includes('5432')) {
    return { success: false, message: 'Docker compose missing PostgreSQL configuration' };
  }
  
  return { success: true, message: 'Docker configuration is present' };
});

// Test 7: Security Configuration
runTest('Security Configuration', () => {
  const backendIndex = fs.readFileSync(path.join(__dirname, 'apps/backend/src/index.ts'), 'utf8');
  const authMiddleware = fs.readFileSync(path.join(__dirname, 'apps/backend/src/middleware/auth.ts'), 'utf8');
  
  const securityFeatures = [
    { name: 'Helmet.js', check: 'helmet', content: backendIndex },
    { name: 'CORS', check: 'cors', content: backendIndex },
    { name: 'Rate Limiting', check: 'express-rate-limit', content: backendIndex },
    { name: 'JWT Authentication', check: 'jsonwebtoken', content: authMiddleware }
  ];
  
  const missingSecurity = securityFeatures.filter(feature => !feature.content.includes(feature.check));
  
  if (missingSecurity.length > 0) {
    return { 
      success: false, 
      message: `Missing security features: ${missingSecurity.map(f => f.name).join(', ')}` 
    };
  }
  
  return { success: true, message: 'Security features are configured' };
});

// Test 8: API Endpoints
runTest('API Endpoints', () => {
  const routesDir = path.join(__dirname, 'apps/backend/src/routes');
  const requiredRoutes = ['auth.ts', 'content.ts', 'assignments.ts', 'admin.ts', 'validate.ts'];
  
  const missingRoutes = requiredRoutes.filter(route => !fs.existsSync(path.join(routesDir, route)));
  
  if (missingRoutes.length > 0) {
    return { success: false, message: `Missing API routes: ${missingRoutes.join(', ')}` };
  }
  
  return { success: true, message: 'All required API routes are present' };
});

// Test 9: Frontend Components
runTest('Frontend Components', () => {
  const componentsDir = path.join(__dirname, 'apps/frontend/src/components');
  const srcDir = path.join(__dirname, 'apps/frontend/src');
  const requiredComponents = [
    'AdminDashboard.tsx', 'CreatorDashboard.tsx', 'ContentCreation.tsx',
    'AssignmentManager.tsx', 'Settings.tsx'
  ];
  const requiredSrcFiles = ['App.tsx'];
  
  const missingComponents = requiredComponents.filter(comp => !fs.existsSync(path.join(componentsDir, comp)));
  const missingSrcFiles = requiredSrcFiles.filter(file => !fs.existsSync(path.join(srcDir, file)));
  
  if (missingComponents.length > 0 || missingSrcFiles.length > 0) {
    return { success: false, message: `Missing frontend files - Components: ${missingComponents.join(', ')}, Src: ${missingSrcFiles.join(', ')}` };
  }
  
  return { success: true, message: 'All required frontend components are present' };
});

// Test 10: TypeScript Configuration
runTest('TypeScript Configuration', () => {
  const frontendTsConfig = path.join(__dirname, 'apps/frontend/tsconfig.json');
  const backendTsConfig = path.join(__dirname, 'apps/backend/tsconfig.json');
  
  if (!fs.existsSync(frontendTsConfig) || !fs.existsSync(backendTsConfig)) {
    return { success: false, message: 'TypeScript configuration files missing' };
  }
  
  return { success: true, message: 'TypeScript configuration is present' };
});

// Final Results
console.log('\n' + '='.repeat(60));
console.log('📊 DEPLOYMENT READINESS SUMMARY');
console.log('='.repeat(60));

const successRate = Math.round((testResults.passed / testResults.total) * 100);

console.log(`✅ Passed: ${testResults.passed}/${testResults.total} (${successRate}%)`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`⚠️  Warnings: ${testResults.warnings}`);

if (testResults.failed === 0) {
  console.log('\n🎉 DEPLOYMENT READY!');
  console.log('The Content Validation Platform is ready for production deployment.');
  
  if (testResults.warnings > 0) {
    console.log('\n⚠️  RECOMMENDATIONS:');
    console.log('- Address the warnings above before production deployment');
    console.log('- Change JWT_SECRET to a secure value');
    console.log('- Configure production database URL');
    console.log('- Set up SSL/HTTPS certificates');
  }
} else {
  console.log('\n🚨 NOT READY FOR DEPLOYMENT');
  console.log('Please fix the failed tests before deploying to production.');
}

console.log('\n📋 NEXT STEPS FOR DEPLOYMENT:');
console.log('1. Set up production environment variables');
console.log('2. Configure production database');
console.log('3. Set up SSL certificates');
console.log('4. Deploy backend to your server');
console.log('5. Deploy frontend to static hosting/CDN');
console.log('6. Configure reverse proxy (nginx/apache)');
console.log('7. Run database migrations: npx prisma migrate deploy');
console.log('8. Test all functionality in production environment');

process.exit(testResults.failed > 0 ? 1 : 0);