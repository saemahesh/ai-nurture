// Campaigns Controller
angular.module('autopostWaApp').controller('CampaignsController', function($scope, $http, $interval, $timeout) {
    
    // Initialize scope variables
    $scope.campaigns = [];
    $scope.loading = false;
    $scope.showMenu = {};
    $scope.dashboardStats = {
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalEnrollments: 0,
        sentMessages: 0,
        pendingMessages: 0,
        deliveryRate: 0,
        recentMessages: 0,
        recentEnrollments: 0,
        topCampaigns: [],
        lastUpdated: null
    };
    $scope.queueStatus = {
        pending: 0,
        overdue: 0,
        next24h: 0
    };
    
    // Toast notification system
    $scope.toast = {
        show: false,
        type: 'success',
        message: ''
    };
    
    // Confirmation modal
    $scope.showConfirmModal = false;
    $scope.confirmModal = {
        title: '',
        message: '',
        confirmText: 'Confirm',
        action: null
    };
    
    // Load campaigns on page load
    $scope.init = function() {
        $scope.loadCampaigns();
        $scope.loadDashboardAnalytics();
        $scope.loadQueueStatus();
        $scope.startRealTimeUpdates();
    };
    
    // Load campaigns from API
    $scope.loadCampaigns = function() {
        $scope.loading = true;
        $http.get('/api/campaigns')
            .then(function(response) {
                $scope.campaigns = response.data;
                $scope.calculateDashboardStats();
                $scope.loading = false;
            })
            .catch(function(error) {
                console.error('Error loading campaigns:', error);
                $scope.showToast('error', 'Failed to load campaigns');
                $scope.loading = false;
            });
    };
    
    // Load dashboard analytics
    $scope.loadDashboardAnalytics = function() {
        $http.get('/api/analytics/dashboard')
            .then(function(response) {
                $scope.dashboardStats = response.data;
            })
            .catch(function(error) {
                console.error('Error loading dashboard analytics:', error);
            });
    };
    
    // Load queue status
    $scope.loadQueueStatus = function() {
        $http.get('/api/analytics/queue-status')
            .then(function(response) {
                $scope.queueStatus = {
                    pending: response.data.statusCounts.pending,
                    overdue: response.data.overdueMessages,
                    next24h: response.data.nextMessages.length
                };
            })
            .catch(function(error) {
                console.error('Error loading queue status:', error);
            });
    };
    
    // Refresh campaigns manually
    $scope.refreshCampaigns = function() {
        $scope.loadCampaigns();
    };
    
    // Start real-time updates
    $scope.startRealTimeUpdates = function() {
        // Update every 30 seconds
        $interval(function() {
            $scope.loadCampaigns();
            $scope.loadDashboardAnalytics();
            $scope.loadQueueStatus();
        }, 30000);
    };
    
    // Toggle campaign menu
    $scope.toggleCampaignMenu = function(campaignId) {
        // Close all other menus
        Object.keys($scope.showMenu).forEach(key => {
            if (key !== campaignId) {
                $scope.showMenu[key] = false;
            }
        });
        
        // Toggle current menu
        $scope.showMenu[campaignId] = !$scope.showMenu[campaignId];
    };
    
    // Close menus when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.relative')) {
            $scope.$apply(function() {
                $scope.showMenu = {};
            });
        }
    });
    
    // Start campaign
    $scope.startCampaign = function(campaign) {
        $scope.showConfirmModal = true;
        $scope.confirmModal = {
            title: 'Start Campaign',
            message: `Are you sure you want to start the campaign "${campaign.name}"? This will begin sending messages to all leads.`,
            confirmText: 'Start Campaign',
            action: function() {
                $http.post('/api/campaign-execution/start/' + campaign.id)
                    .then(function(response) {
                        $scope.showToast('success', 'Campaign started successfully');
                        $scope.loadCampaigns();
                    })
                    .catch(function(error) {
                        console.error('Error starting campaign:', error);
                        $scope.showToast('error', error.data?.error || 'Failed to start campaign');
                    });
            }
        };
    };
    
    // Pause campaign
    $scope.pauseCampaign = function(campaign) {
        $scope.showConfirmModal = true;
        $scope.confirmModal = {
            title: 'Pause Campaign',
            message: `Are you sure you want to pause the campaign "${campaign.name}"? Queued messages will be delayed.`,
            confirmText: 'Pause Campaign',
            action: function() {
                $http.post('/api/campaign-execution/pause/' + campaign.id)
                    .then(function(response) {
                        $scope.showToast('success', 'Campaign paused successfully');
                        $scope.loadCampaigns();
                    })
                    .catch(function(error) {
                        console.error('Error pausing campaign:', error);
                        $scope.showToast('error', error.data?.error || 'Failed to pause campaign');
                    });
            }
        };
    };
    
    // Resume campaign
    $scope.resumeCampaign = function(campaign) {
        $scope.showConfirmModal = true;
        $scope.confirmModal = {
            title: 'Resume Campaign',
            message: `Are you sure you want to resume the campaign "${campaign.name}"? This will continue sending messages to leads.`,
            confirmText: 'Resume Campaign',
            action: function() {
                $http.post('/api/campaign-execution/resume/' + campaign.id)
                    .then(function(response) {
                        $scope.showToast('success', 'Campaign resumed successfully');
                        $scope.loadCampaigns();
                    })
                    .catch(function(error) {
                        console.error('Error resuming campaign:', error);
                        $scope.showToast('error', error.data?.error || 'Failed to resume campaign');
                    });
            }
        };
    };
    
    // Delete campaign
    $scope.deleteCampaign = function(campaign) {
        $scope.showConfirmModal = true;
        $scope.confirmModal = {
            title: 'Delete Campaign',
            message: `Are you sure you want to delete the campaign "${campaign.name}"? This action cannot be undone.`,
            confirmText: 'Delete Campaign',
            action: function() {
                $http.delete('/api/campaigns/' + campaign.id)
                    .then(function(response) {
                        $scope.showToast('success', 'Campaign deleted successfully');
                        $scope.loadCampaigns();
                    })
                    .catch(function(error) {
                        console.error('Error deleting campaign:', error);
                        $scope.showToast('error', error.data?.error || 'Failed to delete campaign');
                    });
            }
        };
    };
    
    // Confirm action
    $scope.confirmAction = function() {
        if ($scope.confirmModal.action) {
            $scope.confirmModal.action();
        }
        $scope.showConfirmModal = false;
        $scope.showMenu = {};
    };
    
    // Cancel confirmation
    $scope.cancelConfirm = function() {
        $scope.showConfirmModal = false;
        $scope.showMenu = {};
    };
    
    // Get progress percentage for a campaign
    $scope.getProgressPercentage = function(campaign) {
        if (!campaign.stats.totalLeads) return 0;
        return Math.round((campaign.stats.leadsCompleted / campaign.stats.totalLeads) * 100);
    };
    
    // Format date for display
    $scope.formatDate = function(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };
    
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
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Escape key to close modals and menus
        if (event.key === 'Escape') {
            $scope.$apply(function() {
                $scope.showConfirmModal = false;
                $scope.showMenu = {};
            });
        }
        
        // R key to refresh
        if (event.key === 'r' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            $scope.$apply(function() {
                $scope.refreshCampaigns();
            });
        }
    });
    
    // Initialize controller
    $scope.init();
    
    // Cleanup on destroy
    $scope.$on('$destroy', function() {
        // Clean up intervals if needed
    });
});
