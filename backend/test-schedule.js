const fs = require('fs');
const path = require('path');
const http = require('http');
const FormData = require('form-data');

// Function to test schedule creation with multiple groups
async function testScheduleCreation() {
  console.log('=== Starting Schedule Creation Test ===');
  
  try {
    // Create a FormData instance
    const form = new FormData();
    
    // Add test data
    const groupIds = ['1234', '32323'];
    form.append('groupIds', JSON.stringify(groupIds));
    form.append('message', 'Test message from script');
    form.append('time', new Date('2025-05-01T14:47:00.000Z').toISOString());
    
    // Add test image
    const imagePath = path.join(__dirname, 'public', 'uploads', 'test-image.jpg');
    // If test image doesn't exist, create a simple one
    if (!fs.existsSync(imagePath)) {
      console.log('Creating test image file...');
      // Create a simple 1x1 pixel JPEG
      fs.writeFileSync(imagePath, Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
        0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb,
        0x00, 0x43, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff
      ]));
    }
    form.append('image', fs.createReadStream(imagePath));
    
    console.log('Prepared form data:');
    console.log('- groupIds:', JSON.stringify(groupIds));
    console.log('- message: Test message from script');
    console.log('- time:', new Date('2025-05-01T14:47:00.000Z').toISOString());
    console.log('- image file attached');
    
    // Set up the headers
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/schedule',
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Cookie': 'connect.sid=YOUR_SESSION_ID' // Replace this with a valid session cookie
      }
    };
    
    console.log('Sending request to server...');
    
    // Send request
    const req = http.request(options, (res) => {
      console.log('Response status:', res.statusCode);
      console.log('Response headers:', res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response body:', data);
        console.log('=== Test Completed ===');
      });
    });
    
    req.on('error', (e) => {
      console.error('Request error:', e.message);
    });
    
    // Send the form data
    form.pipe(req);
    
  } catch (err) {
    console.error('Test error:', err);
  }
}

// Run the test
testScheduleCreation();

console.log('Note: To use this test script:');
console.log('1. Install form-data: npm install form-data');
console.log('2. Log in to the app in your browser and copy the connect.sid value from cookies');
console.log('3. Update the Cookie header in the script with your session ID');
console.log('4. Run this script with: node test-schedule.js');