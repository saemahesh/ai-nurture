const fs = require('fs');
const path = require('path');

// Update the next message to be sent soon for testing
const queueFile = path.join(__dirname, 'backend/data/campaign_queue.json');
const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));

console.log('🔧 Updating next message to be due soon for testing...');

// Find the pending message (should be message index 1)
const pendingMessage = queue.find(q => q.status === 'pending' && q.phone === '919573713873');
if (pendingMessage) {
  const now = new Date();
  const testTime = new Date(now.getTime() + 10000); // 10 seconds from now
  
  pendingMessage.scheduledAt = testTime.toISOString();
  
  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
  
  console.log(`✅ Updated message ${pendingMessage.id} to be scheduled at: ${testTime.toISOString()}`);
  console.log('📢 The second message should be sent within the next 30 seconds');
  console.log('👀 Watch the logs to see if the enrollment count updates correctly from 1/2 to 2/2 and status becomes "completed"');
} else {
  console.log('❌ No pending messages found');
}

console.log('🎯 Test setup complete!');
