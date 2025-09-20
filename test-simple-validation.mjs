import fetch from 'node-fetch';

const API_BASE = 'http://localhost:4000/api';

async function testSimpleValidation() {
  console.log('🔬 Simple LLM Validation Test\n');

  try {
    // Login
    console.log('1. Logging in...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'creator1@example.com',
        password: 'Creator@123'
      })
    });

    if (!loginRes.ok) {
      throw new Error('Login failed');
    }

    const loginData = await loginRes.json();
    console.log('✅ Login successful\n');

    // Simple validation test
    console.log('2. Testing validation with short content...');
    const startTime = Date.now();
    
    const validationRes = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.token}`
      },
      body: JSON.stringify({
        content: `# Simple Test

This is a short test content to validate the LLM integration.

## Key Points
- Point 1: Basic functionality
- Point 2: API integration
- Point 3: Response handling

The content should be processed quickly.`,
        brief: 'Simple test content for LLM validation'
      })
    });

    const processingTime = Date.now() - startTime;
    console.log(`⏱️  Request took: ${processingTime}ms`);

    if (!validationRes.ok) {
      const error = await validationRes.text();
      console.log('❌ Validation failed:', validationRes.status, error);
      return;
    }

    const result = await validationRes.json();
    
    console.log('✅ Validation successful!\n');
    console.log('📊 Results:');
    console.log(`   Overall Score: ${result.overallScore}%`);
    console.log(`   Providers: ${result.providers.join(', ')}`);
    console.log(`   Processing Time: ${result.processingTime}ms`);
    console.log(`   Total Request Time: ${processingTime}ms`);
    
    console.log('\n🎯 Detailed Scores:');
    console.log(`   Relevance: ${result.criteria.relevance.score}%`);
    console.log(`   Continuity: ${result.criteria.continuity.score}%`);
    console.log(`   Documentation: ${result.criteria.documentation.score}%`);

    // Check which providers are working
    if (result.providers.includes('openai')) {
      console.log('\n✅ OpenAI: Working');
    }
    if (result.providers.includes('gemini')) {
      console.log('✅ Gemini: Working');
    }
    if (result.providers.includes('stub')) {
      console.log('⚠️  Stub: Fallback mode active');
    }

    console.log('\n🎉 LLM Integration Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('socket hang up')) {
      console.log('\n🔧 Socket Hang Up Solutions:');
      console.log('1. The server might be overloaded with LLM processing');
      console.log('2. Try restarting the backend server');
      console.log('3. Check if API rate limits are being hit');
      console.log('4. Consider reducing content length for testing');
    }
  }
}

testSimpleValidation();
