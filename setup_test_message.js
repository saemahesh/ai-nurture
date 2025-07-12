const fs = require('fs');
const path = require('path');

// Test: Modify the next message to be due now so we can test the fix
const queueFile = path.join(__dirname, 'backend/data/campaign_queue.json');
const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));

console.log('🔧 Updating next message to be due now for testing...');

// Find the pending message and set it to be due now
const pendingMessage = queue.find(q => q.status === 'pending');
if (pendingMessage) {
  const now = new Date();
  const testTime = new Date(now.getTime() + 5000); // 5 seconds from now
  
  pendingMessage.scheduledAt = testTime.toISOString();
  
  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
  
  console.log(`✅ Updated message ${pendingMessage.id} to be scheduled at: ${testTime.toISOString()}`);
  console.log('📢 The message should be sent within the next 30 seconds (next queue processing cycle)');
  console.log('👀 Watch the logs to see if the enrollment count updates correctly from 1/2 to 2/2');
} else {
  console.log('❌ No pending messages found');
}

console.log('🎯 Test setup complete!');
