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
    $scope.showSaveSuccessPopup = false;

    // Function to show success popup
    $scope.showSaveSuccessMessage = function() {
        console.log('showSaveSuccessMessage called');
        $scope.showSaveSuccessPopup = true;
        console.log('showSaveSuccessPopup after setting to true:', $scope.showSaveSuccessPopup);
        
        // Force digest cycle to ensure UI updates
        if (!$scope.$$phase) {
            $scope.$apply();
        }
        
        // Auto-hide popup after 4 seconds
        $timeout(function() {
            console.log('Auto-hiding popup after 4 seconds');
            $scope.showSaveSuccessPopup = false;
        }, 4000);
    };

    // Function to manually close success popup
    $scope.closeSaveSuccessPopup = function() {
        $scope.showSaveSuccessPopup = false;
    };

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
        console.log('loadMediaLibrary called');
        $scope.loadingMedia = true;
        ApiService.getMedia()
            .then(function(response) {
                console.log('Media library loaded:', response.data);
                $scope.mediaLibrary = response.data;
                $scope.loadingMedia = false;
            })
            .catch(function(error) {
                console.error('Error loading media library:', error);
                $scope.error = 'Failed to load media library';
                $scope.loadingMedia = false;
            });
    };
    
    // Open media selector for a specific reminder type
    $scope.openMediaSelector = function(reminderType) {
        console.log('openMediaSelector called with reminder type:', reminderType);
        $scope.currentReminderType = reminderType;
        $scope.showMediaSelector = true;
        $scope.loadMediaLibrary();
        console.log('Media selector should now be visible:', $scope.showMediaSelector);
    };
    
    // Close media selector
    $scope.closeMediaSelector = function() {
        $scope.showMediaSelector = false;
        $scope.currentReminderType = null;
    };
    
    // Select media from library for a reminder
    $scope.selectMediaForReminder = function(media, reminderType) {
        console.log('selectMediaForReminder called with:', media, reminderType);
        
        if (!reminderType) {
            reminderType = $scope.currentReminderType;
        }
        
        if (!reminderType) {
            console.error('No reminder type selected');
            $scope.error = 'No reminder type selected';
            return;
        }
        
        console.log('Setting media for reminder type:', reminderType);
        
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
        
        console.log('Media set for reminder:', $scope.reminders[reminderType]);
        
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
        
        // Force scope update
        if (!$scope.$$phase) {
            $scope.$apply();
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
            $scope.loadReminders();
        }
    };

    // Helper function to load reminders data
    $scope.loadReminders = function(setLoading = true) {
        if (setLoading) {
            $scope.loading = true;
        }
        if (!$scope.currentEvent) {
            if (setLoading) {
                $scope.loading = false;
            }
            return;
        }
        ApiService.getEventReminders($scope.currentEvent.id)
            .then(function(response) {
                console.log('Loaded reminders from API:', response.data);
                $scope.reminders = response.data;
                
                // Restore mediaFromLibrary for each reminder if mediaId/mediaUrl is present
                Object.keys($scope.reminders).forEach(function(key) {
                    var reminder = $scope.reminders[key];
                    if (reminder.mediaId && reminder.mediaUrl) {
                        console.log('Reconstructing mediaFromLibrary for', key, reminder);
                        reminder.mediaFromLibrary = {
                            id: reminder.mediaId,
                            url: reminder.mediaUrl,
                            name: reminder.mediaId // Use mediaId as name, can be improved
                        };
                    }
                });
                
                // Ensure reminders object has all upcoming types
                const upcomingDays = $scope.getUpcomingReminderTypes('days');
                const upcomingHours = $scope.getUpcomingReminderTypes('hours');
                upcomingDays.concat(upcomingHours).forEach(function(type) {
                    if (!$scope.reminders[type]) {
                        $scope.reminders[type] = { text: '', mediaUrl: '', enabled: true };
                    }
                });
                // Clear any temporary flags
                Object.keys($scope.reminders).forEach(function(key) {
                    $scope.reminders[key].removingMedia = false;
                });
                if (setLoading) {
                    $scope.loading = false;
                }
            })
            .catch(function(error) {
                $scope.error = error.message || 'Failed to load reminders';
                if (setLoading) {
                    $scope.loading = false;
                }
            });
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
            // If media should be removed, explicitly set to null
            else if (reminder.removeMedia) {
                reminderData[key].mediaId = null;
                reminderData[key].mediaUrl = null;
                // Clear the remove flag after saving
                reminder.removeMedia = false;
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
                
                // Reload reminders data to refresh UI after successful save
                // Don't set loading state since we're already in a loading state
                $scope.loadReminders(false);
            })
            .catch(function(error) {
                $scope.error = error.data?.error || 'Failed to save reminders';
            })
            .finally(function() {
                $scope.loading = false;
            });
    };

    // Save a single reminder
    $scope.saveReminder = function(reminderType) {
        $scope.error = '';
        $scope.success = '';
        if (!$scope.currentEvent) {
            $scope.error = 'No event selected';
            return;
        }
        const eventId = $scope.currentEvent.id;
        const reminder = $scope.reminders[reminderType];
        const reminderData = {
            enabled: reminder.enabled || false,
            text: reminder.text || '',
        };
        if (reminder.mediaFromLibrary) {
            reminderData.mediaId = reminder.mediaFromLibrary.id;
            reminderData.mediaUrl = reminder.mediaFromLibrary.url;
        }
        if (reminder.removeMedia) {
            reminderData.mediaId = null;
            reminderData.mediaUrl = null;
            reminder.removeMedia = false;
        }
        ApiService.saveEventReminders(eventId, { reminderConfig: { [reminderType]: reminderData } })
            .then(function(response) {
                console.log('Reminder saved successfully for type:', reminderType);
                console.log('Triggering save success popup...');
                $scope.success = 'Reminder saved successfully';
                
                // Directly set popup state
                $scope.showSaveSuccessPopup = true;
                console.log('showSaveSuccessPopup directly set to:', $scope.showSaveSuccessPopup);
                
                // Auto-hide popup after 4 seconds
                $timeout(function() {
                    console.log('Auto-hiding popup after 4 seconds');
                    $scope.showSaveSuccessPopup = false;
                }, 4000);
                
                $scope.loadReminders(false);
                
                // Clear the success message after popup is shown
                $timeout(function() {
                    $scope.success = '';
                }, 1000);
            })
            .catch(function(error) {
                console.error('Error saving reminder:', error);
                $scope.error = error.data?.error || 'Failed to save reminder';
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
        // Clear all media-related properties
        $scope.reminders[reminderType].mediaFromLibrary = null;
        $scope.reminders[reminderType].mediaPreview = null;
        $scope.reminders[reminderType].hasNewMedia = false;
        
        // Mark that image should be removed in the backend
        $scope.reminders[reminderType].removeMedia = true;
        
        // Show user feedback during removal
        $scope.reminders[reminderType].removingMedia = true;
        
        // Auto-save the changes to persist the removal
        $scope.saveReminders();
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

    // Helper functions for media type detection
    $scope.isImage = function(url) {
        if (!url) return false;
        return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
    };

    $scope.isVideo = function(url) {
        if (!url) return false;
        return /\.(mp4|webm|ogg|avi|mov)$/i.test(url);
    };

    // Helper function to get full image URL
    $scope.getImageUrl = function(imagePath) {
        if (!imagePath) return null;
        
        // If it's already a complete URL (starts with http:// or https://), return as is
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }
        
        // Otherwise, it's a relative path, prepend API base
        var API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3000'
            : 'https://whatspro.robomate.in';
        return API_BASE + imagePath;
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