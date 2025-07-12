// This script will clean up campaign_leads.json:
// - Set 'name' from enrollments.json if available
// - Remove 'firstName' and 'lastName'
// - If no name, leave blank

const fs = require('fs');
const leadsPath = './backend/data/campaign_leads.json';
const enrollmentsPath = './backend/data/enrollments.json';

const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));
const enrollments = JSON.parse(fs.readFileSync(enrollmentsPath, 'utf8'));

function findName(lead) {
  // Try to find enrollment for this lead
  const enrollment = enrollments.find(e => {
    // Support both campaignId/sequence_id and phone/username
    const campaignMatch = (e.campaignId || e.sequence_id) === lead.campaignId;
    const phoneMatch = (e.phone === lead.phone);
    const userMatch = (e.username === lead.username);
    return campaignMatch && phoneMatch && userMatch;
  });
  if (enrollment && enrollment.name) return enrollment.name;
  return '';
}

const cleaned = leads.map(lead => {
  const name = findName(lead);
  return {
    ...lead,
    name,
    // Remove firstName/lastName
    ...(lead.firstName ? {} : {}),
    ...(lead.lastName ? {} : {})
  };
});

// Actually remove firstName/lastName
cleaned.forEach(l => {
  delete l.firstName;
  delete l.lastName;
});

fs.writeFileSync(leadsPath, JSON.stringify(cleaned, null, 2));
console.log('campaign_leads.json cleaned and updated!');
