#!/usr/bin/env node

/**
 * Development Rate Limiter Reset Script
 * Use this script to reset the rate limiter during development
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:4000';

async function resetRateLimit() {
  try {
    console.log('🔄 Resetting rate limiter for development...');
    
    const response = await fetch(`${API_BASE_URL}/api/dev/reset-rate-limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Rate limiter reset successfully:', result.message);
    } else {
      console.log('❌ Failed to reset rate limiter:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Error resetting rate limiter:', error.message);
    console.log('Make sure the backend server is running on port 4000');
  }
}

// Test API connectivity
async function testAPI() {
  try {
    console.log('🔍 Testing API connectivity...');
    const response = await fetch(`${API_BASE_URL}/health`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ API is healthy:', result);
    } else {
      console.log('❌ API health check failed:', response.status);
    }
  } catch (error) {
    console.log('❌ API is not accessible:', error.message);
  }
}

async function main() {
  console.log('🚀 Content Validation Platform - Development Tools');
  console.log('='.repeat(50));
  
  await testAPI();
  console.log('');
  await resetRateLimit();
  
  console.log('\n📋 Next steps:');
  console.log('- Try your assignment completion again');
  console.log('- If you still get 429 errors, wait a few minutes');
  console.log('- The rate limiter now allows 1000 requests per 15 minutes in development');
}

main().catch(console.error);
