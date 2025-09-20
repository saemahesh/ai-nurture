const express = require('express');
const { getDataFilePath } = require('../data-utils');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const directSchedulesFilePath = getDataFilePath('direct_schedules.json');

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ message: 'You must be logged in to perform this action.' });
    }
}

// Helper function to read schedules
const readSchedules = () => {
    try {
        if (!fs.existsSync(directSchedulesFilePath)) {
            // Create empty file if it doesn't exist
            fs.writeFileSync(directSchedulesFilePath, '[]');
            return [];
        }
        const data = fs.readFileSync(directSchedulesFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading follow ups:', error);
        // Return empty array and create file if there's an error
        fs.writeFileSync(directSchedulesFilePath, '[]');
        return [];
    }
};

// Helper function to write schedules
const writeSchedules = (schedules) => {
    try {
        fs.writeFileSync(directSchedulesFilePath, JSON.stringify(schedules, null, 2));
    } catch (error) {
        console.error('Error writing follow ups:', error);
        throw error;
    }
};

// Get all schedules for the logged-in user
router.get('/', isAuthenticated, (req, res) => {
    try {
        let schedules = readSchedules();
        let needsWrite = false;
        
        // Migrate old schedules that don't have repeat, days, or paused fields
        schedules = schedules.map(schedule => {
            if (!schedule.hasOwnProperty('repeat')) {
                schedule.repeat = 'once'; // Default for old schedules
                needsWrite = true;
            }
            if (!schedule.hasOwnProperty('days')) {
                schedule.days = {}; // Default empty days
                needsWrite = true;
            }
            if (!schedule.hasOwnProperty('paused')) {
                schedule.paused = false;
                needsWrite = true;
            }
            return schedule;
        });
        
        // Write back the migrated data if needed
        if (needsWrite) {
            writeSchedules(schedules);
            console.log('📝 [DIRECT-SCHEDULE-API] Migrated old schedules with repeat and days fields');
        }
        
        const userSchedules = schedules.filter(s => s.username === req.session.user.username);
        res.json(userSchedules);
    } catch (error) {
        console.error('Error getting follow ups:', error);
        res.status(500).json({ message: 'Failed to load follow ups' });
    }
});

// Create a new schedule
router.post('/', isAuthenticated, (req, res) => {
    try {
        const { number, message, mediaUrl, scheduledAt, repeat, days } = req.body;
        
        // Validate required fields
        if (!number || !message || !scheduledAt) {
            return res.status(400).json({ message: 'Phone number, message, and scheduled time are required.' });
        }

        // Validate phone number format (basic validation)
        if (!/^\d{10,15}$/.test(number.replace(/\D/g, ''))) {
            return res.status(400).json({ message: 'Please enter a valid phone number.' });
        }

        // Validate scheduled date
        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
            return res.status(400).json({ message: 'Please enter a valid date and time.' });
        }

        if (scheduledDate <= new Date()) {
            return res.status(400).json({ message: 'Scheduled time must be in the future.' });
        }

        const schedules = readSchedules();
        const newSchedule = {
            id: uuidv4(),
            username: req.session.user.username,
            number: number.trim(),
            message: message.trim(),
            mediaUrl: mediaUrl || null,
            scheduledAt: scheduledDate.toISOString(),
            repeat: repeat || 'once', // Default to 'once' for backward compatibility
            days: days || {}, // Days selection for custom repeat
            status: 'Scheduled',
            createdAt: new Date().toISOString(),
            paused: false
        };

        schedules.push(newSchedule);
        writeSchedules(schedules);
        res.status(201).json(newSchedule);
    } catch (error) {
        console.error('Error creating follow up:', error);
        res.status(500).json({ message: 'Failed to create follow up. Please try again.' });
    }
});

