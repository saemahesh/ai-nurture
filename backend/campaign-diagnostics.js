const CampaignExecutor = require('./campaign-executor');
const fs = require('fs');
const path = require('path');
const { getDataFilePath } = require('./data-utils');

// Diagnostic tool to check campaign system status
class CampaignDiagnostics {
  constructor() {
    this.executor = new CampaignExecutor();
  }

  // Check if all data files exist
  checkDataFiles() {
    console.log('📁 Checking Data Files:');
    const files = [
      'sequences.json',
      'enrollments.json',
      'campaign_queue.json',
      'campaign_leads.json',
      'message_queue.json',
      'campaigns.json'
    ];

    files.forEach(file => {
      const filePath = getDataFilePath(file);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`  ✅ ${file}: ${data.length} records`);
      } else {
        console.log(`  ❌ ${file}: Missing`);
      }
    });
  }

  // Check current enrollments
  checkEnrollments() {
    console.log('\n👥 Checking Enrollments:');
    const enrollments = JSON.parse(fs.readFileSync(getDataFilePath('enrollments.json'), 'utf8'));
    
    if (enrollments.length === 0) {
      console.log('  ❌ No enrollments found');
      return;
    }

    enrollments.forEach(enrollment => {
      console.log(`  📋 Enrollment: ${enrollment.id}`);
      console.log(`     Phone: ${enrollment.phone}`);
      console.log(`     Campaign: ${enrollment.campaignId || enrollment.sequence_id}`);
      console.log(`     Status: ${enrollment.status}`);
      console.log(`     Enrolled: ${enrollment.enrolledAt || enrollment.enrolled_at}`);
    });
  }

  // Check message queue
  checkQueue() {
    console.log('\n📬 Checking Message Queue:');
    const queue = JSON.parse(fs.readFileSync(getDataFilePath('campaign_queue.json'), 'utf8'));
    
    if (queue.length === 0) {
      console.log('  ❌ No messages in queue');
      return;
    }

    const statusCounts = {
      pending: queue.filter(q => q.status === 'pending').length,
      sent: queue.filter(q => q.status === 'sent').length,
      failed: queue.filter(q => q.status === 'failed').length
    };

    console.log(`  📊 Queue Status:`);
    console.log(`     Pending: ${statusCounts.pending}`);
    console.log(`     Sent: ${statusCounts.sent}`);
    console.log(`     Failed: ${statusCounts.failed}`);

    // Show next few messages
    const nextMessages = queue
      .filter(q => q.status === 'pending')
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      .slice(0, 3);

    if (nextMessages.length > 0) {
      console.log(`  🔜 Next Messages:`);
      nextMessages.forEach(msg => {
        console.log(`     ${msg.phone} at ${msg.scheduledAt} (${msg.campaignId})`);
      });
    }
  }

  // Check working hours
  checkWorkingHours() {
    console.log('\n🕐 Checking Working Hours:');
    const now = new Date();
    const hour = now.getHours();
    const isWorkingHours = hour >= 6 && hour <= 21;
    
    console.log(`  Current time: ${now.toLocaleTimeString()}`);
    console.log(`  Working hours (6 AM - 9 PM): ${isWorkingHours ? '✅ Yes' : '❌ No'}`);
    
    if (!isWorkingHours) {
      console.log(`  ⏰ Messages will be sent during working hours only`);
    }
  }

  // Test enrollment processing
  testEnrollmentProcessing() {
    console.log('\n🧪 Testing Enrollment Processing:');
    
    // Get existing enrollments
    const enrollments = JSON.parse(fs.readFileSync(getDataFilePath('enrollments.json'), 'utf8'));
    
    if (enrollments.length === 0) {
      console.log('  ❌ No enrollments to process');
      return;
    }

    // Test with first enrollment
    const enrollment = enrollments[0];
    console.log(`  🔄 Processing enrollment: ${enrollment.id}`);
    
    const result = this.executor.processEnrollment({
      campaignId: enrollment.campaignId || enrollment.sequence_id,
      username: enrollment.username,
      phone: enrollment.phone,
      enrolledAt: enrollment.enrolledAt || enrollment.enrolled_at
    });

    console.log(`  Result: ${result.success ? '✅ Success' : '❌ Failed'}`);
    if (!result.success) {
      console.log(`  Error: ${result.error}`);
    }
  }

  // Run full diagnostics
  runDiagnostics() {
    console.log('🔍 CAMPAIGN SYSTEM DIAGNOSTICS\n');
    console.log('================================\n');
    
    this.checkDataFiles();
    this.checkEnrollments();
    this.checkQueue();
    this.checkWorkingHours();
    this.testEnrollmentProcessing();
    
    console.log('\n✅ Diagnostics Complete');
    console.log('\nTo manually process existing enrollments, run:');
    console.log('node process-enrollments.js');
  }
}

// Run diagnostics
const diagnostics = new CampaignDiagnostics();
diagnostics.runDiagnostics();
