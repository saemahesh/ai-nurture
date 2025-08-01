angular.module('autopostWaApp.schedules')
    .controller('DirectScheduleController', ['$scope', '$http', 'NotificationService', function($scope, $http, NotificationService) {
        $scope.schedules = [];
        $scope.mediaLibrary = [];
        $scope.showMediaSelector = false;
        $scope.loadingMedia = false;
        $scope.createEditModalVisible = false;
        $scope.isEditMode = false;
        $scope.formData = {};
        $scope.formError = '';
        $scope.searchQuery = '';
        $scope.isSearching = false;
        $scope.searchTimeout = null;

        // Enhanced search function with debouncing
        $scope.searchSchedules = function(schedule) {
            if (!$scope.searchQuery) return true;
            
            var query = $scope.searchQuery.toLowerCase();
            var number = (schedule.number || '').toLowerCase();
            var message = (schedule.message || '').toLowerCase();
            
            return number.includes(query) || message.includes(query);
        };

        // Keyboard navigation support
        $scope.handleKeyboardNavigation = function(event) {
            // Ctrl/Cmd + K to focus search
            if ((event.ctrlKey || event.metaKey) && event.keyCode === 75) {
                event.preventDefault();
                document.querySelector('input[ng-model="searchQuery"]').focus();
            }
            
            // Escape to clear search when search input is focused
            if (event.keyCode === 27 && document.activeElement.getAttribute('ng-model') === 'searchQuery') {
                $scope.clearSearch();
                $scope.$apply();
            }
        };

        // Bind keyboard events
        document.addEventListener('keydown', $scope.handleKeyboardNavigation);
        
        // Cleanup on scope destroy
        $scope.$on('$destroy', function() {
            document.removeEventListener('keydown', $scope.handleKeyboardNavigation);
            if ($scope.searchTimeout) {
                clearTimeout($scope.searchTimeout);
            }
        });

        // Debounced search to improve performance
        $scope.handleSearchInput = function() {
            $scope.isSearching = true;
            
            if ($scope.searchTimeout) {
                clearTimeout($scope.searchTimeout);
            }
            
            $scope.searchTimeout = setTimeout(function() {
                $scope.$apply(function() {
                    $scope.isSearching = false;
                    $scope.filteredSchedules = $scope.getFilteredSchedules();
                });
            }, 300);
        };

        // Get filtered schedules count for UI
        $scope.getFilteredSchedules = function() {
            if (!$scope.searchQuery) return $scope.schedules;
            return $scope.schedules.filter($scope.searchSchedules);
        };

        // Clear search functionality
        $scope.clearSearch = function() {
            $scope.searchQuery = '';
            $scope.isSearching = false;
            $scope.filteredSchedules = $scope.schedules;
        };

        // Watch for search changes to update filtered count
        $scope.$watch('searchQuery', function(newVal, oldVal) {
            if (newVal !== oldVal) {
                $scope.handleSearchInput();
            }
        });

        $scope.$watch('schedules', function() {
            $scope.filteredSchedules = $scope.getFilteredSchedules();
        });

        // Notification system
        NotificationService.initToast($scope);
        NotificationService.initConfirmModal($scope);

        // Set minimum datetime to current time
        $scope.minDateTime = new Date().toISOString().slice(0, 16);

        $scope.loadSchedules = function() {
            $http.get('/direct-schedule').then(function(response) {
                $scope.schedules = response.data;
                
                // Auto-scroll to bottom after schedules are loaded
                setTimeout(function() {
                    $scope.scrollToBottom();
                }, 100);
            }).catch(function(error) {
                NotificationService.showToast($scope, (error.data && error.data.message) || 'Failed to load schedules.', 'error');
            });
        };

        // Auto-scroll to bottom function
        $scope.scrollToBottom = function() {
            var mainContent = document.querySelector('main');
            if (mainContent) {
                mainContent.scrollTo({
                    top: mainContent.scrollHeight,
                    behavior: 'smooth'
                });
            }
        };

        // Auto-scroll when page loads
        $scope.$on('$viewContentLoaded', function() {
            setTimeout(function() {
                $scope.scrollToBottom();
            }, 200);
        });

        // Auto-scroll when route changes to direct-schedule
        $scope.$on('$routeChangeSuccess', function(event, current, previous) {
            if (current && current.controller === 'DirectScheduleController') {
                setTimeout(function() {
                    $scope.scrollToBottom();
                }, 500);
            }
        });

        $scope.showCreateEditModal = function(schedule) {
            $scope.createEditModalVisible = true;
            $scope.isEditMode = !!schedule;
            if (schedule) {
                // Edit mode: pre-fill form
                // Convert ISO date to datetime-local format
                var scheduledDate = new Date(schedule.scheduledAt);
                var localISOTime = new Date(scheduledDate.getTime() - scheduledDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                
                $scope.formData = {
                    id: schedule.id,
                    number: schedule.number,
                    message: schedule.message,
                    scheduledAt: localISOTime,
                    mediaMethod: schedule.mediaUrl ? 'url' : 'library',
                    mediaUrl: schedule.mediaUrl || '',
                    selectedMedia: null // Will be populated if media library is used
                };
                
                // If media URL exists, try to find matching media in library
                if (schedule.mediaUrl) {
                    $scope.loadMediaLibrary().then(function(mediaLibrary) {
                        var matchingMedia = mediaLibrary.find(function(media) {
                            return media.url === schedule.mediaUrl;
                        });
                        if (matchingMedia) {
                            $scope.formData.selectedMedia = matchingMedia;
                            $scope.formData.mediaMethod = 'library';
                            $scope.formData.mediaUrl = '';
                        }
                    }).catch(function(error) {
                        console.log('Could not load media library:', error);
                    });
                }
            } else {
                // Create mode: reset form
                $scope.formData = {
                    number: '',
                    message: '',
                    scheduledAt: '',
                    mediaMethod: 'library',
                    mediaUrl: '',
                    selectedMedia: null
                };
            }
            $scope.formError = '';
        };

        $scope.hideCreateEditModal = function() {
            $scope.createEditModalVisible = false;
            $scope.isEditMode = false;
            $scope.formData = {};
            $scope.formError = '';
        };

        // Media library
        $scope.loadMediaLibrary = function() {
            $scope.loadingMedia = true;
            return $http.get('/media/list').then(function(response) {
                $scope.mediaLibrary = response.data;
                $scope.loadingMedia = false;
                return response.data;
            }).catch(function() {
                $scope.loadingMedia = false;
                return [];
            });
        };
        $scope.openMediaSelector = function() {
            $scope.showMediaSelector = true;
            $scope.loadMediaLibrary();
        };
        $scope.closeMediaSelector = function() {
            $scope.showMediaSelector = false;
        };
        $scope.selectMediaForSchedule = function(media) {
            $scope.formData.selectedMedia = media;
            $scope.formData.mediaUrl = '';
            $scope.closeMediaSelector();
        };
        $scope.clearSelectedMedia = function() {
            $scope.formData.selectedMedia = null;
        };

        // Save (create or update)
        $scope.saveDirectSchedule = function() {
            $scope.formError = '';
            
            // Client-side validation
            if (!$scope.formData.number || !$scope.formData.message || !$scope.formData.scheduledAt) {
                $scope.formError = 'Please fill in all required fields.';
                return;
            }
            
            try {
                // Convert datetime-local to ISO string
                var scheduledAtISO = new Date($scope.formData.scheduledAt).toISOString();
                var mediaUrl = null;
                
                if ($scope.formData.mediaMethod === 'library' && $scope.formData.selectedMedia && $scope.formData.selectedMedia.url) {
                    mediaUrl = $scope.formData.selectedMedia.url;
                } else if ($scope.formData.mediaMethod === 'url' && $scope.formData.mediaUrl) {
                    mediaUrl = $scope.formData.mediaUrl;
                }
                
                var scheduleData = {
                    number: $scope.formData.number.trim(),
                    message: $scope.formData.message.trim(),
                    mediaUrl: mediaUrl,
                    scheduledAt: scheduledAtISO
                };
                
                if ($scope.isEditMode && $scope.formData.id) {
                    // Update
                    $http.put('/direct-schedule/' + $scope.formData.id, scheduleData).then(function(response) {
                        var idx = $scope.schedules.findIndex(function(s) { return s.id === $scope.formData.id; });
                        if (idx !== -1) $scope.schedules[idx] = response.data;
                        $scope.hideCreateEditModal();
                        NotificationService.showToast($scope, 'Schedule updated successfully!', 'success');
                    }).catch(function(error) {
                        console.error('Update error:', error);
                        $scope.formError = (error.data && error.data.message) || 'Failed to update schedule.';
                        NotificationService.showToast($scope, $scope.formError, 'error');
                    });
                } else {
                    // Create
                    $http.post('/direct-schedule', scheduleData).then(function(response) {
                        $scope.schedules.push(response.data);
                        $scope.hideCreateEditModal();
                        NotificationService.showToast($scope, 'Message scheduled successfully!', 'success');
                        
                        // Auto-scroll to bottom to show new schedule
                        setTimeout(function() {
                            $scope.scrollToBottom();
                        }, 300);
                    }).catch(function(error) {
                        console.error('Create error:', error);
                        $scope.formError = (error.data && error.data.message) || 'Failed to schedule message.';
                        NotificationService.showToast($scope, $scope.formError, 'error');
                    });
                }
            } catch (error) {
                console.error('Form processing error:', error);
                $scope.formError = 'Error preparing schedule data. Please check the form.';
                NotificationService.showToast($scope, $scope.formError, 'error');
            }
        };

        $scope.deleteSchedule = function(id) {
            NotificationService.showConfirmation($scope,
                'Confirm Delete',
                'Are you sure you want to delete this scheduled message?',
                function() {
                    $http.delete('/direct-schedule/' + id).then(function() {
                        $scope.schedules = $scope.schedules.filter(function(s) { return s.id !== id; });
                        NotificationService.showToast($scope, 'Schedule deleted successfully.', 'success');
                    }).catch(function(error) {
                        NotificationService.showToast($scope, (error.data && error.data.message) || 'Failed to delete schedule.', 'error');
                    });
                }
            );
        };

        // Edit button handler for list
        $scope.editSchedule = function(schedule) {
            $scope.showCreateEditModal(schedule);
        };

        // Load initial data and scroll to bottom
        $scope.loadSchedules();
        
        // Also trigger scroll after a slight delay to ensure content is rendered
        setTimeout(function() {
            $scope.scrollToBottom();
        }, 1000);
    }]);
