import fetch from 'node-fetch';

const API_BASE = 'http://localhost:4000/api';

// Test data
const testUsers = {
  admin: { email: 'admin@example.com', password: 'Admin@123' },
  creator: { email: 'creator1@example.com', password: 'Creator@123' }
};

let tokens = {};
let contentId = null;

async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = { error: 'Failed to parse response' };
  }
  
  console.log(`${options.method || 'GET'} ${endpoint}:`, response.status, data);
  return { response, data };
}

async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...');
  
  // Test admin login
  const adminLogin = await makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(testUsers.admin)
  });
  
  if (adminLogin.response.ok) {
    tokens.admin = adminLogin.data.token;
    console.log('✅ Admin login successful');
  }
  
  // Test creator login
  const creatorLogin = await makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(testUsers.creator)
  });
  
  if (creatorLogin.response.ok) {
    tokens.creator = creatorLogin.data.token;
    console.log('✅ Creator login successful');
  }
}

async function testContentCreation() {
  console.log('\n📝 Testing Content Creation...');
  
  const contentData = {
    title: 'Test React Hooks Guide',
    content: '# React Hooks\n\nThis is a test guide about React hooks.\n\n## useState\n\nThe useState hook allows you to add state to functional components.',
    brief: 'A comprehensive guide to React hooks including useState and useEffect',
    tags: ['react', 'hooks', 'javascript'],
    category: 'tutorial'
  };
  
  const result = await makeRequest('/content', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens.creator}` },
    body: JSON.stringify(contentData)
  });
  
  if (result.response.ok) {
    contentId = result.data.content.id;
    console.log('✅ Content creation successful');
    console.log('📄 Content ID:', contentId);
  }
}

async function testContentListing() {
  console.log('\n📋 Testing Content Listing...');
  
  // Test creator's content list
  const creatorContent = await makeRequest('/content', {
    headers: { Authorization: `Bearer ${tokens.creator}` }
  });
  
  if (creatorContent.response.ok) {
    console.log('✅ Creator can view their content');
    console.log('📊 Creator has', creatorContent.data.contents.length, 'content items');
  }
  
  // Test admin's content list (should be empty initially)
  const adminContent = await makeRequest('/content', {
    headers: { Authorization: `Bearer ${tokens.admin}` }
  });
  
  if (adminContent.response.ok) {
    console.log('✅ Admin can view assigned content');
    console.log('📊 Admin has', adminContent.data.contents.length, 'content items for review');
  }
}

async function testContentSubmission() {
  console.log('\n📤 Testing Content Submission...');
  
  if (!contentId) {
    console.log('❌ No content ID available for submission test');
    return;
  }
  
  const result = await makeRequest('/content/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens.creator}` },
    body: JSON.stringify({ contentId })
  });
  
  if (result.response.ok) {
    console.log('✅ Content submission successful');
    console.log('📋 Content status:', result.data.content.status);
  }
}

async function testAdminReviewQueue() {
  console.log('\n👨‍💼 Testing Admin Review Queue...');
  
  const result = await makeRequest('/admin/review-queue', {
    headers: { Authorization: `Bearer ${tokens.admin}` }
  });
  
  if (result.response.ok) {
    console.log('✅ Admin can view review queue');
    console.log('📊 Items in review queue:', result.data.reviewQueue.length);
    
    if (result.data.reviewQueue.length > 0) {
      console.log('📄 First item author:', result.data.reviewQueue[0].author.name);
    }
  }
}

async function testContentReview() {
  console.log('\n✅ Testing Content Review...');
  
  if (!contentId) {
    console.log('❌ No content ID available for review test');
    return;
  }
  
  const result = await makeRequest(`/content/${contentId}/review`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens.admin}` },
    body: JSON.stringify({ 
      action: 'approve',
      feedback: 'Great content! Well structured and informative.' 
    })
  });
  
  if (result.response.ok) {
    console.log('✅ Content review successful');
    console.log('📋 Content status:', result.data.content.status);
    console.log('📝 Review feedback:', result.data.content.reviewFeedback);
  }
}

async function testAdminStats() {
  console.log('\n📊 Testing Admin Statistics...');
  
  const result = await makeRequest('/admin/stats', {
    headers: { Authorization: `Bearer ${tokens.admin}` }
  });
  
  if (result.response.ok) {
    console.log('✅ Admin stats retrieved successfully');
    console.log('📊 Stats:', result.data.stats);
  }
}

async function testValidationAPI() {
  console.log('\n🤖 Testing Validation API...');
  
  const validationData = {
    content: '# React Hooks Guide\n\nThis guide covers useState and useEffect hooks with practical examples.',
    brief: 'Educational content about React hooks'
  };
  
  const result = await makeRequest('/validate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens.creator}` },
    body: JSON.stringify(validationData)
  });
  
  if (result.response.ok) {
    console.log('✅ Validation API working');
    console.log('📊 Overall Score:', result.data.overallScore);
    console.log('🤖 Providers:', result.data.providers);
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests...\n');
  
  try {
    await testAuthentication();
    await testContentCreation();
    await testContentListing();
    await testContentSubmission();
    await testAdminReviewQueue();
    await testContentReview();
    await testAdminStats();
    await testValidationAPI();
    
    console.log('\n✅ All API tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the tests
runTests();
