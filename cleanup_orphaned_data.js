const fs = require('fs');
const path = require('path');

// File paths
const enrollmentsFile = path.join(__dirname, 'backend/data/enrollments.json');
const campaignQueueFile = path.join(__dirname, 'backend/data/campaign_queue.json');
const campaignLeadsFile = path.join(__dirname, 'backend/data/campaign_leads.json');

console.log('🧹 Cleaning up orphaned campaign data...');

// Read current data
const enrollments = JSON.parse(fs.readFileSync(enrollmentsFile, 'utf8'));
const campaignQueue = JSON.parse(fs.readFileSync(campaignQueueFile, 'utf8'));
const campaignLeads = JSON.parse(fs.readFileSync(campaignLeadsFile, 'utf8'));

console.log(`📋 Current state:`);
console.log(`   Enrollments: ${enrollments.length}`);
console.log(`   Campaign Queue: ${campaignQueue.length}`);
console.log(`   Campaign Leads: ${campaignLeads.length}`);

// If no enrollments exist, clean up all campaign data
if (enrollments.length === 0) {
  console.log('📭 No enrollments found, cleaning up all campaign data...');
  
  // Clear campaign queue
  fs.writeFileSync(campaignQueueFile, JSON.stringify([], null, 2));
  console.log('✅ Cleared campaign_queue.json');
  
  // Clear campaign leads
  fs.writeFileSync(campaignLeadsFile, JSON.stringify([], null, 2));
  console.log('✅ Cleared campaign_leads.json');
} else {
  // Get list of enrolled phones and campaigns
  const enrolledPhones = new Set();
  const enrolledCampaigns = new Set();
  
  enrollments.forEach(enrollment => {
    enrolledPhones.add(enrollment.phone);
    enrolledCampaigns.add(enrollment.sequence_id);
  });
  
  console.log(`📱 Found ${enrolledPhones.size} enrolled phones in ${enrolledCampaigns.size} campaigns`);
  
  // Filter campaign queue to only keep entries for enrolled phones/campaigns
  const filteredQueue = campaignQueue.filter(entry => {
    return enrolledPhones.has(entry.phone) && enrolledCampaigns.has(entry.campaignId);
  });
  
  // Filter campaign leads to only keep entries for enrolled phones/campaigns
  const filteredLeads = campaignLeads.filter(lead => {
    return enrolledPhones.has(lead.phone) && enrolledCampaigns.has(lead.campaignId);
  });
  
  console.log(`🧹 Filtered results:`);
  console.log(`   Campaign Queue: ${campaignQueue.length} → ${filteredQueue.length}`);
  console.log(`   Campaign Leads: ${campaignLeads.length} → ${filteredLeads.length}`);
  
  // Save filtered data
  fs.writeFileSync(campaignQueueFile, JSON.stringify(filteredQueue, null, 2));
  fs.writeFileSync(campaignLeadsFile, JSON.stringify(filteredLeads, null, 2));
  
  console.log('✅ Cleanup completed');
}

console.log('🎉 All done!');
