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
        console.error('Error reading direct schedules:', error);
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
        console.error('Error writing direct schedules:', error);
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
        console.error('Error getting direct schedules:', error);
        res.status(500).json({ message: 'Failed to load schedules' });
    }
});

// Create a new schedule
router.post('/', isAuthenticated, (req, res) => {
    try {
        const { number, message, mediaUrl, scheduledAt } = req.body;
        if (!number || !message || !scheduledAt) {
            return res.status(400).json({ message: 'Phone number, message, and scheduled time are required.' });
        }

        const schedules = readSchedules();
        const newSchedule = {
            id: uuidv4(),
            username: req.session.user.username,
            number,
            message,
            mediaUrl: mediaUrl || null,
            scheduledAt,
            status: 'Scheduled',
            createdAt: new Date().toISOString()
        };

        schedules.push(newSchedule);
        writeSchedules(schedules);
        res.status(201).json(newSchedule);
    } catch (error) {
        console.error('Error creating direct schedule:', error);
        res.status(500).json({ message: 'Failed to create schedule' });
    }
});

// Delete a schedule
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
        console.error('Error deleting direct schedule:', error);
        res.status(500).json({ message: 'Failed to delete schedule' });
    }
});

module.exports = router;
