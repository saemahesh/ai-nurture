angular.module('autopostWaApp.schedules')
    .controller('DirectScheduleController', ['$scope', '$http', function($scope, $http) {
        $scope.schedules = [];
        $scope.mediaLibrary = [];
        $scope.showMediaSelector = false;
        $scope.loadingMedia = false;
        
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
                alert((error.data && error.data.message) || 'Failed to load schedules.');
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
                    alert('Message scheduled successfully!');
                    console.log('Schedule created:', response.data);
                }).catch(function(error) {
                    console.error('Error creating schedule:', error);
                    alert((error.data && error.data.message) || 'Failed to schedule message.');
                });
            } catch (error) {
                console.error('Error preparing schedule data:', error);
                alert('Error preparing schedule data. Please check the form.');
            }
        };

        $scope.deleteSchedule = function(id) {
            if (confirm('Are you sure you want to delete this scheduled message?')) {
                $http.delete('/direct-schedule/' + id).then(function() {
                    $scope.schedules = $scope.schedules.filter(function(s) { return s.id !== id; });
                    alert('Schedule deleted successfully.');
                    console.log('Schedule deleted:', id);
                }).catch(function(error) {
                    console.error('Error deleting schedule:', error);
                    alert((error.data && error.data.message) || 'Failed to delete schedule.');
                });
            }
        };

        // Load initial data
        $scope.loadSchedules();
    }]);
