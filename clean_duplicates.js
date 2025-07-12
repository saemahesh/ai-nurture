const fs = require('fs');
const path = require('path');

const queueFile = path.join(__dirname, 'backend/data/campaign_queue.json');

// Load current queue
const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));

console.log(`📋 Original queue size: ${queue.length}`);

// Find duplicates: same campaignId, username, phone, messageIndex
const duplicateMap = new Map();
const toRemove = [];

queue.forEach((entry, index) => {
  const key = `${entry.campaignId}-${entry.username}-${entry.phone}-${entry.messageIndex}`;
  
  if (duplicateMap.has(key)) {
    const existing = duplicateMap.get(key);
    
    // Keep the one with the most recent status (sent > pending)
    // Or if same status, keep the one that was created first
    if (entry.status === 'sent' && existing.entry.status !== 'sent') {
      // Remove the existing one, keep this one
      toRemove.push(existing.index);
      duplicateMap.set(key, { entry, index });
    } else if (existing.entry.status === 'sent' && entry.status !== 'sent') {
      // Remove this one, keep the existing one
      toRemove.push(index);
    } else if (entry.status === existing.entry.status) {
      // Same status, keep the older one (smaller createdAt)
      const existingTime = new Date(existing.entry.createdAt).getTime();
      const currentTime = new Date(entry.createdAt).getTime();
      
      if (currentTime > existingTime) {
        // This one is newer, remove it
        toRemove.push(index);
      } else {
        // This one is older, remove the existing one
        toRemove.push(existing.index);
        duplicateMap.set(key, { entry, index });
      }
    }
  } else {
    duplicateMap.set(key, { entry, index });
  }
});

// Remove duplicates (in reverse order to maintain correct indices)
const uniqueToRemove = [...new Set(toRemove)].sort((a, b) => b - a);
console.log(`🗑️  Removing ${uniqueToRemove.length} duplicate entries:`, uniqueToRemove);

uniqueToRemove.forEach(index => {
  console.log(`   - Removing duplicate: ${queue[index].id} (${queue[index].phone}, message ${queue[index].messageIndex}, status: ${queue[index].status})`);
  queue.splice(index, 1);
});

console.log(`✅ Final queue size: ${queue.length}`);

// Save cleaned queue
fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
console.log(`💾 Cleaned queue saved to ${queueFile}`);
