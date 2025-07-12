const fs = require('fs');
const path = require('path');

// Fix the queue status and update enrollment
const queueFile = path.join(__dirname, 'backend/data/campaign_queue.json');
const enrollmentsFile = path.join(__dirname, 'backend/data/enrollments.json');

console.log('🔧 Fixing queue status and enrollment data...');

// Load data
const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
const enrollments = JSON.parse(fs.readFileSync(enrollmentsFile, 'utf8'));

// Find the entry that failed but was actually sent successfully
const failedEntry = queue.find(q => 
  q.status === 'failed' && 
  q.apiResponse && 
  q.apiResponse.status === 'success' &&
  q.phone === '919573713873'
);

if (failedEntry) {
  console.log(`✅ Found failed entry that was actually sent: ${failedEntry.id}`);
  
  // Fix the status
  failedEntry.status = 'sent';
  
  // Save the queue
  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
  console.log('✅ Fixed queue entry status to "sent"');
  
  // Update enrollment
  const enrollment = enrollments.find(e => e.phone === '919573713873');
  if (enrollment) {
    enrollment.messages_sent = 1;
    enrollment.current_day = 1;
    
    fs.writeFileSync(enrollmentsFile, JSON.stringify(enrollments, null, 2));
    console.log('✅ Updated enrollment progress to 1/2');
  }
} else {
  console.log('❌ No failed entry found that needs fixing');
}

console.log('🎯 Fix completed!');
