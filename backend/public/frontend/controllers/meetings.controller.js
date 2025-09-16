angular.module('autopostWaApp.meetings').controller('MeetingsController', ['$scope', 'ApiService', function($scope, ApiService) {
    $scope.meetings = [];
    $scope.loading = false;
    $scope.hasValidToken = false;
    $scope.message = { text: '', icon: '', type: '' };
    $scope.meetingsTitle = 'Scheduled Meetings';
    
    // Search and filter properties
    $scope.searchText = '';
    $scope.filter = 'upcoming'; // all, upcoming, past - Set to 'upcoming' by default as requested
    $scope.filteredMeetings = [];
    
    // Template visibility control - Hide templates by default as requested
    $scope.showTemplates = false;
    
    // Toast notification control
    $scope.showSaveSuccessToast = false;

    // Filter meetings based on search text and filter type
    $scope.filterMeetings = function() {
        let filtered = $scope.meetings;
        
        // Apply time-based filter first
        const now = new Date();
        if ($scope.filter === 'upcoming') {
            filtered = filtered.filter(function(meeting) {
                return new Date(meeting.start_time) > now;
            });
        } else if ($scope.filter === 'past') {
            filtered = filtered.filter(function(meeting) {
                return new Date(meeting.start_time) <= now;
            });
        }
        
        // Apply search text filter
        if ($scope.searchText && $scope.searchText.length > 0) {
            const searchTerm = $scope.searchText.toLowerCase();
            filtered = filtered.filter(function(meeting) {
                // Search in meeting name
                if (meeting.name && meeting.name.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                // Search in event type
                if (meeting.event_type && meeting.event_type.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                // Search in invitee name
                if (meeting.invitee && meeting.invitee.name && 
                    meeting.invitee.name.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                // Search in invitee email
                if (meeting.invitee && meeting.invitee.email && 
                    meeting.invitee.email.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                // Search in meeting status
                if (meeting.status && meeting.status.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                // Search in location
                if (meeting.location && meeting.location.location && 
                    meeting.location.location.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                return false;
            });
        }
        
        $scope.filteredMeetings = filtered;
    };

    // Set filter and update results
    $scope.setFilter = function(filterType) {
        $scope.filter = filterType;
        $scope.filterMeetings();
    };

    // Watch for changes in search text
    $scope.$watch('searchText', function() {
        $scope.filterMeetings();
    });

    // Watch for changes in meetings array
    $scope.$watch('meetings', function() {
        $scope.filterMeetings();
    }, true);

    // Check if user has valid Calendly token
    function checkCalendlyToken() {
        ApiService.calendlyGetSettings().then(function(response) {
            $scope.hasValidToken = !!(response.data && response.data.calendly_token);
            if ($scope.hasValidToken) {
                $scope.loadMeetings();
            }
        }).catch(function(error) {
            console.error('Error checking Calendly token:', error);
            $scope.hasValidToken = false;
        });
    }

    // Load meetings from backend
    $scope.loadMeetings = function() {
        $scope.loading = true;
        $scope.showMessage('Loading meetings...', 'fas fa-spinner fa-spin', 'info');
        
        ApiService.calendlyGetMeetings().then(function(response) {
            $scope.meetings = response.data || [];
            $scope.loading = false;
            
            if ($scope.meetings.length === 0) {
                $scope.showMessage('No meetings found', 'fas fa-calendar-times', 'info');
            } else {
                $scope.showMessage('Meetings loaded successfully!', 'fas fa-check-circle', 'success');
                setTimeout(function() {
                    $scope.clearMessage();
                }, 3000);
            }
            
        }).catch(function(error) {
            $scope.loading = false;
            console.error('Error loading meetings:', error);
            $scope.showMessage('Error loading meetings: ' + (error.data?.error || 'Unknown error'), 'fas fa-exclamation-triangle', 'error');
        });
    };

    // Sync meetings with Calendly
    $scope.syncMeetings = function() {
        $scope.loading = true;
        $scope.showMessage('Syncing with Calendly...', 'fas fa-spinner fa-spin', 'info');
        
        ApiService.calendlySyncMeetings().then(function(response) {
            $scope.loading = false;
            $scope.showMessage('Sync completed successfully!', 'fas fa-check-circle', 'success');
            setTimeout(function() {
                $scope.clearMessage();
            }, 3000);
            
            // Reload meetings after sync
            $scope.loadMeetings();
            
        }).catch(function(error) {
            $scope.loading = false;
            console.error('Error syncing meetings:', error);
            $scope.showMessage('Error syncing meetings: ' + (error.data?.error || 'Unknown error'), 'fas fa-exclamation-triangle', 'error');
        });
    };

    // Show message helper
    $scope.showMessage = function(text, icon, type) {
        $scope.message = {
            text: text,
            icon: icon,
            type: type
        };
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    };

    // Clear message helper
    $scope.clearMessage = function() {
        $scope.message = { text: '', icon: '', type: '' };
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    };

    // Helper functions for UI
    $scope.getMeetingStatus = function(meeting) {
        const now = new Date();
        const meetingStart = new Date(meeting.start_time);
        const meetingEnd = new Date(meeting.end_time);
        
        if (now < meetingStart) {
            return 'Upcoming';
        } else if (now >= meetingStart && now <= meetingEnd) {
            return 'Live';
        } else {
            return 'Completed';
        }
    };

    $scope.getMeetingStatusClass = function(meeting) {
        const status = $scope.getMeetingStatus(meeting).toLowerCase();
        return 'status-' + status;
    };

    $scope.formatDateTime = function(dateTime) {
        if (!dateTime) return '';
        const date = new Date(dateTime);
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
    };

    $scope.calculateDuration = function(startTime, endTime) {
        if (!startTime || !endTime) return '';
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMinutes = Math.round((end - start) / (1000 * 60));
        
        if (diffMinutes < 60) {
            return diffMinutes + ' minutes';
        } else {
            const hours = Math.floor(diffMinutes / 60);
            const minutes = diffMinutes % 60;
            return hours + 'h ' + (minutes > 0 ? minutes + 'm' : '');
        }
    };

    // Get search results count
    $scope.getResultsCount = function() {
        return $scope.filteredMeetings ? $scope.filteredMeetings.length : 0;
    };

    // Clear search
    $scope.clearSearch = function() {
        $scope.searchText = '';
    };

    // Template management - Default values matching backend
    $scope.templateSettings = {
        booking_confirmation: {
            enabled: true,
            message: '🎉 Congratulations {{invitee_name}}! Your meeting \'{{meeting_name}}\' has been booked for {{meeting_date}} at {{meeting_time}}. We look forward to connecting with you!'
        },
        five_days_reminder: {
            enabled: true,
            message: '📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting \'{{meeting_name}}\' scheduled in 5 days on {{meeting_date}} at {{meeting_time}}.'
        },
        four_days_reminder: {
            enabled: true,
            message: '📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting \'{{meeting_name}}\' scheduled in 4 days on {{meeting_date}} at {{meeting_time}}.'
        },
        three_days_reminder: {
            enabled: true,
            message: '📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting \'{{meeting_name}}\' scheduled in 3 days on {{meeting_date}} at {{meeting_time}}.'
        },
        two_days_reminder: {
            enabled: true,
            message: '📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting \'{{meeting_name}}\' scheduled in 2 days on {{meeting_date}} at {{meeting_time}}.'
        },
        one_day_reminder: {
            enabled: true,
            message: '📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting \'{{meeting_name}}\' scheduled tomorrow on {{meeting_date}} at {{meeting_time}}.'
        },
        twelve_hours_reminder: {
            enabled: true,
            message: '⏰ Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is in 12 hours! It\'s scheduled for {{meeting_date}} at {{meeting_time}}.'
        },
        six_hours_reminder: {
            enabled: true,
            message: '⏰ Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is in 6 hours! It\'s scheduled for {{meeting_date}} at {{meeting_time}}.'
        },
        three_hours_reminder: {
            enabled: true,
            message: '⏰ Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is in 3 hours! It\'s scheduled for {{meeting_date}} at {{meeting_time}}.'
        },
        one_hour_reminder: {
            enabled: true,
            message: '⏰ Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is in 1 hour! It\'s scheduled for {{meeting_date}} at {{meeting_time}}.'
        },
        five_minutes_reminder: {
            enabled: true,
            message: '🚨 Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is starting in 5 minutes! {{join_url}}'
        },
        meeting_live: {
            enabled: true,
            message: '🎥 Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is now live! Please join: {{join_url}}'
        },
        post_meeting_thanks: {
            enabled: true,
            message: '🙏 Thank you {{invitee_name}} for attending the meeting \'{{meeting_name}}\'! We hope it was valuable. Feel free to reach out if you have any questions.'
        }
    };

    // Load template settings from backend
    $scope.loadTemplateSettings = function() {
        ApiService.getTemplateSettings('calendly').then(function(response) {
            if (response.data && response.data.templates && Object.keys(response.data.templates).length > 0) {
                $scope.templateSettings = angular.merge($scope.templateSettings, response.data.templates);
                console.log('Loaded template settings from backend:', $scope.templateSettings);
            }
        }).catch(function(error) {
            console.log('Using default template settings - backend not available');
        });
    };

    // Save all templates
    $scope.saveAllTemplates = function() {
        $scope.showMessage('Saving templates...', 'fas fa-spinner fa-spin', 'info');
        
        ApiService.saveTemplateSettings('calendly', $scope.templateSettings).then(function(response) {
            $scope.clearMessage();
            $scope.showSaveSuccessToast = true;
            
            // Auto-hide toast after 4 seconds
            setTimeout(function() {
                $scope.closeSaveSuccessToast();
            }, 4000);
        }).catch(function(error) {
            console.error('Error saving templates:', error);
            $scope.showMessage('Error saving templates: ' + (error.data?.error || 'Unknown error'), 'fas fa-exclamation-triangle', 'error');
        });
    };
    
    // Close save success toast
    $scope.closeSaveSuccessToast = function() {
        $scope.showSaveSuccessToast = false;
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    };

    // Reset all templates to defaults
    $scope.resetAllTemplates = function() {
        if (confirm('Are you sure you want to reset all templates to default values?')) {
            $scope.templateSettings = {
                booking_confirmation: {
                    enabled: true,
                    message: '🎉 Congratulations {{invitee_name}}! Your meeting \'{{meeting_name}}\' has been booked for {{meeting_date}} at {{meeting_time}}. We look forward to connecting with you!'
                },
                five_days_reminder: {
                    enabled: true,
                    message: '📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting \'{{meeting_name}}\' scheduled in 5 days on {{meeting_date}} at {{meeting_time}}.'
                },
                four_days_reminder: {
                    enabled: true,
                    message: '📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting \'{{meeting_name}}\' scheduled in 4 days on {{meeting_date}} at {{meeting_time}}.'
                },
                three_days_reminder: {
                    enabled: true,
                    message: '📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting \'{{meeting_name}}\' scheduled in 3 days on {{meeting_date}} at {{meeting_time}}.'
                },
                two_days_reminder: {
                    enabled: true,
                    message: '📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting \'{{meeting_name}}\' scheduled in 2 days on {{meeting_date}} at {{meeting_time}}.'
                },
                one_day_reminder: {
                    enabled: true,
                    message: '📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting \'{{meeting_name}}\' scheduled tomorrow on {{meeting_date}} at {{meeting_time}}.'
                },
                twelve_hours_reminder: {
                    enabled: true,
                    message: '⏰ Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is in 12 hours! It\'s scheduled for {{meeting_date}} at {{meeting_time}}.'
                },
                six_hours_reminder: {
                    enabled: true,
                    message: '⏰ Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is in 6 hours! It\'s scheduled for {{meeting_date}} at {{meeting_time}}.'
                },
                three_hours_reminder: {
                    enabled: true,
                    message: '⏰ Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is in 3 hours! It\'s scheduled for {{meeting_date}} at {{meeting_time}}.'
                },
                one_hour_reminder: {
                    enabled: true,
                    message: '⏰ Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is in 1 hour! It\'s scheduled for {{meeting_date}} at {{meeting_time}}.'
                },
                five_minutes_reminder: {
                    enabled: true,
                    message: '🚨 Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is starting in 5 minutes! {{join_url}}'
                },
                meeting_live: {
                    enabled: true,
                    message: '🎥 Hi {{invitee_name}}, your meeting \'{{meeting_name}}\' is now live! Please join: {{join_url}}'
                },
                post_meeting_thanks: {
                    enabled: true,
                    message: '🙏 Thank you {{invitee_name}} for attending the meeting \'{{meeting_name}}\'! We hope it was valuable. Feel free to reach out if you have any questions.'
                }
            };
            $scope.showMessage('Templates reset to defaults', 'fas fa-undo', 'info');
        }
    };

    // Media functionality - Initialize media selector
    $scope.showMediaSelector = false;
    $scope.currentTemplateType = null;
    $scope.mediaLibrary = [];
    
    // Load media library
    $scope.loadMediaLibrary = function() {
        ApiService.getMedia().then(function(response) {
            $scope.mediaLibrary = response.data || [];
        }).catch(function(error) {
            console.error('Error loading media library:', error);
        });
    };
    
    // Open media selector for a specific template type
    $scope.openMediaSelector = function(templateType) {
        console.log('openMediaSelector called with template type:', templateType);
        $scope.currentTemplateType = templateType;
        $scope.showMediaSelector = true;
        $scope.loadMediaLibrary();
    };
    
    // Close media selector
    $scope.closeMediaSelector = function() {
        $scope.showMediaSelector = false;
        $scope.currentTemplateType = null;
    };
    
    // Select media from library for a template
    $scope.selectMediaForTemplate = function(media, templateType) {
        console.log('selectMediaForTemplate called with:', media, templateType);
        
        if (!templateType) {
            templateType = $scope.currentTemplateType;
        }
        
        if (!templateType) {
            console.error('No template type selected');
            return;
        }
        
        if (!$scope.templateSettings[templateType]) {
            console.error('Template type not found:', templateType);
            return;
        }
        
        $scope.templateSettings[templateType].mediaFromLibrary = media;
        $scope.closeMediaSelector();
        
        console.log('Media attached to template:', templateType, media);
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

    // Initialize
    checkCalendlyToken();
    $scope.loadTemplateSettings();
}]);
