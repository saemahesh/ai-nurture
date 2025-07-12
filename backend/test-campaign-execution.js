const CampaignExecutor = require('./campaign-executor');
const fs = require('fs');
const path = require('path');

// Test the campaign execution system
async function testCampaignExecution() {
    console.log('Testing Campaign Execution System...\n');
    
    const executor = new CampaignExecutor();
    
    // Create test data
    const testUsername = 'testuser';
    const testCampaignId = 'test-campaign-1';
    
    // Create sample campaign data
    const campaigns = [
        {
            id: testCampaignId,
            name: 'Test Campaign',
            description: 'Test campaign for execution',
            status: 'draft',
            username: testUsername,
            createdAt: new Date().toISOString()
        }
    ];
    
    // Create sample sequences
    const sequences = [
        {
            id: 'seq-1',
            campaignId: testCampaignId,
            username: testUsername,
            messages: [
                {
                    id: 'msg-1',
                    type: 'text',
                    text: 'Hello {first_name}, welcome to our campaign!',
                    delay: 0 // immediate
                },
                {
                    id: 'msg-2',
                    type: 'text',
                    text: 'Hi {first_name}, this is a follow-up message from {company}.',
                    delay: 60 // 1 hour later
                }
            ]
        }
    ];
    
    // Create sample enrollments
    const enrollments = [
        {
            id: 'enr-1',
            campaignId: testCampaignId,
            username: testUsername,
            phone: '+1234567890',
            enrolledAt: new Date().toISOString(),
            status: 'active'
        }
    ];
    
    // Create sample leads
    const campaignLeads = [
        {
            id: 'lead-1',
            campaignId: testCampaignId,
            username: testUsername,
            phone: '+1234567890',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            company: 'Test Company',
            createdAt: new Date().toISOString()
        }
    ];
    
    // Save test data
    fs.writeFileSync(path.join(__dirname, 'data/campaigns.json'), JSON.stringify(campaigns, null, 2));
    fs.writeFileSync(path.join(__dirname, 'data/sequences.json'), JSON.stringify(sequences, null, 2));
    fs.writeFileSync(path.join(__dirname, 'data/enrollments.json'), JSON.stringify(enrollments, null, 2));
    fs.writeFileSync(path.join(__dirname, 'data/campaign_leads.json'), JSON.stringify(campaignLeads, null, 2));
    
    console.log('✓ Test data created');
    
    // Test 1: Start campaign
    console.log('\n1. Testing campaign start...');
    const startResult = executor.startCampaign(testCampaignId, testUsername);
    console.log('Start result:', startResult);
    
    // Check if queue entries were created
    const queue = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/campaign_queue.json'), 'utf8'));
    console.log('Queue entries created:', queue.length);
    
    // Test 2: Get campaign stats
    console.log('\n2. Testing campaign stats...');
    const stats = executor.getCampaignStats(testCampaignId, testUsername);
    console.log('Campaign stats:', stats);
    
    // Test 3: Check working hours
    console.log('\n3. Testing working hours...');
    console.log('Is within working hours:', executor.isWithinWorkingHours());
    
    // Test 4: Check rate limiting
    console.log('\n4. Testing rate limiting...');
    console.log('Can send message (first call):', executor.canSendMessage(testUsername));
    executor.updateRateLimit(testUsername);
    console.log('Can send message (after rate limit):', executor.canSendMessage(testUsername));
    
    // Test 5: Pause campaign
    console.log('\n5. Testing campaign pause...');
    const pauseResult = executor.pauseCampaign(testCampaignId, testUsername);
    console.log('Pause result:', pauseResult);
    
    // Test 6: Resume campaign
    console.log('\n6. Testing campaign resume...');
    const resumeResult = executor.resumeCampaign(testCampaignId, testUsername);
    console.log('Resume result:', resumeResult);
    
    // Test 7: Message personalization
    console.log('\n7. Testing message personalization...');
    const testMessage = { text: 'Hello {first_name} from {company}!' };
    const testLead = { firstName: 'Jane', company: 'ACME Corp' };
    const personalizedMessage = executor.personalizeMessage(testMessage, testLead);
    console.log('Original message:', testMessage.text);
    console.log('Personalized message:', personalizedMessage.text);
    
    console.log('\n✓ Campaign execution system test completed!');
}

// Run the test
testCampaignExecution().catch(console.error);
