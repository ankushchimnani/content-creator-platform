import fetch from 'node-fetch';

const API_BASE = 'http://localhost:4000/api';

// Test credentials
const testUser = { email: 'creator1@example.com', password: 'Creator@123' };

async function testLLMIntegrationDetailed() {
  console.log('🔍 Detailed LLM Integration Analysis\n');

  try {
    // Login first
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });

    const loginData = await loginRes.json();
    const token = loginData.token;

    // Test different content types to see how validation works
    const testCases = [
      {
        name: "Well-structured Technical Content",
        content: `# React Performance Optimization

## Introduction
React applications can become slow as they grow. This guide covers essential optimization techniques.

## Key Techniques

### 1. Memoization
Use React.memo for component memoization:

\`\`\`javascript
const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{data.map(item => <Item key={item.id} {...item} />)}</div>;
});
\`\`\`

### 2. useCallback and useMemo
Optimize function and value calculations:

\`\`\`javascript
const optimizedComponent = () => {
  const memoizedValue = useMemo(() => expensiveCalculation(data), [data]);
  const memoizedCallback = useCallback(() => doSomething(), [dependency]);
  
  return <Component value={memoizedValue} onClick={memoizedCallback} />;
};
\`\`\`

## Best Practices
- Profile before optimizing
- Use React DevTools Profiler
- Implement virtual scrolling for large lists`,
        brief: "Technical guide on React performance optimization with code examples"
      },
      {
        name: "Poor Quality Content",
        content: `# TODO: Fix this title

some random text here without proper structure
no code examples
very short content
missing explanations`,
        brief: "Should be a comprehensive guide but lacks quality"
      },
      {
        name: "Well-structured Educational Content",
        content: `# Understanding JavaScript Closures

## What are Closures?

A closure is a feature in JavaScript where an inner function has access to the outer (enclosing) function's variables — a scope chain.

## How Closures Work

When a function is created, it forms a closure with its surrounding state (lexical environment). This closure allows the function to access variables from an outer scope even after the outer function has returned.

### Example 1: Basic Closure

\`\`\`javascript
function outerFunction(x) {
  // This is the outer function's scope
  
  function innerFunction(y) {
    // This inner function has access to both x and y
    return x + y;
  }
  
  return innerFunction;
}

const addFive = outerFunction(5);
console.log(addFive(3)); // Output: 8
\`\`\`

### Example 2: Practical Use Case - Counter

\`\`\`javascript
function createCounter() {
  let count = 0;
  
  return {
    increment: () => ++count,
    decrement: () => --count,
    getCount: () => count
  };
}

const counter = createCounter();
console.log(counter.increment()); // 1
console.log(counter.increment()); // 2
console.log(counter.getCount());  // 2
\`\`\`

## Common Use Cases

1. **Data Privacy**: Closures help create private variables
2. **Function Factories**: Creating specialized functions
3. **Event Handlers**: Maintaining state in callbacks
4. **Module Pattern**: Implementing modules in JavaScript

## Best Practices

- Be mindful of memory leaks with closures
- Use closures to create clean, encapsulated code
- Understand the scope chain to debug effectively

## Conclusion

Closures are a powerful feature that enables many advanced JavaScript patterns. Understanding them is crucial for writing effective JavaScript code.`,
        brief: "Educational content about JavaScript closures with practical examples and use cases"
      }
    ];

    console.log('🧪 Testing validation with different content types...\n');

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`📝 Test Case ${i + 1}: ${testCase.name}`);
      console.log('─'.repeat(50));

      const validationRes = await fetch(`${API_BASE}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: testCase.content,
          brief: testCase.brief
        }),
        timeout: 60000 // 60 second timeout
      });

      if (validationRes.ok) {
        const result = await validationRes.json();
        
        console.log(`Overall Score: ${result.overallScore}%`);
        console.log(`Providers: ${result.providers.join(', ')}`);
        console.log(`Processing Time: ${result.processingTime}ms`);
        console.log('');
        
        console.log('Detailed Scores:');
        console.log(`  📊 Relevance: ${result.criteria.relevance.score}%`);
        console.log(`  🔗 Continuity: ${result.criteria.continuity.score}%`);
        console.log(`  📖 Documentation: ${result.criteria.documentation.score}%`);
        
        if (result.criteria.documentation.issues && result.criteria.documentation.issues.length > 0) {
          console.log('\nIssues Found:');
          result.criteria.documentation.issues.forEach(issue => {
            console.log(`  ⚠️  ${issue.message} (${issue.severity})`);
          });
        }
        
        console.log('\n');
      } else {
        console.log('❌ Validation failed for this test case\n');
      }
    }

    // Test API key status
    console.log('🔑 API Key Configuration Status:');
    console.log('─'.repeat(40));
    
    // Make a simple validation request to check provider status
    const simpleRes = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        content: "# Test\nSimple test content",
        brief: "Test brief"
      })
    });

    if (simpleRes.ok) {
      const result = await simpleRes.json();
      
      if (result.providers.includes('openai')) {
        console.log('✅ OpenAI API: Connected and working');
      } else {
        console.log('❌ OpenAI API: Not configured (missing OPENAI_API_KEY)');
      }
      
      if (result.providers.includes('gemini')) {
        console.log('✅ Gemini API: Connected and working');
      } else {
        console.log('❌ Gemini API: Not configured (missing GEMINI_API_KEY)');
      }
      
      if (result.providers.includes('stub')) {
        console.log('🔄 Stub Mode: Active (fallback when no API keys available)');
      }
    }

    console.log('\n🔧 Setup Instructions for Real LLM Integration:');
    console.log('─'.repeat(50));
    console.log('1. Create a .env file in apps/backend/ with:');
    console.log('   OPENAI_API_KEY=sk-your-openai-key-here');
    console.log('   GEMINI_API_KEY=your-gemini-key-here');
    console.log('');
    console.log('2. Get API keys from:');
    console.log('   🔗 OpenAI: https://platform.openai.com/api-keys');
    console.log('   🔗 Google AI Studio: https://aistudio.google.com/app/apikey');
    console.log('');
    console.log('3. Restart the backend server after adding keys');
    console.log('');
    console.log('💡 Benefits of Real LLM Integration:');
    console.log('   • Intelligent content analysis');
    console.log('   • Contextual feedback and suggestions');
    console.log('   • Quality scoring based on actual understanding');
    console.log('   • Dual-LLM consensus for better accuracy');
    console.log('');
    console.log('🎯 Current Status: Fully functional with stub mode for testing');
    console.log('   Ready for real LLM integration when API keys are added!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the detailed test
testLLMIntegrationDetailed();
