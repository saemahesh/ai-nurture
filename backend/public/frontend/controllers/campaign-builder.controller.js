// Campaign Builder Controller
angular.module('autopostWaApp').controller('CampaignBuilderController', function($scope, $http, $location, $routeParams, $timeout) {
    
    // Initialize scope variables immediately
    $scope.currentStep = 1;
    $scope.isEditMode = false;
    $scope.saving = false;
    $scope.isValid = true;
    $scope.showMediaLibrary = false;
    $scope.selectedDayForMedia = null;
    $scope.mediaLibrary = [];
    
    // Campaign object with defaults
    $scope.campaign = {
        name: '',
        description: '',
        duration: 7,
        timeline: [],
        messages: {},
        status: 'draft'
    };
    
    // Available days for timeline
    $scope.availableDays = [1, 2, 3, 4, 5, 6, 7];
    
    // Toast notification system
    $scope.toast = {
        show: false,
        type: 'success',
        message: ''
    };
    
    // Initialize controller
    $scope.init = function() {
        // Check if editing existing campaign
        if ($routeParams.id) {
            $scope.isEditMode = true;
            $scope.loadCampaign($routeParams.id);
        } else {
            $scope.generateAvailableDays();
        }
        $scope.loadMediaLibrary();
    };
    
    // Load existing campaign for editing
    $scope.loadCampaign = function(id) {
        $http.get('/api/campaigns/' + id)
            .then(function(response) {
                $scope.campaign = response.data;
                $scope.generateAvailableDays();
                $scope.initializeMessages();
            })
            .catch(function(error) {
                console.error('Error loading campaign:', error);
                $scope.showToast('error', 'Failed to load campaign');
                $location.path('/campaigns');
            });
    };
    
    // Generate available days based on campaign duration
    $scope.generateAvailableDays = function() {
        if (!$scope.campaign.duration) return;
        
        $scope.availableDays = [];
        for (let i = 1; i <= $scope.campaign.duration; i++) {
            $scope.availableDays.push(i);
        }
        
        // Initialize messages for timeline days
        $scope.initializeMessages();
    };
    
    // Initialize messages object for timeline days
    $scope.initializeMessages = function() {
        $scope.campaign.timeline.forEach(function(day) {
            if (!$scope.campaign.messages[day]) {
                $scope.campaign.messages[day] = {
                    type: 'text',
                    message: '',
                    mediaUrl: '',
                    selectedMedia: null
                };
            }
        });
    };
    
    // Load media library
    $scope.loadMediaLibrary = function() {
        $http.get('/media/list')
            .then(function(response) {
                $scope.mediaLibrary = response.data;
            })
            .catch(function(error) {
                console.error('Error loading media library:', error);
            });
    };
    
    // Step navigation
    $scope.goToStep = function(step) {
        if (step <= 4 && step >= 1) {
            $scope.currentStep = step;
            if (step === 2) {
                $scope.generateAvailableDays();
            }
        }
    };
    
    $scope.nextStep = function() {
        if ($scope.validateCurrentStep() && $scope.currentStep < 4) {
            $scope.currentStep++;
            if ($scope.currentStep === 2) {
                $scope.generateAvailableDays();
            }
        }
    };
    
    $scope.previousStep = function() {
        if ($scope.currentStep > 1) {
            $scope.currentStep--;
        }
    };
    
    // Timeline management
    $scope.toggleDay = function(day) {
        const index = $scope.campaign.timeline.indexOf(day);
        if (index > -1) {
            $scope.campaign.timeline.splice(index, 1);
            delete $scope.campaign.messages[day];
        } else {
            $scope.campaign.timeline.push(day);
            $scope.campaign.messages[day] = {
                type: 'text',
                message: '',
                mediaUrl: '',
                selectedMedia: null
            };
        }
        $scope.campaign.timeline.sort((a, b) => a - b);
    };
    
    // Apply timeline templates
    $scope.applyTemplate = function(template) {
        $scope.campaign.timeline = [];
        $scope.campaign.messages = {};
        
        let templateDays = [];
        switch (template) {
            case 'quick':
                templateDays = [1, 3, 7];
                break;
            case 'nurture':
                templateDays = [1, 3, 7, 14, 21];
                break;
            case 'extended':
                templateDays = [1, 3, 7, 14, 21, 30, 60];
                break;
        }
        
        // When initializing messages, use 'message' instead of 'content' or 'caption'
        templateDays.forEach(function(day) {
            if (day <= $scope.campaign.duration) {
                $scope.campaign.timeline.push(day);
                $scope.campaign.messages[day] = {
                    type: 'text',
                    message: '',
                    mediaUrl: '',
                    selectedMedia: null
                };
            }
        });
    };
    
    // Validate current step
    $scope.validateCurrentStep = function() {
        switch ($scope.currentStep) {
            case 1:
                return $scope.campaign.name && $scope.campaign.duration && 
                       $scope.campaign.duration >= 1 && $scope.campaign.duration <= 90;
            case 2:
                return $scope.campaign.timeline.length > 0;
            case 3:
                return $scope.allMessagesValid();
            default:
                return true;
        }
    };
    
    // Timeline management
    $scope.toggleDay = function(day) {
        const index = $scope.campaign.timeline.indexOf(day);
        if (index > -1) {
            $scope.campaign.timeline.splice(index, 1);
            delete $scope.campaign.messages[day];
        } else {
            $scope.campaign.timeline.push(day);
            $scope.campaign.messages[day] = {
                type: 'text',
                message: '',
                mediaUrl: '',
                selectedMedia: null
            };
        }
        $scope.campaign.timeline.sort((a, b) => a - b);
    };
    
    // Apply timeline templates
    $scope.applyTemplate = function(template) {
        $scope.campaign.timeline = [];
        $scope.campaign.messages = {};
        
        let templateDays = [];
        switch (template) {
            case 'quick':
                templateDays = [1, 3, 7];
                break;
            case 'nurture':
                templateDays = [1, 3, 7, 14, 21];
                break;
            case 'extended':
                templateDays = [1, 3, 7, 14, 21, 30, 60];
                break;
        }
        
        // When initializing messages, use 'message' instead of 'content' or 'caption'
        templateDays.forEach(function(day) {
            if (day <= $scope.campaign.duration) {
                $scope.campaign.timeline.push(day);
                $scope.campaign.messages[day] = {
                    type: 'text',
                    message: '',
                    mediaUrl: '',
                    selectedMedia: null
                };
            }
        });
    };
    
    // Message validation
    $scope.allMessagesValid = function() {
        return $scope.campaign.timeline.every(function(day) {
            const message = $scope.campaign.messages[day];
            return message && message.message && message.message.trim();
        });
    };
    
    // Preview message with personalization
    $scope.getPreviewMessage = function(message) {
        if (!message) return '';
        return message.replace(/\{first_name\}/g, 'John')
                      .replace(/\{company\}/g, 'Acme Corp')
                      .replace(/\{phone\}/g, '+1234567890');
    };
    
    // Media library functions
    $scope.openMediaLibrary = function(day) {
        $scope.selectedDayForMedia = day;
        $scope.showMediaLibrary = true;
    };
    
    $scope.closeMediaLibrary = function() {
        $scope.showMediaLibrary = false;
        $scope.selectedDayForMedia = null;
    };
    
    $scope.selectMedia = function(media) {
        if ($scope.selectedDayForMedia) {
            $scope.campaign.messages[$scope.selectedDayForMedia].selectedMedia = media;
            $scope.campaign.messages[$scope.selectedDayForMedia].mediaUrl = media.url;
        }
        $scope.closeMediaLibrary();
    };
    
    // Campaign actions
    $scope.saveDraft = function() {
        $scope.saving = true;
        $scope.campaign.status = 'draft';
        
        const apiCall = $scope.isEditMode ? 
            $http.put('/api/campaigns/' + $scope.campaign.id, $scope.campaign) :
            $http.post('/api/campaigns', $scope.campaign);
        
        apiCall.then(function(response) {
            $scope.saving = false;
            $scope.showToast('success', 'Campaign saved as draft');
            if (!$scope.isEditMode) {
                $scope.campaign.id = response.data.id;
                $scope.isEditMode = true;
            }
        }).catch(function(error) {
            $scope.saving = false;
            console.error('Error saving campaign:', error);
            $scope.showToast('error', error.data?.error || 'Failed to save campaign');
        });
    };
    
    $scope.submitCampaign = function() {
        if (!$scope.validateCurrentStep()) {
            $scope.showToast('error', 'Please fill all required fields');
            return;
        }
        
        $scope.saving = true;
        $scope.campaign.status = 'draft';
        
        const apiCall = $scope.isEditMode ? 
            $http.put('/api/campaigns/' + $scope.campaign.id, $scope.campaign) :
            $http.post('/api/campaigns', $scope.campaign);
        
        apiCall.then(function(response) {
            $scope.saving = false;
            $scope.showToast('success', $scope.isEditMode ? 'Campaign updated successfully' : 'Campaign created successfully');
            $timeout(function() {
                $location.path('/campaigns');
            }, 1500);
        }).catch(function(error) {
            $scope.saving = false;
            console.error('Error submitting campaign:', error);
            $scope.showToast('error', error.data?.error || 'Failed to submit campaign');
        });
    };
    
    $scope.previewCampaign = function() {
        // Implementation for campaign preview
        $scope.showToast('info', 'Campaign preview feature coming soon');
    };
    
    // Watch for campaign duration changes
    $scope.$watch('campaign.duration', function(newVal, oldVal) {
        if (newVal !== oldVal && newVal) {
            $scope.generateAvailableDays();
            // Remove timeline days that exceed new duration
            $scope.campaign.timeline = $scope.campaign.timeline.filter(day => day <= newVal);
        }
    });
    
    // Show toast notification
    $scope.showToast = function(type, message) {
        $scope.toast = {
            show: true,
            type: type,
            message: message
        };
        
        // Auto-hide toast after 3 seconds
        $timeout(function() {
            $scope.toast.show = false;
        }, 3000);
    };
    
    // Initialize controller
    $scope.init();
});
