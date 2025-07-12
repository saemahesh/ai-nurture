angular.module('autopostWaApp.events').controller('EventRemindersController', function($scope, $routeParams, $timeout, ApiService) {
    $scope.reminders = {};
    $scope.events = [];
    $scope.groups = [];
    $scope.currentEvent = null;
    $scope.loading = true;
    $scope.error = '';
    $scope.success = '';
    $scope.mediaLibrary = [];
    $scope.showMediaSelector = false;
    $scope.currentReminderType = null;
    $scope.loadingMedia = false;

    // Enlarge media thumbnail
    $scope.enlargedMediaUrl = null;
    $scope.enlargeMedia = function(reminder) {
        var url = null;
        if (reminder.mediaFromLibrary && reminder.mediaFromLibrary.url) {
            url = reminder.mediaFromLibrary.url;
        } else if (reminder.mediaUrl) {
            url = reminder.mediaUrl;
        }
        if (url) {
            $scope.enlargedMediaUrl = url;
        }
    };
    $scope.closeEnlargedMedia = function() {
        $scope.enlargedMediaUrl = null;
    };

    // Load events first
    ApiService.getEvents().then(function(response) {
        $scope.events = response.data;
        
        // Check for selected media from media library
        checkForSelectedMedia();
        
        // If we have an event ID in the route params, load its reminders
        if ($routeParams.id) {
            const event = $scope.events.find(function(e) {
                return e.id === $routeParams.id;
            });
            
            if (event) {
                $scope.currentEvent = event;
                return ApiService.getEventReminders($routeParams.id);
            } else {
                throw new Error('Event not found');
            }
        }
    }).then(function(remindersResponse) {
        if (remindersResponse) {
            $scope.reminders = remindersResponse.data;
            // Restore mediaFromLibrary for each reminder if mediaId/mediaUrl is present
            Object.keys($scope.reminders).forEach(function(key) {
                var reminder = $scope.reminders[key];
                if (reminder.mediaId && reminder.mediaUrl) {
                    reminder.mediaFromLibrary = {
                        id: reminder.mediaId,
                        url: reminder.mediaUrl,
                        name: reminder.mediaId // Optionally fetch name from media library if needed
                    };
                }
            });
        }
        $scope.loading = false;
    }).catch(function(error) {
        $scope.error = error.message || 'Failed to load data';
        $scope.loading = false;
    });
    
    // Check if any media was selected from the media library
    function checkForSelectedMedia() {
        const selectedMedia = localStorage.getItem('selectedMediaForReminder');
        if (selectedMedia) {
            try {
                const media = JSON.parse(selectedMedia);
                $scope.selectedFromLibrary = media;
                localStorage.removeItem('selectedMediaForReminder');
                
                // Show success message if we came from the media library
                if (media) {
                    $scope.success = 'Media selected from library. Choose a reminder type to apply it to.';
                    $timeout(function() {
                        $scope.success = '';
                    }, 5000);
                }
            } catch (e) {
                console.error('Error parsing selected media:', e);
                localStorage.removeItem('selectedMediaForReminder');
            }
        }
    }

    // Load media library
    $scope.loadMediaLibrary = function() {
        $scope.loadingMedia = true;
        ApiService.getMedia()
            .then(function(response) {
                $scope.mediaLibrary = response.data;
                $scope.loadingMedia = false;
            })
            .catch(function(error) {
                $scope.error = 'Failed to load media library';
                $scope.loadingMedia = false;
            });
    };
    
    // Open media selector for a specific reminder type
    $scope.openMediaSelector = function(reminderType) {
        $scope.currentReminderType = reminderType;
        $scope.showMediaSelector = true;
        $scope.loadMediaLibrary();
    };
    
    // Close media selector
    $scope.closeMediaSelector = function() {
        $scope.showMediaSelector = false;
        $scope.currentReminderType = null;
    };
    
    // Select media from library for a reminder
    $scope.selectMediaForReminder = function(media, reminderType) {
        if (!reminderType) {
            reminderType = $scope.currentReminderType;
        }
        
        if (!reminderType) {
            $scope.error = 'No reminder type selected';
            return;
        }
        
        if (!$scope.reminders[reminderType]) {
            $scope.reminders[reminderType] = {
                enabled: true,
                text: 'Don\'t forget about {{eventName}} coming up!',
            };
        }
        
        $scope.reminders[reminderType].mediaFromLibrary = media;
        $scope.reminders[reminderType].mediaPreview = media.name;
        $scope.reminders[reminderType].hasNewMedia = false;
        $scope.reminders[reminderType].enabled = true;
        
        // If the selected media was from the library navigation
        if ($scope.selectedFromLibrary && !reminderType) {
            $scope.success = 'Please select a reminder type to apply this media';
        } else {
            $scope.success = 'Media selected for ' + $scope.getReminderLabel(reminderType);
            $scope.closeMediaSelector();
            
            $timeout(function() {
                $scope.success = '';
            }, 3000);
        }
    };
    
    // Apply selected media from library to a reminder type
    $scope.applySelectedMediaToReminder = function(reminderType) {
        if ($scope.selectedFromLibrary) {
            $scope.selectMediaForReminder($scope.selectedFromLibrary, reminderType);
            $scope.selectedFromLibrary = null;
        }
    };

    // Function to select an event and load its reminders
    $scope.selectEvent = function(eventId) {
        $scope.loading = true;
        $scope.error = '';
        
        const event = $scope.events.find(function(e) {
            return e.id === eventId;
        });
        
        if (event) {
            $scope.currentEvent = event;
            ApiService.getEventReminders(eventId)
                .then(function(response) {
                    $scope.reminders = response.data;
                    $scope.loading = false;
                })
                .catch(function(error) {
                    $scope.error = error.message || 'Failed to load reminders';
                    $scope.loading = false;
                });
        }
    };

    $scope.saveReminders = function() {
        $scope.loading = true;
        $scope.error = '';
        $scope.success = '';

        if (!$scope.currentEvent) {
            $scope.error = 'No event selected';
            return;
        }

        const eventId = $scope.currentEvent.id;
        // Convert reminders to format expected by the API
        // Include selected media information
        const reminderData = {};
        Object.keys($scope.reminders).forEach(key => {
            const reminder = $scope.reminders[key];
            reminderData[key] = {
                enabled: reminder.enabled || false,
                text: reminder.text || '',
            };
            // If media from library was selected
            if (reminder.mediaFromLibrary) {
                reminderData[key].mediaId = reminder.mediaFromLibrary.id;
                reminderData[key].mediaUrl = reminder.mediaFromLibrary.url;
            }
        });

        // Send as JSON, not FormData
        ApiService.saveEventReminders(eventId, { reminderConfig: reminderData })
            .then(function(response) {
                $scope.success = 'Reminders saved successfully';
                if (response.data.scheduleInfo && response.data.scheduleInfo.skippedReminders.length) {
                    $scope.hasPastReminders = true;
                    $scope.pastReminders = response.data.scheduleInfo.skippedReminders;
                }
            })
            .catch(function(error) {
                $scope.error = error.data?.error || 'Failed to save reminders';
            })
            .finally(function() {
                $scope.loading = false;
            });
    };

    // Helper function to format date
    $scope.formatDate = function(date) {
        return new Date(date).toLocaleString();
    };

    // Helper function to get reminder label
    $scope.getReminderLabel = function(type) {
        const labels = {
            '5days': '5 days before',
            '4days': '4 days before',
            '3days': '3 days before',
            '2days': '2 days before',
            '1day': '1 day before',
            '12hours': '12 hours before',
            '6hours': '6 hours before',
            '3hours': '3 hours before',
            '1hour': '1 hour before',
            '30mins': '30 minutes before',
            'live': 'At event start'
        };
        return labels[type] || type;
    };

    // Remove media from a reminder
    $scope.removeImage = function(reminderType) {
        $scope.reminders[reminderType].mediaFromLibrary = null;
        $scope.reminders[reminderType].mediaPreview = null;
        $scope.reminders[reminderType].hasNewMedia = false;
    };

    // Helper: get all reminder types and their offsets (ms)
    const REMINDER_OFFSETS = {
        '5days': 5 * 24 * 60 * 60 * 1000,
        '4days': 4 * 24 * 60 * 60 * 1000,
        '3days': 3 * 24 * 60 * 60 * 1000,
        '2days': 2 * 24 * 60 * 60 * 1000,
        '1day': 1 * 24 * 60 * 60 * 1000,
        '12hours': 12 * 60 * 60 * 1000,
        '6hours': 6 * 60 * 60 * 1000,
        '3hours': 3 * 60 * 60 * 1000,
        '1hour': 1 * 60 * 60 * 1000,
        '30mins': 30 * 60 * 1000,
        'live': 0
    };

    // Returns an array of reminder types that are still upcoming
    $scope.getUpcomingReminderTypes = function(section) {
        if (!$scope.currentEvent) return [];
        const now = new Date();
        const eventTime = new Date($scope.currentEvent.time);
        return Object.keys(REMINDER_OFFSETS).filter(function(type) {
            // Section filter: days or hours/minutes
            if (section === 'days' && !type.endsWith('days') && type !== '1day') return false;
            if (section === 'hours' && (type.endsWith('days') || type === '1day')) return false;
            // Calculate scheduled time
            const scheduled = new Date(eventTime.getTime() - REMINDER_OFFSETS[type]);
            return scheduled > now;
        });
    };
});