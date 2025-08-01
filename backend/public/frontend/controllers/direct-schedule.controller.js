angular.module('autopostWaApp.schedules')
    .controller('DirectScheduleController', ['$scope', '$http', 'NotificationService', function($scope, $http, NotificationService) {
        $scope.schedules = [];
        $scope.mediaLibrary = [];
        $scope.showMediaSelector = false;
        $scope.loadingMedia = false;
        
        // Initialize notification service
        NotificationService.initToast($scope);
        NotificationService.initConfirmModal($scope);
        
        $scope.newSchedule = {
            number: '',
            message: '',
            mediaUrl: '',
            selectedMedia: null,
            scheduledAt: ''
        };

        $scope.loadSchedules = function() {
            $http.get('/direct-schedule').then(function(response) {
                $scope.schedules = response.data;
                console.log('Loaded schedules:', response.data);
            }).catch(function(error) {
                console.error('Error loading direct schedules:', error);
                NotificationService.showToast($scope, (error.data && error.data.message) || 'Failed to load schedules.', 'error');
            });
        };

        // Load media library
        $scope.loadMediaLibrary = function() {
            $scope.loadingMedia = true;
            $http.get('/media/list').then(function(response) {
                $scope.mediaLibrary = response.data;
                console.log('Loaded media library:', response.data);
                $scope.loadingMedia = false;
            }).catch(function(error) {
                console.error('Error loading media library:', error);
                $scope.loadingMedia = false;
            });
        };

        // Open media selector
        $scope.openMediaSelector = function() {
            $scope.showMediaSelector = true;
            $scope.loadMediaLibrary();
        };

        // Close media selector
        $scope.closeMediaSelector = function() {
            $scope.showMediaSelector = false;
        };

        // Select media for schedule
        $scope.selectMediaForSchedule = function(media) {
            console.log('Selected media:', media);
            $scope.newSchedule.selectedMedia = media;
            $scope.newSchedule.mediaUrl = ''; // Clear URL field when selecting from library
            $scope.closeMediaSelector();
        };

        // Clear selected media
        $scope.clearSelectedMedia = function() {
            $scope.newSchedule.selectedMedia = null;
        };

        $scope.createSchedule = function() {
            try {
                // Convert local datetime to ISO string
                var scheduledAtISO = new Date($scope.newSchedule.scheduledAt).toISOString();
                
                // Determine media URL - prioritize selected media from library
                var mediaUrl = null;
                if ($scope.newSchedule.selectedMedia && $scope.newSchedule.selectedMedia.url) {
                    mediaUrl = $scope.newSchedule.selectedMedia.url;
                } else if ($scope.newSchedule.mediaUrl) {
                    mediaUrl = $scope.newSchedule.mediaUrl;
                }
                
                var scheduleData = {
                    number: $scope.newSchedule.number,
                    message: $scope.newSchedule.message,
                    mediaUrl: mediaUrl,
                    scheduledAt: scheduledAtISO
                };
                
                console.log('Creating schedule with data:', scheduleData);
                
                $http.post('/direct-schedule', scheduleData).then(function(response) {
                    $scope.schedules.push(response.data);
                    $scope.newSchedule = { 
                        number: '', 
                        message: '', 
                        mediaUrl: '', 
                        selectedMedia: null,
                        scheduledAt: '' 
                    }; // Reset form
                    NotificationService.showToast($scope, 'Message scheduled successfully!', 'success');
                    console.log('Schedule created:', response.data);
                }).catch(function(error) {
                    console.error('Error creating schedule:', error);
                    NotificationService.showToast($scope, (error.data && error.data.message) || 'Failed to schedule message.', 'error');
                });
            } catch (error) {
                console.error('Error preparing schedule data:', error);
                NotificationService.showToast($scope, 'Error preparing schedule data. Please check the form.', 'error');
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
                        console.log('Schedule deleted:', id);
                    }).catch(function(error) {
                        console.error('Error deleting schedule:', error);
                        NotificationService.showToast($scope, (error.data && error.data.message) || 'Failed to delete schedule.', 'error');
                    });
                }
            );
        };

        // Load initial data
        $scope.loadSchedules();
    }]);