// Delete a follow up
router.delete('/:id', isAuthenticated, (req, res) => {
    try {
        let schedules = readSchedules();
        const scheduleIndex = schedules.findIndex(s => s.id === req.params.id && s.username === req.session.user.username);

        if (scheduleIndex === -1) {
            return res.status(404).json({ message: 'Schedule not found or you do not have permission to delete it.' });
        }

        schedules.splice(scheduleIndex, 1);
        writeSchedules(schedules);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting follow up:', error);
        res.status(500).json({ message: 'Failed to delete follow up' });
    }
});


// Update (edit) a follow up
router.put('/:id', isAuthenticated, (req, res) => {
    try {
        const { number, message, mediaUrl, scheduledAt, repeat, days } = req.body;
        
        console.log('🔍 [DIRECT-SCHEDULE-API] PUT - Updating schedule with repeat:', repeat, 'days:', days);
        
        // Validate required fields
        if (!number || !message || !scheduledAt) {
            return res.status(400).json({ message: 'Phone number, message, and scheduled time are required.' });
        }

        // Validate phone number format (basic validation)
        if (!/^\d{10,15}$/.test(number.replace(/\D/g, ''))) {
            return res.status(400).json({ message: 'Please enter a valid phone number.' });
        }

        // Validate scheduled date
        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
            return res.status(400).json({ message: 'Please enter a valid date and time.' });
        }

        if (scheduledDate <= new Date()) {
            return res.status(400).json({ message: 'Scheduled time must be in the future.' });
        }

        let schedules = readSchedules();
        const scheduleIndex = schedules.findIndex(s => s.id === req.params.id && s.username === req.session.user.username);

        if (scheduleIndex === -1) {
            return res.status(404).json({ message: 'Schedule not found or you do not have permission to edit it.' });
        }

        // Update the schedule fields
        schedules[scheduleIndex] = {
            ...schedules[scheduleIndex],
            number: number.trim(),
            message: message.trim(),
            mediaUrl: mediaUrl || null,
            scheduledAt: scheduledDate.toISOString(),
            repeat: repeat || 'once', // Default to 'once' for backward compatibility
            days: days || {}, // Days selection for custom repeat
            updatedAt: new Date().toISOString(),
            // status, createdAt, and paused remain unchanged
        };

        // If editing a "once" type schedule, reset status to 'Scheduled' so it can be sent again
        if ((repeat || 'once') === 'once') {
            schedules[scheduleIndex].status = 'Scheduled';
            // Remove lastSent field if it exists (similar to status module)
            delete schedules[scheduleIndex].lastSent;
        }

        writeSchedules(schedules);
        res.json(schedules[scheduleIndex]);
    } catch (error) {
        console.error('Error updating follow up:', error);
        res.status(500).json({ message: 'Failed to update follow up. Please try again.' });
    }
});

// Pause a direct schedule
router.put('/:id/pause', isAuthenticated, (req, res) => {
    try {
        let schedules = readSchedules();
        const scheduleIndex = schedules.findIndex(s => s.id === req.params.id && s.username === req.session.user.username);
        if (scheduleIndex === -1) {
            return res.status(404).json({ message: 'Schedule not found or you do not have permission to pause it.' });
        }
        schedules[scheduleIndex].paused = true;
        writeSchedules(schedules);
        res.json(schedules[scheduleIndex]);
    } catch (error) {
        console.error('Error pausing schedule:', error);
        res.status(500).json({ message: 'Failed to pause schedule.' });
    }
});

// Resume a direct schedule
router.put('/:id/resume', isAuthenticated, (req, res) => {
    try {
        let schedules = readSchedules();
        const scheduleIndex = schedules.findIndex(s => s.id === req.params.id && s.username === req.session.user.username);
        if (scheduleIndex === -1) {
            return res.status(404).json({ message: 'Schedule not found or you do not have permission to resume it.' });
        }
        schedules[scheduleIndex].paused = false;
        writeSchedules(schedules);
        res.json(schedules[scheduleIndex]);
    } catch (error) {
        console.error('Error resuming schedule:', error);
        res.status(500).json({ message: 'Failed to resume schedule.' });
    }
});

module.exports = router;
