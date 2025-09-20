const CampaignExecutor = require('./campaign-executor');
const { getDataFilePath } = require('../data-utils');
const fs = require('fs');
const path = require('path');

// Script to process existing enrollments and queue their messages
class EnrollmentProcessor {
  constructor() {
    this.executor = new CampaignExecutor();
    this.dataDir = path.join(__dirname, 'data');
  }

  // Process all existing enrollments
  processAllEnrollments() {
    console.log('🔄 Processing All Existing Enrollments...\n');
    
    const enrollments = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'enrollments.json'), 'utf8'));
    
    if (enrollments.length === 0) {
      console.log('❌ No enrollments found to process');
      return;
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    enrollments.forEach(enrollment => {
      console.log(`📋 Processing: ${enrollment.id}`);
      console.log(`   Phone: ${enrollment.phone}`);
      console.log(`   Campaign: ${enrollment.campaignId || enrollment.sequence_id}`);
      
      const result = this.executor.processEnrollment({
        campaignId: enrollment.campaignId || enrollment.sequence_id,
        username: enrollment.username,
        phone: enrollment.phone,
        enrolledAt: enrollment.enrolledAt || enrollment.enrolled_at
      });

      if (result.success) {
        console.log(`   ✅ Success: ${result.message}\n`);
        succeeded++;
      } else {
        console.log(`   ❌ Failed: ${result.error}\n`);
        failed++;
      }
      
      processed++;
    });

    console.log(`📊 Processing Summary:`);
    console.log(`   Total: ${processed}`);
    console.log(`   Succeeded: ${succeeded}`);
    console.log(`   Failed: ${failed}`);
    
    // Show queue status after processing
    this.showQueueStatus();
  }

  // Show current queue status
  showQueueStatus() {
    console.log('\n📬 Queue Status After Processing:');
    const queue = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'campaign_queue.json'), 'utf8'));
    
    if (queue.length === 0) {
      console.log('   ❌ Queue is still empty');
      return;
    }

    const statusCounts = {
      pending: queue.filter(q => q.status === 'pending').length,
      sent: queue.filter(q => q.status === 'sent').length,
      failed: queue.filter(q => q.status === 'failed').length
    };

    console.log(`   📊 Total messages queued: ${queue.length}`);
    console.log(`   ⏳ Pending: ${statusCounts.pending}`);
    console.log(`   ✅ Sent: ${statusCounts.sent}`);
    console.log(`   ❌ Failed: ${statusCounts.failed}`);

    // Show next few messages
    const nextMessages = queue
      .filter(q => q.status === 'pending')
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      .slice(0, 5);

    if (nextMessages.length > 0) {
      console.log(`\n🔜 Next Messages to Send:`);
      nextMessages.forEach((msg, index) => {
        const scheduledTime = new Date(msg.scheduledAt);
        console.log(`   ${index + 1}. ${msg.phone} at ${scheduledTime.toLocaleString()}`);
      });
    }
  }
}

// Run the processor
const processor = new EnrollmentProcessor();
processor.processAllEnrollments();
