angular.module('autopostWaApp').controller('SequenceCreateController', ['$scope', '$http', '$location', '$routeParams', 'NotificationService', function($scope, $http, $location, $routeParams, NotificationService) {
    $scope.sequence = {
        name: '',
        description: '',
        status: 'inactive',
        messages: [],
        exactKeywords: '',
        containsKeywords: ''
    };
    
    $scope.isEditMode = false;
    $scope.saving = false;
    $scope.errors = {};
    $scope.sequenceId = $routeParams.id;

    // Initialize notification service
    NotificationService.initToast($scope);
    NotificationService.initConfirmModal($scope);

    // Initialize
    $scope.init = function() {
        if ($scope.sequenceId) {
            $scope.isEditMode = true;
            $scope.loadSequence();
        }
    };

    // Load existing sequence for editing
    $scope.loadSequence = function() {
        $http.get('/api/sequences/' + $scope.sequenceId)
            .then(function(response) {
                $scope.sequence = response.data;
                // Ensure messages array exists
                if (!$scope.sequence.messages) {
                    $scope.sequence.messages = [];
                }
                

                
                // Sort messages by day
                $scope.sequence.messages.sort(function(a, b) {
                    return a.day - b.day;
                });

                // Handle backward compatibility for old keyword format
                if (Array.isArray($scope.sequence.keywords)) {
                    // If old format exists, migrate to new format based on match type
                    if ($scope.sequence.keywordMatchType === 'exact') {
                        $scope.sequence.exactKeywords = $scope.sequence.keywords.join(', ');
                        $scope.sequence.containsKeywords = '';
                    } else {
                        $scope.sequence.containsKeywords = $scope.sequence.keywords.join(', ');
                        $scope.sequence.exactKeywords = '';
                    }
                    delete $scope.sequence.keywords; // Remove old field
                }
                
                // Convert keyword arrays to comma-separated strings for editing
                if (Array.isArray($scope.sequence.exactKeywords)) {
                    $scope.sequence.exactKeywords = $scope.sequence.exactKeywords.join(', ');
                }
                if (Array.isArray($scope.sequence.containsKeywords)) {
                    $scope.sequence.containsKeywords = $scope.sequence.containsKeywords.join(', ');
                }
                
                // Ensure new fields have defaults
                if (!$scope.sequence.exactKeywords) {
                    $scope.sequence.exactKeywords = '';
                }
                if (!$scope.sequence.containsKeywords) {
                    $scope.sequence.containsKeywords = '';
                }
            })
            .catch(function(error) {
                console.error('Error loading sequence:', error);
                NotificationService.showToast($scope, 'Error loading sequence. Redirecting to sequences list.', 'error');
                $location.path('/sequences');
            });
    };

    // Validate sequence
    $scope.validateSequence = function() {
        $scope.errors = {};
        let isValid = true;

        // Check sequence name
        if (!$scope.sequence.name || $scope.sequence.name.trim() === '') {
            $scope.errors.name = 'Sequence name is required';
            isValid = false;
        }

        // Check messages
        if ($scope.sequence.messages.length === 0) {
            $scope.errors.messages = 'At least one message is required';
            isValid = false;
        }

        // Validate each message
        $scope.sequence.messages.forEach(function(message, index) {
            if (!message.day || message.day < 1) {
                $scope.errors['message_' + index + '_day'] = 'Day must be 1 or greater';
                isValid = false;
            }

            if (!message.message || message.message.trim() === '') {
                $scope.errors['message_' + index + '_message'] = 'Message is required';
                isValid = false;
            }

            if (message.type === 'media') {
                // Check if media is selected
                if (!message.mediaFile && !message.mediaUrl && !message.selectedMedia) {
                    $scope.errors['message_' + index + '_media'] = 'Media file, URL, or library selection is required';
                    isValid = false;
                }
            }
        });

        // Check keywords - at least one keyword field must have content
        const hasExactKeywords = $scope.sequence.exactKeywords && $scope.sequence.exactKeywords.trim() !== '';
        const hasContainsKeywords = $scope.sequence.containsKeywords && $scope.sequence.containsKeywords.trim() !== '';
        
        if (!hasExactKeywords && !hasContainsKeywords) {
            $scope.errors.keywords = 'At least one keyword field (Exact Match or Contains) is required';
            isValid = false;
        }

        return isValid;
    };

    // Clear keyword validation error when user starts typing
    $scope.clearKeywordError = function() {
        if ($scope.errors.keywords) {
            delete $scope.errors.keywords;
        }
    };

    // Check if sequence is valid for activation
    $scope.isValidSequence = function() {
        const hasExactKeywords = $scope.sequence.exactKeywords && $scope.sequence.exactKeywords.trim() !== '';
        const hasContainsKeywords = $scope.sequence.containsKeywords && $scope.sequence.containsKeywords.trim() !== '';
        
        return $scope.sequence.name && 
               $scope.sequence.name.trim() !== '' && 
               $scope.sequence.messages.length > 0 &&
               (hasExactKeywords || hasContainsKeywords) &&
               $scope.sequence.messages.every(function(message) {
                   if (message.type === 'text') {
                       return message.day && message.day >= 1 && message.message && message.message.trim() !== '';
                   } else if (message.type === 'media') {
                       return message.day && message.day >= 1 && 
                              (message.mediaFile || message.mediaUrl || message.selectedMedia);
                   }
                   return false;
               });
    };

    // Handle day change for minute delay options
    $scope.onDayChange = function(message) {
        // If day is changed to 1, initialize minuteDelay if not set
        if (message.day === 1 && !message.minuteDelay) {
            message.minuteDelay = 60; // Default to 1 hour
        }
        // If day is changed from 1, remove minuteDelay
        if (message.day !== 1) {
            delete message.minuteDelay;
        }
    };

    // Add new message
    $scope.addMessage = function() {
        const nextDay = $scope.getNextDay();
        const newMessage = {
            day: nextDay,
            type: 'text',
            message: ''
        };
        
        // If it's day 1, add minute delay option
        if (nextDay === 1) {
            newMessage.minuteDelay = 60; // Default to 1 hour
        }
        
        $scope.sequence.messages.push(newMessage);
    };

    // Get next suggested day
    $scope.getNextDay = function() {
        if ($scope.sequence.messages.length === 0) {
            return 1;
        }
        const maxDay = Math.max.apply(Math, $scope.sequence.messages.map(function(m) { return m.day; }));
        return maxDay + 1;
    };

    // Remove message
    $scope.removeMessage = function(index) {
        NotificationService.showConfirmation($scope,
            'Confirm Remove',
            'Are you sure you want to remove this message?',
            function() {
                $scope.sequence.messages.splice(index, 1);
            }
        );
    };

    // Move message up
    $scope.moveMessageUp = function(index) {
        if (index > 0) {
            const temp = $scope.sequence.messages[index];
            $scope.sequence.messages[index] = $scope.sequence.messages[index - 1];
            $scope.sequence.messages[index - 1] = temp;
        }
    };

    // Move message down
    $scope.moveMessageDown = function(index) {
        if (index < $scope.sequence.messages.length - 1) {
            const temp = $scope.sequence.messages[index];
            $scope.sequence.messages[index] = $scope.sequence.messages[index + 1];
            $scope.sequence.messages[index + 1] = temp;
        }
    };

    // Get message preview with personalization example
    $scope.getMessagePreview = function(message) {
        if (!message) return '';
        return message.replace(/\{name\}/g, 'John');
    };

    // Get minute delay text for display
    $scope.getMinuteDelayText = function(minuteDelay) {
        if (minuteDelay < 60) {
            return minuteDelay + ' minutes';
        } else if (minuteDelay === 60) {
            return '1 hour';
        } else {
            const hours = Math.floor(minuteDelay / 60);
            const minutes = minuteDelay % 60;
            if (minutes === 0) {
                return hours + ' hours';
            } else {
                return hours + 'h ' + minutes + 'm';
            }
        }
    };

    // Save as draft
    $scope.saveAsDraft = function() {
        $scope.sequence.status = 'inactive';
        $scope.saveSequence();
    };

    // Save and activate
    $scope.saveAndActivate = function() {
        if (!$scope.validateSequence()) {
            NotificationService.showToast($scope, 'Please fix the errors before saving.', 'error');
            return;
        }
        $scope.sequence.status = 'active';
        $scope.saveSequence();
    };

    // Save sequence
    $scope.saveSequence = function() {
        if ($scope.saving) return;
        
        $scope.saving = true;

        // Sort messages by day before saving
        $scope.sequence.messages.sort(function(a, b) {
            return a.day - b.day;
        });

        // Prepare sequence data
        const sequenceData = angular.copy($scope.sequence);
        
        // Convert keyword strings back to arrays for backend storage
        if (sequenceData.exactKeywords && typeof sequenceData.exactKeywords === 'string') {
            sequenceData.exactKeywords = sequenceData.exactKeywords.split(',').map(function(keyword) {
                return keyword.trim();
            }).filter(function(keyword) {
                return keyword.length > 0;
            });
        }
        
        if (sequenceData.containsKeywords && typeof sequenceData.containsKeywords === 'string') {
            sequenceData.containsKeywords = sequenceData.containsKeywords.split(',').map(function(keyword) {
                return keyword.trim();
            }).filter(function(keyword) {
                return keyword.length > 0;
            });
        }
        
        // Handle media uploads if any
        $scope.uploadMediaFiles(sequenceData).then(function(updatedSequence) {
            const request = $scope.isEditMode ? 
                $http.put('/api/sequences/' + $scope.sequenceId, updatedSequence) :
                $http.post('/api/sequences', updatedSequence);

            request
                .then(function(response) {
                    NotificationService.showToast($scope, $scope.isEditMode ? 'Sequence updated successfully!' : 'Sequence created successfully!', 'success');
                    $location.path('/sequences');
                })
                .catch(function(error) {
                    console.error('Error saving sequence:', error);
                    NotificationService.showToast($scope, 'Error saving sequence. Please try again.', 'error');
                })
                .finally(function() {
                    $scope.saving = false;
                });
        });
    };

    // Handle media file uploads
    $scope.uploadMediaFiles = function(sequenceData) {
        const promises = [];
        
        sequenceData.messages.forEach(function(message, index) {
            if (message.type === 'media') {
                if (message.mediaFile) {
                    // Upload new file
                    const formData = new FormData();
                    formData.append('media', message.mediaFile);
                    
                    const uploadPromise = $http.post('/api/media/upload', formData, {
                        transformRequest: angular.identity,
                        headers: {'Content-Type': undefined}
                    }).then(function(response) {
                        message.mediaUrl = response.data.url;
                        message.mediaType = response.data.type;
                        delete message.mediaFile; // Remove file object
                        delete message.selectedMedia; // Remove selected media object
                    });
                    
                    promises.push(uploadPromise);
                } else if (message.selectedMedia) {
                    // Use selected media from library
                    message.mediaUrl = message.selectedMedia.url;
                    message.mediaType = message.selectedMedia.type;
                    delete message.selectedMedia; // Remove selected media object
                    delete message.mediaFile; // Remove file object
                }
                // For direct URLs, mediaUrl is already set, no upload needed
            }
        });

        return Promise.all(promises).then(function() {
            return sequenceData;
        });
    };

    // Go back to sequences list
    $scope.goBack = function() {
        NotificationService.showConfirmation($scope,
            'Confirm Leave',
            'Are you sure you want to leave? Any unsaved changes will be lost.',
            function() {
                $location.path('/sequences');
            }
        );
    };

    // Media library functionality
    $scope.showMediaLibrary = false;
    $scope.mediaLibrary = [];
    $scope.currentMessage = null;
    $scope.loadingMedia = false;

    // Open media library
    $scope.openMediaLibrary = function(message) {
        $scope.currentMessage = message;
        $scope.loadMediaLibrary();
        $scope.showMediaLibrary = true;
    };

    // Load media from library
    $scope.loadMediaLibrary = function() {
        $scope.loadingMedia = true;
        $http.get('/media/list')
            .then(function(response) {
                $scope.mediaLibrary = response.data;
            })
            .catch(function(error) {
                console.error('Error loading media library:', error);
                NotificationService.showToast($scope, 'Error loading media library. Please try again.', 'error');
            })
            .finally(function() {
                $scope.loadingMedia = false;
            });
    };

    // Select media from library
    $scope.selectMediaFromLibrary = function(media) {
        if ($scope.currentMessage) {
            $scope.currentMessage.selectedMedia = media;
            $scope.currentMessage.mediaUrl = media.url;
            $scope.currentMessage.mediaType = media.type;
            // Clear other media selections
            $scope.currentMessage.mediaFile = null;
            $scope.closeMediaLibrary();
        }
    };

    // Close media library modal
    $scope.closeMediaLibrary = function() {
        $scope.showMediaLibrary = false;
        $scope.currentMessage = null;
    };

    // Check if file is an image (simplified)
    $scope.isImageFile = function(media) {
        if (!media) return false;
        
        // Check by type first
        if (media.type && media.type.includes('image')) {
            return true;
        }
        
        // Fallback to check by file extension
        const fileName = (media.name || media.filename || '').toLowerCase();
        return fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || 
               fileName.endsWith('.png') || fileName.endsWith('.gif') || 
               fileName.endsWith('.bmp') || fileName.endsWith('.webp');
    };

    // Check if file is a video
    $scope.isVideoFile = function(media) {
        if (media.type && media.type.startsWith('video/')) {
            return true;
        }
        // Fallback to check by file extension
        const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
        const fileName = media.name || media.filename || '';
        return videoExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    };

    // Get media URL (simplified - just return the URL as is)
    $scope.getMediaUrl = function(media) {
        if (!media || !media.url) return '';
        return media.url;
    };

    // Get file type display name
    $scope.getFileTypeDisplay = function(media) {
        if (media.type) {
            return media.type;
        }
        
        // Try to determine type from filename
        const fileName = media.name || media.filename || '';
        const ext = fileName.toLowerCase().split('.').pop();
        
        const typeMap = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'webp': 'image/webp',
            'mp4': 'video/mp4',
            'avi': 'video/avi',
            'mov': 'video/quicktime',
            'wmv': 'video/wmv',
            'flv': 'video/flv',
            'webm': 'video/webm',
            'mkv': 'video/mkv',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
        
        return typeMap[ext] || 'application/octet-stream';
    };

    // Clear media selection
    $scope.clearMedia = function(message) {
        message.mediaFile = null;
        message.mediaUrl = null;
        message.selectedMedia = null;
        message.mediaType = null;
    };

    // Format file size
    $scope.formatFileSize = function(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Get media preview URL
    $scope.getMediaPreviewUrl = function(media) {
        if (media.type && media.type.startsWith('image/')) {
            return media.url;
        }
        return null;
    };

    // Media preview helper functions
    $scope.hasMediaSelected = function(message) {
        return message.mediaFile || message.mediaUrl || message.selectedMedia;
    };

    $scope.isSelectedMediaImage = function(message) {
        // Check selected media from library
        if (message.selectedMedia) {
            return $scope.isImageFile(message.selectedMedia);
        }
        
        // Check uploaded file
        if (message.mediaFile) {
            return message.mediaFile.type && message.mediaFile.type.includes('image');
        }
        
        // Check URL (try to determine from extension)
        if (message.mediaUrl) {
            const url = message.mediaUrl.toLowerCase();
            return url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || 
                   url.includes('.gif') || url.includes('.bmp') || url.includes('.webp');
        }
        
        return false;
    };

    $scope.isSelectedMediaVideo = function(message) {
        // Check selected media from library
        if (message.selectedMedia) {
            return $scope.isVideoFile(message.selectedMedia);
        }
        
        // Check uploaded file
        if (message.mediaFile) {
            return message.mediaFile.type && message.mediaFile.type.includes('video');
        }
        
        // Check URL (try to determine from extension)
        if (message.mediaUrl) {
            const url = message.mediaUrl.toLowerCase();
            return url.includes('.mp4') || url.includes('.avi') || url.includes('.mov') || 
                   url.includes('.wmv') || url.includes('.flv') || url.includes('.webm');
        }
        
        return false;
    };

    $scope.getSelectedMediaUrl = function(message) {
        if (message.selectedMedia) {
            return message.selectedMedia.url;
        }
        
        if (message.mediaUrl) {
            return message.mediaUrl;
        }
        
        // For uploaded files, we'll need to create a preview URL
        if (message.mediaFile) {
            return URL.createObjectURL(message.mediaFile);
        }
        
        return '';
    };

    $scope.getSelectedMediaName = function(message) {
        if (message.selectedMedia) {
            return message.selectedMedia.name;
        }
        
        if (message.mediaFile) {
            return message.mediaFile.name;
        }
        
        if (message.mediaUrl) {
            // Extract filename from URL
            const url = message.mediaUrl;
            const parts = url.split('/');
            return parts[parts.length - 1] || 'External Media';
        }
        
        return 'Media File';
    };

    $scope.getSelectedMediaType = function(message) {
        if (message.selectedMedia) {
            return message.selectedMedia.type || 'Unknown';
        }
        
        if (message.mediaFile) {
            return message.mediaFile.type || 'Unknown';
        }
        
        if (message.mediaUrl) {
            return 'External URL';
        }
        
        return 'Unknown';
    };



    // Initialize controller
    $scope.init();
}]);
