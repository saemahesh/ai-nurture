const express = require('express');
const { getDataFilePath } = require('../data-utils');
const router = express.Router();
const emailService = require('../services/email.service');
const fs = require('fs');
const path = require('path');

// Get email settings
router.get('/settings', (req, res) => {
    try {
        const settingsPath = getDataFilePath('email_settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            // Don't send password back to frontend
            const safeSettings = { ...settings };
            delete safeSettings.password;
            res.json({ success: true, settings: safeSettings });
        } else {
            res.json({ success: true, settings: {} });
        }
    } catch (error) {
        console.error('Error getting email settings:', error);
        res.status(500).json({ success: false, message: 'Failed to get email settings' });
    }
});

// Update email settings
router.post('/settings', async (req, res) => {
    try {
        const { email, password, smtpServer, smtpPort, provider } = req.body;

        if (!email || !password || !smtpServer) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email, password, and SMTP server are required' 
            });
        }

        const settings = {
            email,
            password,
            smtpServer,
            smtpPort: parseInt(smtpPort) || 587,
            provider: provider || 'custom'
        };

        const result = await emailService.updateEmailSettings(settings);
        res.json(result);
    } catch (error) {
        console.error('Error updating email settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update email settings' });
    }
});

// Test email connection
router.post('/test', async (req, res) => {
    try {
        const result = await emailService.testConnection();
        res.json(result);
    } catch (error) {
        console.error('Error testing email connection:', error);
        res.status(500).json({ success: false, message: 'Failed to test email connection' });
    }
});

// Send test email
router.post('/send-test', async (req, res) => {
    try {
        const { to } = req.body;
        
        if (!to) {
            return res.status(400).json({ 
                success: false, 
                message: 'Recipient email is required' 
            });
        }

        const testMeetingDetails = {
            title: 'Test Meeting Reminder',
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            description: 'This is a test email from your meeting reminder system.'
        };

        const result = await emailService.sendMeetingReminder(to, testMeetingDetails);
        res.json(result);
    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({ success: false, message: 'Failed to send test email' });
    }
});

// Get common email providers presets
router.get('/providers', (req, res) => {
    const providers = {
        gmail: {
            name: 'Gmail',
            smtpServer: 'smtp.gmail.com',
            smtpPort: 587,
            instructions: 'Use your Gmail address and App Password (not regular password). Enable 2FA and generate App Password in Google Account settings.'
        },
        outlook: {
            name: 'Outlook/Hotmail',
            smtpServer: 'smtp-mail.outlook.com',
            smtpPort: 587,
            instructions: 'Use your Outlook email and password. May need to enable less secure apps.'
        },
        yahoo: {
            name: 'Yahoo Mail',
            smtpServer: 'smtp.mail.yahoo.com',
            smtpPort: 587,
            instructions: 'Use your Yahoo email and App Password. Generate App Password in Yahoo Account Security settings.'
        },
        godaddy: {
            name: 'GoDaddy',
            smtpServer: 'smtpout.secureserver.net',
            smtpPort: 587,
            instructions: 'Use your GoDaddy email and password from your hosting account.'
        },
        custom: {
            name: 'Custom SMTP',
            smtpServer: '',
            smtpPort: 587,
            instructions: 'Enter your custom SMTP server details provided by your email provider.'
        }
    };

    res.json({ success: true, providers });
});

module.exports = router;
