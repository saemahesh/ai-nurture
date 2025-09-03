angular.module('autopostWaApp.schedules')
    .controller('DirectScheduleController', ['$scope', '$http', '$timeout', '$location', 'NotificationService', function($scope, $http, $timeout, $location, NotificationService) {
        $scope.schedules = [];
        $scope.mediaLibrary = [];
        $scope.showMediaSelector = false;
        $scope.loadingMedia = false;
        $scope.createEditModalVisible = false;
        $scope.isEditMode = false;
        $scope.formData = {};

        // Check for URL parameters (for follow-up from customers)
        var urlParams = $location.search();
        if (urlParams.phone) {
            $scope.prefilledPhone = urlParams.phone;
            $scope.prefilledName = urlParams.name || '';
            // Broaden detection: any presence of param triggers follow-up mode
            $scope.fromFollow = (urlParams.fromFollow === true || urlParams.fromFollow === 'true' || typeof urlParams.fromFollow !== 'undefined');
            console.log('[DirectSchedule] Query params detected:', urlParams, 'fromFollow computed =>', $scope.fromFollow);
        }

        // Pause a schedule
        $scope.pauseSchedule = function(schedule) {
            $http.put('/direct-schedule/' + schedule.id + '/pause').then(function(response) {
                schedule.paused = true;
                NotificationService.showToast($scope, 'Schedule paused.', 'info');
            }).catch(function(error) {
                NotificationService.showToast($scope, (error.data && error.data.message) || 'Failed to pause schedule.', 'error');
            });
        };

        // Resume a schedule
        $scope.resumeSchedule = function(schedule) {
            if ($scope.isPastOnce(schedule)) {
                NotificationService.showToast($scope, 'Past time – edit to reschedule', 'warning');
                return;
            }
            $http.put('/direct-schedule/' + schedule.id + '/resume').then(function(response) {
                schedule.paused = false;
                NotificationService.showToast($scope, 'Schedule resumed.', 'success');
            }).catch(function(error) {
                NotificationService.showToast($scope, (error.data && error.data.message) || 'Failed to resume schedule.', 'error');
            });
        };
        $scope.formError = '';
        $scope.searchQuery = '';
        $scope.isSearching = false;
        $scope.searchTimeout = null;

        // Schedule type options (same as status module)
        $scope.scheduleTypes = [
            { value: 'once', label: 'Once Only' },
            { value: 'daily', label: 'Daily' },
            { value: 'custom', label: 'Specific Days' }
        ];
        $scope.days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        
        console.log('📝 [DIRECT-SCHEDULE] Schedule types initialized:', $scope.scheduleTypes);

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
                // Auto-open if phone param present (no longer require fromFollow flag)
                if($scope.prefilledPhone){
                  console.log('[DirectSchedule] Auto-opening modal (phone param detected)', $scope.prefilledPhone, 'fromFollow=', $scope.fromFollow);
                  $timeout(function(){
                    $scope.showCreateEditModal();
                    $timeout(function(){
                      var el = document.querySelector('textarea[name="message"]');
                      if(el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
                    },50);
                  },0);
                  // Clean only fromFollow flag if present
                  if($location.search().fromFollow){
                    $location.search('fromFollow', null);
                  }
                }
            }).catch(function(error) {
                NotificationService.showToast($scope, (error.data && error.data.message) || 'Failed to load schedules.', 'error');
            });
        };

        $scope.showCreateEditModal = function(schedule) {
            $scope.createEditModalVisible = true;
            $scope.isEditMode = !!schedule;
            if (schedule) {
                // Edit mode: pre-fill form
                // Helper function to safely convert date string to Date object for Angular ng-model
                function parseToDateObject(dateString) {
                  if (!dateString) return null;
                  try {
                    console.log('Processing date string for Date object:', dateString);
                    
                    // Handle URL-encoded dates (decode first)
                    var decodedDateString = decodeURIComponent(dateString);
                    console.log('Decoded date string:', decodedDateString);
                    
                    var date = new Date(decodedDateString);
                    if (isNaN(date.getTime())) {
                      // Try original string if decoding fails
                      console.log('Decoding failed, trying original string');
                      date = new Date(dateString);
                      if (isNaN(date.getTime())) {
                        console.error('Invalid date:', dateString);
                        return null;
                      }
                    }
                    
                    console.log('Direct Schedule - Original date string:', dateString, '-> Date object:', date);
                    return date;
                  } catch (e) {
                    console.error('Error parsing date to object:', dateString, e);
                    return null;
                  }
                }
                
                $scope.formData = {
                    id: schedule.id,
                    number: schedule.number,
                    message: schedule.message,
                    scheduledAt: null, // Initialize as null first
                    mediaMethod: schedule.mediaUrl ? 'url' : 'library',
                    mediaUrl: schedule.mediaUrl || '',
                    repeat: schedule.repeat || 'once', // Handle missing repeat field for backward compatibility
                    days: angular.copy(schedule.days) || {}, // Handle missing days field for backward compatibility
                    selectedMedia: null // Will be populated if media library is used
                };
                
                console.log('📝 [DIRECT-SCHEDULE] Edit mode - Original schedule:', schedule);
                console.log('📝 [DIRECT-SCHEDULE] Edit mode - Schedule repeat value:', schedule.repeat);
                console.log('📝 [DIRECT-SCHEDULE] Edit mode - Schedule days value:', schedule.days);
                
                console.log('Edit direct schedule formData after setup:', $scope.formData);
                console.log('Original schedule scheduledAt:', schedule.scheduledAt);
                
                // Set the Date object after a brief delay to force Angular refresh
                $timeout(function() {
                    $scope.formData.scheduledAt = parseToDateObject(schedule.scheduledAt);
                    console.log('Direct Schedule - Date object set to:', $scope.formData.scheduledAt);
                }, 50);
                
                // Use timeout to ensure proper form binding
                $timeout(function() {
                    // Ensure Angular detects the changes
                    $scope.$evalAsync(function() {
                        console.log('Direct Schedule - Final formData.scheduledAt (Date object):', $scope.formData.scheduledAt);
                        console.log('Direct Schedule - Is Date object?', $scope.formData.scheduledAt instanceof Date);
                        // Reset form validation state after data is populated
                        if ($scope.directScheduleForm) {
                            $scope.directScheduleForm.$setPristine();
                            $scope.directScheduleForm.$setUntouched();
                            console.log('Direct Schedule - Form reset completed. Form valid:', !$scope.directScheduleForm.$invalid);
                        }
                    });
                }, 300);
                
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
                    number: $scope.prefilledPhone || '',
                    message: $scope.prefilledName ? 'Hello ' + $scope.prefilledName + ', ' : ($scope.fromFollow ? 'Hello, ' : ''),
                    scheduledAt: '',
                    mediaMethod: 'library',
                    mediaUrl: '',
                    repeat: 'once', // Default to 'once'
                    days: {}, // Empty days object
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
                    scheduledAt: scheduledAtISO,
                    repeat: $scope.formData.repeat || 'once',
                    days: $scope.formData.days || {}
                };
                
                console.log('🔍 [DIRECT-SCHEDULE] Saving schedule with data:', scheduleData);
                console.log('🔍 [DIRECT-SCHEDULE] Form repeat value:', $scope.formData.repeat);
                console.log('🔍 [DIRECT-SCHEDULE] Form days value:', $scope.formData.days);
                
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

        // Helper functions for schedule types (similar to status module)
        $scope.getScheduleTypeDisplay = function(schedule) {
            var repeat = schedule.repeat || 'once';
            if (repeat === 'once') {
                if (schedule.status === 'Sent') {
                    return {
                        text: 'Sent',
                        class: 'bg-green-600 text-green-100',
                        icon: 'fas fa-check-circle'
                    };
                } else if (schedule.status === 'Failed') {
                    return {
                        text: 'Failed',
                        class: 'bg-red-600 text-red-100',
                        icon: 'fas fa-exclamation-circle'
                    };
                } else {
                    return {
                        text: 'Once',
                        class: 'bg-blue-600 text-blue-100',
                        icon: 'fas fa-clock'
                    };
                }
            } else if (repeat === 'daily') {
                return {
                    text: 'Daily',
                    class: 'bg-purple-600 text-purple-100',
                    icon: 'fas fa-repeat'
                };
            } else if (repeat === 'custom') {
                return {
                    text: 'Custom',
                    class: 'bg-teal-600 text-teal-100',
                    icon: 'fas fa-calendar-days'
                };
            }
            // Default fallback
            return {
                text: 'Scheduled',
                class: 'bg-yellow-600 text-yellow-100',
                icon: 'fas fa-calendar-check'
            };
        };

        $scope.getSelectedDays = function(days) {
            if (!days) return '';
            return Object.keys(days).filter(function(day) {
                return days[day];
            }).join(', ');
        };

        // Watch for changes to repeat field for debugging
        $scope.$watch('formData.repeat', function(newVal, oldVal) {
            if (newVal !== oldVal) {
                console.log('📝 [DIRECT-SCHEDULE] Repeat field changed from', oldVal, 'to', newVal);
            }
        });

        // Watch for changes to days field for debugging
        $scope.$watch('formData.days', function(newVal, oldVal) {
            if (newVal !== oldVal) {
                console.log('📝 [DIRECT-SCHEDULE] Days field changed:', newVal);
            }
        }, true); // Deep watch for object changes

        // Load initial data (no auto-scroll)
        $scope.loadSchedules();
        
        $scope.isPastOnce = function(schedule){
            if(!schedule || schedule.repeat !== 'once') return false;
            try { return new Date(schedule.scheduledAt||schedule.time||schedule.date).getTime() < Date.now(); } catch(e){ return false; }
        };
    }]);
