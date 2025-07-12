angular.module('autopostApp')
.controller('CampaignLeadsController', ['$scope', '$http', '$routeParams', function($scope, $http, $routeParams) {
    // Get campaign ID from route params
    $scope.campaignId = $routeParams.campaignId;
    
    // Initialize data
    $scope.leads = [];
    $scope.filteredLeads = [];
    $scope.campaign = {};
    $scope.stats = {};
    $scope.newLead = {};
    $scope.importStatus = null;
    $scope.showAddModal = false;
    $scope.showImportModalFlag = false;
    $scope.toast = { show: false };
    
    // Filters
    $scope.filterStatus = '';
    $scope.searchText = '';
    $scope.showOptedOut = false;
    
    // Load campaign details
    $scope.loadCampaign = function() {
        if (!$scope.campaignId) {
            showToast('No campaign ID provided', 'error');
            return;
        }
        
        $http.get('/api/campaigns/' + $scope.campaignId)
            .then(function(response) {
                $scope.campaign = response.data;
            })
            .catch(function(error) {
                console.error('Error loading campaign:', error);
                showToast('Failed to load campaign details', 'error');
            });
    };
    
    // Load leads
    $scope.loadLeads = function() {
        if (!$scope.campaignId) return;
        
        $http.get('/api/campaign-leads/' + $scope.campaignId)
            .then(function(response) {
                $scope.leads = response.data;
                $scope.filterLeads();
            })
            .catch(function(error) {
                console.error('Error loading leads:', error);
                showToast('Failed to load leads', 'error');
            });
    };
    
    // Load stats
    $scope.loadStats = function() {
        if (!$scope.campaignId) return;
        
        $http.get('/api/campaign-leads/' + $scope.campaignId + '/stats')
            .then(function(response) {
                $scope.stats = response.data;
            })
            .catch(function(error) {
                console.error('Error loading stats:', error);
            });
    };
    
    // Filter leads
    $scope.filterLeads = function() {
        $scope.filteredLeads = $scope.leads.filter(function(lead) {
            // Status filter
            if ($scope.filterStatus && lead.status !== $scope.filterStatus) {
                return false;
            }
            
            // Search filter
            if ($scope.searchText) {
                const searchLower = $scope.searchText.toLowerCase();
                const matchesPhone = lead.phone && lead.phone.toLowerCase().includes(searchLower);
                const matchesName = lead.name && lead.name.toLowerCase().includes(searchLower);
                const matchesEmail = lead.email && lead.email.toLowerCase().includes(searchLower);
                
                if (!matchesPhone && !matchesName && !matchesEmail) {
                    return false;
                }
            }
            
            // Opted out filter
            if (!$scope.showOptedOut && lead.isOptedOut) {
                return false;
            }
            
            return true;
        });
    };
    
    // Add lead
    $scope.addLead = function() {
        if (!$scope.newLead.phone) {
            showToast('Phone number is required', 'error');
            return;
        }
        
        $http.post('/api/campaign-leads/' + $scope.campaignId + '/add', $scope.newLead)
            .then(function(response) {
                showToast('Lead added successfully', 'success');
                $scope.newLead = {};
                $scope.showAddModal = false;
                $scope.loadLeads();
                $scope.loadStats();
            })
            .catch(function(error) {
                console.error('Error adding lead:', error);
                const message = error.data && error.data.error ? error.data.error : 'Failed to add lead';
                showToast(message, 'error');
            });
    };
    
    // Show add lead modal
    $scope.showAddLeadModal = function() {
        $scope.newLead = {};
        $scope.showAddModal = true;
    };
    
    // Show import modal
    $scope.showImportModal = function() {
        $scope.importStatus = null;
        $scope.showImportModalFlag = true;
    };
    
    // Show toast message
    function showToast(message, type) {
        $scope.toast = {
            show: true,
            message: message,
            type: type || 'success'
        };
        
        setTimeout(function() {
            $scope.$apply(function() {
                $scope.toast.show = false;
            });
        }, 3000);
    }
    
    // Handle file selection
    $scope.handleFileSelect = function(input) {
        const file = input.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.csv')) {
            showToast('Please select a CSV file', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('csvFile', file);
        
        $http.post('/api/campaign-leads/' + $scope.campaignId + '/import', formData, {
            headers: { 'Content-Type': undefined },
            transformRequest: angular.identity
        })
        .then(function(response) {
            $scope.importStatus = {
                success: true,
                message: 'CSV imported successfully',
                details: {
                    imported: response.data.imported,
                    errors: response.data.errors,
                    duplicates: response.data.duplicates
                }
            };
            
            $scope.loadLeads();
            $scope.loadStats();
            showToast('CSV imported successfully', 'success');
        })
        .catch(function(error) {
            console.error('Error importing CSV:', error);
            $scope.importStatus = {
                success: false,
                message: error.data && error.data.error ? error.data.error : 'Failed to import CSV'
            };
            showToast('Failed to import CSV', 'error');
        });
    };
    
    // Trigger file select
    $scope.triggerFileSelect = function() {
        var fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.click();
        }
    };
    
    // Export leads
    $scope.exportLeads = function() {
        window.open('/api/campaign-leads/' + $scope.campaignId + '/export', '_blank');
    };
    
    // View lead details
    $scope.viewLead = function(lead) {
        // TODO: Implement lead detail modal
        showToast('Lead detail view coming soon', 'info');
    };
    
    // Edit lead
    $scope.editLead = function(lead) {
        // TODO: Implement lead edit modal
        showToast('Lead editing coming soon', 'info');
    };
    
    // Toggle opt out
    $scope.toggleOptOut = function(lead) {
        const newStatus = !lead.isOptedOut;
        
        $http.put('/api/campaign-leads/' + $scope.campaignId + '/leads/' + lead.id, {
            isOptedOut: newStatus
        })
        .then(function(response) {
            lead.isOptedOut = newStatus;
            showToast(newStatus ? 'Lead opted out' : 'Lead opted in', 'success');
            $scope.loadStats();
        })
        .catch(function(error) {
            console.error('Error updating lead:', error);
            showToast('Failed to update lead', 'error');
        });
    };
    
    // Delete lead
    $scope.deleteLead = function(lead) {
        if (!confirm('Are you sure you want to delete this lead?')) {
            return;
        }
        $http.delete('/api/campaign-leads/' + $scope.campaignId + '/leads/' + lead.id)
            .then(function(response) {
                showToast('Lead deleted successfully', 'success');
                $scope.loadLeads();
                $scope.loadStats();
                // --- NEW: Also remove from campaign_leads.json globally (if not already) ---
                $http.delete('/api/global-campaign-leads/' + lead.id)
                    .then(function() {
                        // Optionally, show a toast or log
                        console.log('Lead also removed from global campaign_leads.json');
                    })
                    .catch(function(error) {
                        console.error('Error deleting lead from global campaign_leads.json:', error);
                    });
                // --- END NEW ---
            })
            .catch(function(error) {
                console.error('Error deleting lead:', error);
                showToast('Failed to delete lead', 'error');
            });
    };
    
    // Get progress percentage
    $scope.getProgressPercentage = function(lead) {
        if (!lead.totalSteps || lead.totalSteps === 0) return 0;
        return Math.round((lead.currentStep / lead.totalSteps) * 100);
    };
    
    // Format date
    $scope.formatDate = function(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };
    
    // Initialize
    $scope.loadCampaign();
    $scope.loadLeads();
    $scope.loadStats();
}]);
