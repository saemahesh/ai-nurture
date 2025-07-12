angular.module('autopostWaApp').controller('SequenceCreateController', ['$scope', '$http', '$location', '$routeParams', function($scope, $http, $location, $routeParams) {
    $scope.sequence = {
        name: '',
        description: '',
        status: 'inactive',
        messages: [],
        keywords: ''
    };
    
    $scope.isEditMode = false;
    $scope.saving = false;
    $scope.errors = {};
    $scope.sequenceId = $routeParams.id;

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
                
                // Fix time format for HTML5 time inputs
                $scope.sequence.messages.forEach(function(message) {
                    if (message.time) {
                        // Ensure time is in HH:MM format
                        if (message.time.length === 5 && message.time.includes(':')) {
                            // Already in correct format
                        } else if (message.time.length === 4) {
                            // Convert HHMM to HH:MM
                            message.time = message.time.substring(0, 2) + ':' + message.time.substring(2);
                        } else {
                            // Default to 09:00 if format is unexpected
                            message.time = '09:00';
                        }
                    } else {
                        // Set default time if missing
                        message.time = '09:00';
                    }
                });
                
                // Sort messages by day
                $scope.sequence.messages.sort(function(a, b) {
                    return a.day - b.day;
                });

                // Convert keywords array to comma-separated string for editing
                if (Array.isArray($scope.sequence.keywords)) {
                    $scope.sequence.keywords = $scope.sequence.keywords.join(', ');
                }
            })
            .catch(function(error) {
                console.error('Error loading sequence:', error);
                alert('Error loading sequence. Redirecting to sequences list.');
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

        return isValid;
    };

    // Check if sequence is valid for activation
    $scope.isValidSequence = function() {
        return $scope.sequence.name && 
               $scope.sequence.name.trim() !== '' && 
               $scope.sequence.messages.length > 0 &&
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

    // Add new message
    $scope.addMessage = function() {
        const newMessage = {
            day: $scope.getNextDay(),
            type: 'text',
            message: '',
            time: '09:00'  // Ensure proper HH:MM format
        };
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
        if (confirm('Are you sure you want to remove this message?')) {
            $scope.sequence.messages.splice(index, 1);
        }
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

    // Save as draft
    $scope.saveAsDraft = function() {
        $scope.sequence.status = 'inactive';
        $scope.saveSequence();
    };

    // Save and activate
    $scope.saveAndActivate = function() {
        if (!$scope.validateSequence()) {
            alert('Please fix the errors before saving.');
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
        
        // Handle media uploads if any
        $scope.uploadMediaFiles(sequenceData).then(function(updatedSequence) {
            const request = $scope.isEditMode ? 
                $http.put('/api/sequences/' + $scope.sequenceId, updatedSequence) :
                $http.post('/api/sequences', updatedSequence);

            request
                .then(function(response) {
                    alert($scope.isEditMode ? 'Sequence updated successfully!' : 'Sequence created successfully!');
                    $location.path('/sequences');
                })
                .catch(function(error) {
                    console.error('Error saving sequence:', error);
                    alert('Error saving sequence. Please try again.');
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
        if (confirm('Are you sure you want to leave? Any unsaved changes will be lost.')) {
            $location.path('/sequences');
        }
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
                alert('Error loading media library. Please try again.');
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

    // Utility function to format time properly
    $scope.formatTime = function(timeString) {
        if (!timeString) return '09:00';
        
        // If already in HH:MM format, return as is
        if (timeString.length === 5 && timeString.includes(':')) {
            return timeString;
        }
        
        // If in HHMM format, convert to HH:MM
        if (timeString.length === 4) {
            return timeString.substring(0, 2) + ':' + timeString.substring(2);
        }
        
        // Default fallback
        return '09:00';
    };

    // Watch for time changes to ensure proper format
    $scope.$watchCollection('sequence.messages', function(newMessages) {
        if (newMessages) {
            newMessages.forEach(function(message) {
                if (message.time) {
                    message.time = $scope.formatTime(message.time);
                }
            });
        }
    });

    // Initialize controller
    $scope.init();
}]);
