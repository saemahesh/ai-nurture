const CampaignExecutor = require('./backend/campaign-executor.js');

const executor = new CampaignExecutor();

console.log('Testing updateEnrollmentStatus for phone 919032655489...');
executor.updateEnrollmentStatus('seq_1752221360754', 'mahesh', '919032655489');

console.log('Testing updateEnrollmentStatus for phone 919573713873...');
executor.updateEnrollmentStatus('seq_1752221360754', 'mahesh', '919573713873');
