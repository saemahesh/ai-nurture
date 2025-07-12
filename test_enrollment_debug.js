const CampaignExecutor = require('./backend/campaign-executor.js');

const executor = new CampaignExecutor();

console.log('🔍 Testing updateEnrollmentStatus for the current enrollment...');
console.log('Parameters: campaignId=seq_1752221360754, username=mahesh, phone=919573713873');

// Add some temporary debug logs
const originalUpdateFunction = executor.updateEnrollmentStatus;
executor.updateEnrollmentStatus = function(campaignId, username, phone) {
  console.log(`\n🔍 [TEST DEBUG] updateEnrollmentStatus called with:`, { campaignId, username, phone });
  
  // Call the original function
  const result = originalUpdateFunction.call(this, campaignId, username, phone);
  
  console.log(`🔍 [TEST DEBUG] updateEnrollmentStatus completed\n`);
  return result;
};

executor.updateEnrollmentStatus('seq_1752221360754', 'mahesh', '919573713873');

console.log('\n✅ Test completed');
