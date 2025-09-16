const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
    constructor() {
        this.transporter = null;
        this.loadEmailSettings();
    }

    loadEmailSettings() {
        try {
            const settingsPath = path.join(__dirname, '../data/email_settings.json');
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                this.createTransporter(settings);
            }
        } catch (error) {
            console.error('Error loading email settings:', error);
        }
    }

    createTransporter(settings) {
        try {
            this.transporter = nodemailer.createTransporter({
                host: settings.smtpServer,
                port: settings.smtpPort || 587,
                secure: settings.smtpPort === 465, // true for 465, false for other ports
                auth: {
                    user: settings.email,
                    pass: settings.password
                }
            });
        } catch (error) {
            console.error('Error creating email transporter:', error);
        }
    }

    async updateEmailSettings(settings) {
        try {
            const settingsPath = path.join(__dirname, '../data/email_settings.json');
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
            this.createTransporter(settings);
            return { success: true, message: 'Email settings updated successfully' };
        } catch (error) {
            console.error('Error updating email settings:', error);
            return { success: false, message: 'Failed to update email settings' };
        }
    }

    async testConnection() {
        if (!this.transporter) {
            return { success: false, message: 'Email not configured' };
        }

        try {
            await this.transporter.verify();
            return { success: true, message: 'Email connection successful' };
        } catch (error) {
            console.error('Email connection test failed:', error);
            return { success: false, message: 'Email connection failed: ' + error.message };
        }
    }

    async sendMeetingReminder(to, meetingDetails) {
        if (!this.transporter) {
            console.log('Email not configured, skipping email reminder');
            return { success: false, message: 'Email not configured' };
        }

        try {
            const mailOptions = {
                from: await this.getFromAddress(),
                to: to,
                subject: `Meeting Reminder: ${meetingDetails.title}`,
                html: this.generateMeetingReminderHTML(meetingDetails)
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Meeting reminder email sent:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Error sending meeting reminder email:', error);
            return { success: false, message: error.message };
        }
    }

    async sendCalendlyReminder(to, eventDetails) {
        if (!this.transporter) {
            console.log('Email not configured, skipping calendly reminder');
            return { success: false, message: 'Email not configured' };
        }

        try {
            const mailOptions = {
                from: await this.getFromAddress(),
                to: to,
                subject: `Calendly Meeting Reminder: ${eventDetails.name}`,
                html: this.generateCalendlyReminderHTML(eventDetails)
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Calendly reminder email sent:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Error sending calendly reminder email:', error);
            return { success: false, message: error.message };
        }
    }

    async getFromAddress() {
        try {
            const settingsPath = path.join(__dirname, '../data/email_settings.json');
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                return settings.email;
            }
        } catch (error) {
            console.error('Error getting from address:', error);
        }
        return 'noreply@localhost';
    }

    generateMeetingReminderHTML(meetingDetails) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Meeting Reminder</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                .content { padding: 20px 0; }
                .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
                .details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Meeting Reminder</h2>
                </div>
                <div class="content">
                    <p>Hello,</p>
                    <p>This is a reminder about your upcoming meeting:</p>
                    <div class="details">
                        <h3>${meetingDetails.title || 'Meeting'}</h3>
                        <p><strong>Date:</strong> ${meetingDetails.date || 'Not specified'}</p>
                        <p><strong>Time:</strong> ${meetingDetails.time || 'Not specified'}</p>
                        ${meetingDetails.location ? `<p><strong>Location:</strong> ${meetingDetails.location}</p>` : ''}
                        ${meetingDetails.description ? `<p><strong>Description:</strong> ${meetingDetails.description}</p>` : ''}
                    </div>
                    ${meetingDetails.joinUrl ? `<a href="${meetingDetails.joinUrl}" class="button">Join Meeting</a>` : ''}
                    <p>Best regards,<br>Your Meeting System</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    generateCalendlyReminderHTML(eventDetails) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Calendly Meeting Reminder</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #00a2ff; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                .content { padding: 20px 0; }
                .button { display: inline-block; padding: 12px 24px; background-color: #00a2ff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
                .details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Calendly Meeting Reminder</h2>
                </div>
                <div class="content">
                    <p>Hello,</p>
                    <p>This is a reminder about your scheduled Calendly meeting:</p>
                    <div class="details">
                        <h3>${eventDetails.name || 'Calendly Meeting'}</h3>
                        <p><strong>Date:</strong> ${eventDetails.start_time ? new Date(eventDetails.start_time).toLocaleDateString() : 'Not specified'}</p>
                        <p><strong>Time:</strong> ${eventDetails.start_time ? new Date(eventDetails.start_time).toLocaleTimeString() : 'Not specified'}</p>
                        ${eventDetails.location ? `<p><strong>Location:</strong> ${eventDetails.location.location}</p>` : ''}
                        ${eventDetails.event_type_name ? `<p><strong>Event Type:</strong> ${eventDetails.event_type_name}</p>` : ''}
                    </div>
                    ${eventDetails.location && eventDetails.location.join_url ? `<a href="${eventDetails.location.join_url}" class="button">Join Meeting</a>` : ''}
                    <p>Best regards,<br>Your Calendly System</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
}

module.exports = new EmailService();
