const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing login with credentials...\n');
    
    // Test 1: Login with username
    console.log('Test 1: Login with username "extreme"');
    const response = await axios.post('http://localhost:5100/api/auth/login', {
      username: 'extreme',
      password: 'extreme'
    });
    
    console.log('✅ Login successful!');
    console.log('Token:', response.data.token.substring(0, 50) + '...');
    console.log('User:', response.data.user);
    
    // Test 2: Verify token
    console.log('\n---\nTest 2: Verify token');
    const meResponse = await axios.get('http://localhost:5100/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });
    console.log('✅ Token valid!');
    console.log('User data:', meResponse.data);
    
    console.log('\n🎉 Authentication Working Correctly!');
  } catch (error) {
    console.error('❌ Login Error:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    console.error('\nDebug Info:');
    console.error('- Backend URL:', error.config?.url);
    console.error('- Request data:', error.config?.data);
  }
}

testLogin();
