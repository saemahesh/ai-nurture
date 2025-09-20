const express = require('express');
const { getDataFilePath } = require('../data-utils');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Data file paths
const meetingsPath = getDataFilePath('calendly_meetings.json');
const usersPath = getDataFilePath('users.json');
const notificationsPath = getDataFilePath('meeting_notifications.json');
const templatesPath = getDataFilePath('calendly_reminder_templates.json');

// Helper functions
function readMeetings() {
    try {
        if (fs.existsSync(meetingsPath)) {
            return JSON.parse(fs.readFileSync(meetingsPath, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Error reading meetings data:', error);
        return [];
    }
}

function saveMeetings(meetings) {
    try {
        fs.writeFileSync(meetingsPath, JSON.stringify(meetings, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving meetings data:', error);
        return false;
    }
}

function readUsers() {
    try {
        return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    } catch (error) {
        console.error('Error reading users data:', error);
        return [];
    }
}

function saveUsers(users) {
    try {
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving users data:', error);
        return false;
    }
}

function readNotifications() {
    try {
        if (fs.existsSync(notificationsPath)) {
            return JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Error reading notifications data:', error);
        return [];
    }
}

function saveNotifications(notifications) {
    try {
        fs.writeFileSync(notificationsPath, JSON.stringify(notifications, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving notifications data:', error);
        return false;
    }
}

function readTemplates() {
    try {
        if (fs.existsSync(templatesPath)) {
            return JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Error reading templates data:', error);
        return [];
    }
}

function saveTemplates(templates) {
    try {
        fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving templates data:', error);
        return false;
    }
}

// Sync meetings from Calendly API
async function syncCalendlyMeetings(username, calendlyToken) {
    console.log('[DEBUG] syncCalendlyMeetings - Start');
    console.log('[DEBUG] Username:', username);
    console.log('[DEBUG] Token length:', calendlyToken?.length);
    
    try {
        const meetings = readMeetings();
        console.log('[DEBUG] Current meetings count:', meetings.length);
        
        let newMeetings = [];
        let updatedCount = 0;
        
        // Get user info first
        console.log('[DEBUG] Fetching user info from Calendly...');
        const userResponse = await axios.get('https://api.calendly.com/users/me', {
            headers: {
                'Authorization': `Bearer ${calendlyToken}`,
                'Content-Type': 'application/json'
            }
        });

        const userData = userResponse.data;
        console.log('[DEBUG] User data received:', userData);
        const userUri = userData.resource.uri;
        console.log('[DEBUG] User URI:', userUri);

        // Get event types
        console.log('[DEBUG] Fetching event types...');
        const eventsResponse = await axios.get(`https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}`, {
            headers: {
                'Authorization': `Bearer ${calendlyToken}`,
                'Content-Type': 'application/json'
            }
        });

        const eventsData = eventsResponse.data;
        console.log('[DEBUG] Event types received:', eventsData);
        
        const now = new Date().toISOString();
        console.log('[DEBUG] Current time for filtering:', now);

        // For each event type, get scheduled events
        console.log('[DEBUG] Processing event types...');
        for (const eventType of eventsData.collection || []) {
            console.log('[DEBUG] Processing event type:', eventType.name, eventType.uri);
            try {
                // Get upcoming meetings
                console.log('[DEBUG] Fetching scheduled events for event type...');
                const upcomingResponse = await axios.get(`https://api.calendly.com/scheduled_events?user=${encodeURIComponent(userUri)}&event_type=${encodeURIComponent(eventType.uri)}&min_start_time=${encodeURIComponent(now)}&status=active&sort=start_time`, {
                    headers: {
                        'Authorization': `Bearer ${calendlyToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                const upcomingData = upcomingResponse.data;
                console.log('[DEBUG] Scheduled events for event type:', upcomingData);
                console.log('[DEBUG] Events count:', upcomingData.collection?.length || 0);
                    
                    for (const meeting of upcomingData.collection || []) {
                        console.log('[DEBUG] Processing meeting:', meeting.uri);
                        
                        // Check if meeting already exists
                        const existingMeeting = meetings.find(m => m.calendly_id === meeting.uri && m.username === username);
                        console.log('[DEBUG] Existing meeting found:', !!existingMeeting);
                        
                        if (!existingMeeting) {
                            console.log('[DEBUG] Adding new meeting:', meeting.uri);
                            
                            // Get invitee details
                            let inviteeData = null;
                            try {
                                console.log('[DEBUG] Fetching invitee for meeting:', meeting.uri);
                                const inviteeResponse = await axios.get(`https://api.calendly.com/scheduled_events/${meeting.uri.split('/').pop()}/invitees`, {
                                    headers: {
                                        'Authorization': `Bearer ${calendlyToken}`,
                                        'Content-Type': 'application/json'
                                    }
                                });
                                
                                const inviteeResult = inviteeResponse.data;
                                console.log('[DEBUG] Invitee data received:', inviteeResult);
                                inviteeData = inviteeResult.collection && inviteeResult.collection.length > 0 ? inviteeResult.collection[0] : null;
                                console.log('[DEBUG] Processed invitee data:', inviteeData);
                            } catch (error) {
                                console.log('[DEBUG] Error fetching invitee for meeting:', meeting.uri, error);
                            }

                            const newMeeting = {
                                id: Date.now() + Math.random(),
                                username: username,
                                calendly_id: meeting.uri,
                                name: meeting.name,
                                start_time: meeting.start_time,
                                end_time: meeting.end_time,
                                status: meeting.status,
                                location: meeting.location,
                                event_type: eventType.name,
                                event_type_uri: eventType.uri,
                                invitee: inviteeData,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                                notifications_sent: {
                                    booking_confirmation: false,
                                    five_days_reminder: false,
                                    four_days_reminder: false,
                                    three_days_reminder: false,
                                    two_days_reminder: false,
                                    one_day_reminder: false,
                                    twelve_hours_reminder: false,
                                    six_hours_reminder: false,
                                    three_hours_reminder: false,
                                    one_hour_reminder: false,
                                    five_minutes_reminder: false,
                                    meeting_live: false,
                                    post_meeting_thanks: false
                                }
                            };
                            
                            meetings.push(newMeeting);
                            newMeetings.push(newMeeting);
                            updatedCount++;
                            console.log('[DEBUG] Meeting added, total new meetings:', updatedCount);
                        } else {
                            console.log('[DEBUG] Meeting already exists, skipping');
                        }
                    }
            } catch (error) {
                console.error('[DEBUG] Error processing event type:', eventType.uri, error);
            }
        }

        console.log('[DEBUG] Finished processing all event types. Total new meetings:', updatedCount);

        // Save updated meetings
        if (updatedCount > 0) {
            console.log('[DEBUG] Saving', updatedCount, 'new meetings to file');
            const saveResult = saveMeetings(meetings);
            console.log('[DEBUG] Save result:', saveResult);
            
            // Schedule notifications for new meetings
            console.log('[DEBUG] Scheduling notifications for new meetings');
            for (const meeting of newMeetings) {
                await scheduleNotificationsForMeeting(meeting);
            }
        } else {
            console.log('[DEBUG] No new meetings to save');
        }

        const finalResult = {
            success: true,
            newMeetings: updatedCount,
            totalMeetings: meetings.filter(m => m.username === username).length
        };
        
        console.log('[DEBUG] syncCalendlyMeetings - End with result:', finalResult);
        return finalResult;

    } catch (error) {
        console.error('[DEBUG] Error syncing Calendly meetings:', error);
        const errorResult = {
            success: false,
            error: error.message
        };
        console.log('[DEBUG] syncCalendlyMeetings - End with error:', errorResult);
        return errorResult;
    }
}

// Schedule notifications for a meeting
async function scheduleNotificationsForMeeting(meeting) {
    try {
        console.log('[DEBUG] scheduleNotificationsForMeeting - Start for meeting:', meeting.calendly_id);
        
        const users = readUsers();
        const user = users.find(u => u.username === meeting.username);
        
        if (!user || !user.settings || !user.settings.calendly_token) {
            console.log('[DEBUG] User or Calendly token not found for notifications');
            return;
        }

        // Extract WhatsApp number from invitee data
        let whatsappNumber = null;
        if (meeting.invitee) {
            console.log('[DEBUG] Checking invitee data for WhatsApp number:', meeting.invitee);
            
            // Check if there's a phone number field
            if (meeting.invitee.phone) {
                whatsappNumber = meeting.invitee.phone;
                console.log('[DEBUG] Found phone number:', whatsappNumber);
            }
            
            // Check questions_and_answers for WhatsApp-related fields
            if (meeting.invitee.questions_and_answers) {
                console.log('[DEBUG] Checking questions and answers:', meeting.invitee.questions_and_answers);
                
                for (const qa of meeting.invitee.questions_and_answers) {
                    // Look for questions that contain "whatsapp", "phone", "mobile", "number"
                    const question = qa.question?.toLowerCase() || '';
                    const answer = qa.answer || '';
                    
                    if ((question.includes('whatsapp') || 
                         question.includes('phone') || 
                         question.includes('mobile') || 
                         question.includes('number')) && answer) {
                        whatsappNumber = answer;
                        console.log('[DEBUG] Found WhatsApp number from Q&A:', whatsappNumber, 'for question:', question);
                        break;
                    }
                }
            }
            
            // Check custom fields for WhatsApp number
            if (meeting.invitee.custom_fields && !whatsappNumber) {
                console.log('[DEBUG] Checking custom fields:', meeting.invitee.custom_fields);
                
                for (const field of meeting.invitee.custom_fields) {
                    const fieldName = field.name?.toLowerCase() || '';
                    const fieldValue = field.value || '';
                    
                    if ((fieldName.includes('whatsapp') || 
                         fieldName.includes('phone') || 
                         fieldName.includes('mobile') || 
                         fieldName.includes('number')) && fieldValue) {
                        whatsappNumber = fieldValue;
                        console.log('[DEBUG] Found WhatsApp number from custom field:', whatsappNumber, 'for field:', fieldName);
                        break;
                    }
                }
            }
        }
        
        if (!whatsappNumber) {
            console.log('[DEBUG] No WhatsApp number found for meeting:', meeting.calendly_id);
            return;
        }
        
        // Clean and format the WhatsApp number
        whatsappNumber = whatsappNumber.replace(/[^\d]/g, ''); // Remove non-digits
        if (whatsappNumber.startsWith('0')) {
            whatsappNumber = '91' + whatsappNumber.substring(1); // Assume Indian number
        } else if (!whatsappNumber.startsWith('91') && whatsappNumber.length === 10) {
            whatsappNumber = '91' + whatsappNumber; // Add country code for Indian numbers
        }
        
        console.log('[DEBUG] Formatted WhatsApp number:', whatsappNumber);

        // Get templates from separate file
        const templates = readTemplates();
        let userTemplates = templates.find(t => t.username === meeting.username);
        
        // If user doesn't have custom templates, use default
        if (!userTemplates) {
            userTemplates = templates.find(t => t.username === 'default');
        }
        
        if (!userTemplates || !userTemplates.templates) {
            console.log('[DEBUG] No templates found for user:', meeting.username);
            return;
        }

        const notifications = readNotifications();
        const meetingStart = new Date(meeting.start_time);
        const meetingEnd = new Date(meeting.end_time);
        const now = new Date();

        const notificationTypes = [
            { type: 'booking_confirmation', triggerTime: now },
            { type: 'five_days_reminder', triggerTime: new Date(meetingStart.getTime() - (5 * 24 * 60 * 60 * 1000)) },
            { type: 'four_days_reminder', triggerTime: new Date(meetingStart.getTime() - (4 * 24 * 60 * 60 * 1000)) },
            { type: 'three_days_reminder', triggerTime: new Date(meetingStart.getTime() - (3 * 24 * 60 * 60 * 1000)) },
            { type: 'two_days_reminder', triggerTime: new Date(meetingStart.getTime() - (2 * 24 * 60 * 60 * 1000)) },
            { type: 'one_day_reminder', triggerTime: new Date(meetingStart.getTime() - (1 * 24 * 60 * 60 * 1000)) },
            { type: 'twelve_hours_reminder', triggerTime: new Date(meetingStart.getTime() - (12 * 60 * 60 * 1000)) },
            { type: 'six_hours_reminder', triggerTime: new Date(meetingStart.getTime() - (6 * 60 * 60 * 1000)) },
            { type: 'three_hours_reminder', triggerTime: new Date(meetingStart.getTime() - (3 * 60 * 60 * 1000)) },
            { type: 'one_hour_reminder', triggerTime: new Date(meetingStart.getTime() - (1 * 60 * 60 * 1000)) },
            { type: 'five_minutes_reminder', triggerTime: new Date(meetingStart.getTime() - (5 * 60 * 1000)) },
            { type: 'meeting_live', triggerTime: meetingStart },
            { type: 'post_meeting_thanks', triggerTime: new Date(meetingEnd.getTime() + (1 * 60 * 60 * 1000)) }
        ];

        console.log('[DEBUG] Creating notifications for meeting with WhatsApp number:', whatsappNumber);
        
        for (const notificationType of notificationTypes) {
            const template = userTemplates.templates[notificationType.type];
            
            if (template && template.enabled && notificationType.triggerTime > now) {
                const notification = {
                    id: Date.now() + Math.random(),
                    username: meeting.username,
                    meeting_id: meeting.id,
                    calendly_id: meeting.calendly_id,
                    type: notificationType.type,
                    trigger_time: notificationType.triggerTime.toISOString(),
                    message: replaceVariables(template.message, meeting),
                    mediaFromLibrary: template.mediaFromLibrary || null, // Include media from template
                    whatsapp_number: whatsappNumber, // Add WhatsApp number for sending
                    recipient_name: meeting.invitee?.name || 'Guest',
                    status: 'scheduled',
                    created_at: new Date().toISOString()
                };
                
                console.log('[DEBUG] Created notification:', notification.type, 'for time:', notification.trigger_time);
                notifications.push(notification);
            } else {
                console.log('[DEBUG] Skipping notification type:', notificationType.type, 'enabled:', template?.enabled, 'future:', notificationType.triggerTime > now);
            }
        }

        saveNotifications(notifications);

    } catch (error) {
        console.error('Error scheduling notifications for meeting:', meeting.id, error);
    }
}

// Replace variables in message templates
function replaceVariables(message, meeting) {
    if (!message || !meeting) return message;
    
    const inviteeName = meeting.invitee ? meeting.invitee.name : 'Guest';
    const inviteeEmail = meeting.invitee ? meeting.invitee.email : '';
    const meetingDate = new Date(meeting.start_time).toLocaleDateString();
    const meetingTime = new Date(meeting.start_time).toLocaleTimeString();
    const joinUrl = meeting.location && meeting.location.join_url ? meeting.location.join_url : '';
    
    return message
        .replace(/{{invitee_name}}/g, inviteeName)
        .replace(/{{invitee_email}}/g, inviteeEmail)
        .replace(/{{meeting_name}}/g, meeting.name)
        .replace(/{{meeting_date}}/g, meetingDate)
        .replace(/{{meeting_time}}/g, meetingTime)
        .replace(/{{join_url}}/g, joinUrl)
        .replace(/{{event_type}}/g, meeting.event_type);
}

// API Routes

// Get all meetings for a user
router.get('/', (req, res) => {
    console.log('[DEBUG] GET /calendly - Start');
    console.log('[DEBUG] Session user:', req.session?.user);
    console.log('[DEBUG] Request headers:', req.headers);
    
    try {
        if (!req.session.user) {
            console.log('[DEBUG] No user session found');
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const username = req.session.user.username;
        console.log('[DEBUG] Username from session:', username);

        const meetings = readMeetings();
        console.log('[DEBUG] Total meetings in file:', meetings.length);
        
        const userMeetings = meetings.filter(m => m.username === username);
        console.log('[DEBUG] User meetings found:', userMeetings.length);
        
        // Sort by start time
        userMeetings.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        console.log('[DEBUG] Returning sorted meetings:', JSON.stringify(userMeetings, null, 2));
        res.json(userMeetings);
        console.log('[DEBUG] GET /calendly - End');
    } catch (error) {
        console.error('[DEBUG] Error getting meetings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sync meetings from Calendly
router.post('/sync', async (req, res) => {
    console.log('[DEBUG] POST /calendly/sync - Start');
    console.log('[DEBUG] Session user:', req.session?.user);
    
    try {
        if (!req.session.user) {
            console.log('[DEBUG] No user session found for sync');
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const username = req.session.user.username;
        console.log('[DEBUG] Username for sync:', username);

        const users = readUsers();
        console.log('[DEBUG] Total users loaded:', users.length);
        
        const user = users.find(u => u.username === username);
        console.log('[DEBUG] User found:', !!user);
        console.log('[DEBUG] User settings:', user?.settings);
        
        if (!user || !user.settings || !user.settings.calendly_token) {
            console.log('[DEBUG] Calendly token not found or configured');
            return res.status(400).json({ error: 'Calendly token not configured' });
        }

        console.log('[DEBUG] Starting sync with token:', user.settings.calendly_token.substring(0, 10) + '...');
        const result = await syncCalendlyMeetings(username, user.settings.calendly_token);
        console.log('[DEBUG] Sync result:', result);
        
        if (result.success) {
            const response = {
                message: 'Meetings synced successfully',
                newMeetings: result.newMeetings,
                totalMeetings: result.totalMeetings
            };
            console.log('[DEBUG] Sync successful, returning:', response);
            res.json(response);
        } else {
            console.log('[DEBUG] Sync failed, returning error:', result.error);
            res.status(400).json({ error: result.error });
        }
        
        console.log('[DEBUG] POST /calendly/sync - End');
    } catch (error) {
        console.error('[DEBUG] Error syncing meetings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update Calendly settings
router.put('/settings', (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const username = req.session.user.username;

        const { calendly_token } = req.body;
        
        const users = readUsers();
        const userIndex = users.findIndex(u => u.username === username);
        
        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!users[userIndex].settings) {
            users[userIndex].settings = {};
        }

        // Only save the token - sync and notifications are always enabled
        if (calendly_token !== undefined) {
            users[userIndex].settings.calendly_token = calendly_token;
        }

        if (saveUsers(users)) {
            res.json({ message: 'Calendly token saved successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save token' });
        }
    } catch (error) {
        console.error('Error updating Calendly settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Calendly settings
router.get('/settings', (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const username = req.session.user.username;

        const users = readUsers();
        const user = users.find(u => u.username === username);
        
        if (!user || !user.settings) {
            return res.json({
                calendly_token: ''
            });
        }

        res.json({
            calendly_token: user.settings.calendly_token || ''
        });
    } catch (error) {
        console.error('Error getting Calendly settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get meeting notifications
router.get('/notifications', (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const username = req.session.user.username;

        const notifications = readNotifications();
        const userNotifications = notifications.filter(n => n.username === username);
        
        res.json(userNotifications);
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get reminder templates
router.get('/templates', (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const username = req.session.user.username;

        const templates = readTemplates();
        let userTemplates = templates.find(t => t.username === username);
        
        // If user doesn't have custom templates, return default
        if (!userTemplates) {
            userTemplates = templates.find(t => t.username === 'default');
        }
        
        res.json(userTemplates || { templates: {} });
    } catch (error) {
        console.error('Error getting templates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update reminder templates
router.put('/templates', (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const username = req.session.user.username;

        const { templates } = req.body;
        
        const allTemplates = readTemplates();
        const userIndex = allTemplates.findIndex(t => t.username === username);
        
        if (userIndex === -1) {
            // Create new template entry for user
            allTemplates.push({
                username: username,
                templates: templates
            });
        } else {
            // Update existing templates
            allTemplates[userIndex].templates = templates;
        }

        if (saveTemplates(allTemplates)) {
            res.json({ message: 'Templates updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save templates' });
        }
    } catch (error) {
        console.error('Error updating templates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export sync function for cron job
module.exports = router;
module.exports.syncCalendlyMeetings = syncCalendlyMeetings;
module.exports.readNotifications = readNotifications;
module.exports.saveNotifications = saveNotifications;
module.exports.replaceVariables = replaceVariables;
