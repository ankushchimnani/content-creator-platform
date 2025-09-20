import fetch from 'node-fetch';

const API_BASE = 'http://localhost:4000/api';

// Test credentials
const testUser = { email: 'creator1@example.com', password: 'Creator@123' };

async function testLLMIntegration() {
  console.log('🤖 Testing LLM Integration...\n');

  try {
    // First login to get token
    console.log('1. Logging in...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });

    if (!loginRes.ok) {
      throw new Error('Login failed');
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ Login successful\n');

    // Test validation with sample content
    console.log('2. Testing validation API...');
    const validationData = {
      content: `# React Hooks Complete Guide

React Hooks revolutionized how we write functional components by allowing us to use state and other React features without writing class components.

## useState Hook

The useState hook is the most fundamental hook that lets you add state to functional components:

\`\`\`javascript
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
\`\`\`

## useEffect Hook

The useEffect hook lets you perform side effects in function components. It serves the same purpose as componentDidMount, componentDidUpdate, and componentWillUnmount combined:

\`\`\`javascript
import React, { useState, useEffect } from 'react';

function Example() {
  const [count, setCount] = useState(0);

  // Similar to componentDidMount and componentDidUpdate:
  useEffect(() => {
    document.title = \`You clicked \${count} times\`;
  });

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
\`\`\`

## Custom Hooks

Custom hooks let you extract component logic into reusable functions:

\`\`\`javascript
import { useState, useEffect } from 'react';

function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = () => setCount(count + 1);
  const decrement = () => setCount(count - 1);
  const reset = () => setCount(initialValue);

  return { count, increment, decrement, reset };
}

// Using the custom hook
function CounterComponent() {
  const { count, increment, decrement, reset } = useCounter(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
\`\`\`

## Best Practices

1. **Only call hooks at the top level** - Don't call hooks inside loops, conditions, or nested functions
2. **Only call hooks from React functions** - Call hooks from React function components or custom hooks
3. **Use the dependency array correctly** - Always include all values from component scope that are used inside useEffect
4. **Optimize performance** - Use useMemo and useCallback for expensive calculations and function references

## Conclusion

React Hooks provide a powerful way to reuse stateful logic between components while keeping your code clean and organized.`,
      brief: 'Create a comprehensive educational guide about React Hooks that covers useState, useEffect, custom hooks, and best practices with practical code examples for developers learning modern React development.'
    };

    const validationRes = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(validationData)
    });

    if (!validationRes.ok) {
      const errorData = await validationRes.json();
      console.log('❌ Validation failed:', errorData);
      
      // Check if it's due to missing API keys
      if (errorData.error && errorData.error.includes('missing')) {
        console.log('\n🔑 API Key Configuration Needed:');
        console.log('The validation is falling back to stub mode because API keys are not configured.');
        console.log('To enable real LLM validation, you need to:');
        console.log('');
        console.log('1. Create a .env file in apps/backend/ with:');
        console.log('   OPENAI_API_KEY=your_openai_api_key_here');
        console.log('   GEMINI_API_KEY=your_gemini_api_key_here');
        console.log('');
        console.log('2. Get API keys from:');
        console.log('   - OpenAI: https://platform.openai.com/api-keys');
        console.log('   - Google AI: https://aistudio.google.com/app/apikey');
        console.log('');
        console.log('3. Restart the backend server after adding the keys');
        console.log('');
        console.log('⚠️  For now, testing with stub mode...');
      }
      
      return;
    }

    const validationResult = await validationRes.json();
    console.log('✅ Validation successful!\n');

    // Display results
    console.log('📊 Validation Results:');
    console.log('─────────────────────');
    console.log(`Overall Score: ${validationResult.overallScore}%`);
    console.log(`Overall Confidence: ${(validationResult.overallConfidence * 100).toFixed(1)}%`);
    console.log(`Processing Time: ${validationResult.processingTime}ms`);
    console.log(`LLM Providers Used: ${validationResult.providers.join(', ')}`);
    console.log('');

    console.log('🎯 Detailed Scores:');
    console.log(`  Relevance: ${validationResult.criteria.relevance.score}% (confidence: ${(validationResult.criteria.relevance.confidence * 100).toFixed(1)}%)`);
    console.log(`  Continuity: ${validationResult.criteria.continuity.score}% (confidence: ${(validationResult.criteria.continuity.confidence * 100).toFixed(1)}%)`);
    console.log(`  Documentation: ${validationResult.criteria.documentation.score}% (confidence: ${(validationResult.criteria.documentation.confidence * 100).toFixed(1)}%)`);
    console.log('');

    if (validationResult.criteria.documentation.issues && validationResult.criteria.documentation.issues.length > 0) {
      console.log('⚠️  Documentation Issues Found:');
      validationResult.criteria.documentation.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.message} (${issue.severity})`);
      });
      console.log('');
    }

    // Determine if using real LLMs or stub
    if (validationResult.providers.includes('stub')) {
      console.log('🔄 Using Stub Mode:');
      console.log('The system is currently using stub/mock validation because API keys are not configured.');
      console.log('This provides basic functionality for testing, but real LLM validation requires API keys.');
    } else {
      console.log('🚀 Using Real LLM Providers:');
      console.log(`Successfully integrated with: ${validationResult.providers.join(' and ')}`);
      console.log('The system is using actual AI models for content validation!');
    }

    console.log('\n✅ LLM Integration Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the backend server is running (npm run dev in apps/backend)');
    console.log('2. Check if the database is accessible');
    console.log('3. Verify API keys are properly configured in .env file');
  }
}

// Run the test
runTest();

async function runTest() {
  await testLLMIntegration();
}
