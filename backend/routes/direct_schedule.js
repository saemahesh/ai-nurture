const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataPath = path.join(__dirname, '..', 'data');
const directSchedulesFilePath = path.join(dataPath, 'direct_schedules.json');

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
        const schedules = readSchedules();
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
        const { number, message, mediaUrl, scheduledAt } = req.body;
        
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
            status: 'Scheduled',
            createdAt: new Date().toISOString()
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
        const { number, message, mediaUrl, scheduledAt } = req.body;
        
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
            updatedAt: new Date().toISOString()
            // status and createdAt remain unchanged
        };

        writeSchedules(schedules);
        res.json(schedules[scheduleIndex]);
    } catch (error) {
        console.error('Error updating follow up:', error);
        res.status(500).json({ message: 'Failed to update follow up. Please try again.' });
    }
});

module.exports = router;
