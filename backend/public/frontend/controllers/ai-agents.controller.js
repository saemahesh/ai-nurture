angular.module('autopostWaApp').controller('AIAgentsController', ['$scope', '$http', '$location', 'NotificationService', function($scope, $http, $location, NotificationService) {
    $scope.agents = [];
    $scope.filteredAgents = [];
    $scope.loading = true;
    $scope.searchQuery = '';
    $scope.statusFilter = '';

    // Initialize notification service
    NotificationService.initToast($scope);
    NotificationService.initConfirmModal($scope);

    // Initialize
    $scope.init = function() {
        $scope.loadAgents();
    };

    // Load agents
    $scope.loadAgents = function() {
        $scope.loading = true;
        $http.get('/api/ai-agents')
            .then(function(response) {
                $scope.agents = response.data;
                $scope.filterAgents();
            })
            .catch(function(error) {
                console.error('Error loading agents:', error);
                NotificationService.showToast($scope, 'Error loading AI agents. Please try again.', 'error');
            })
            .finally(function() {
                $scope.loading = false;
            });
    };

    // Filter agents based on search and status
    $scope.filterAgents = function() {
        $scope.filteredAgents = $scope.agents.filter(function(agent) {
            var matchesSearch = !$scope.searchQuery || 
                agent.name.toLowerCase().includes($scope.searchQuery.toLowerCase()) ||
                (agent.description && agent.description.toLowerCase().includes($scope.searchQuery.toLowerCase()));
            
            var matchesStatus = !$scope.statusFilter || agent.status === $scope.statusFilter;
            
            return matchesSearch && matchesStatus;
        });
    };

    // Watch for changes in search/filter
    $scope.$watch('searchQuery', $scope.filterAgents);
    $scope.$watch('statusFilter', $scope.filterAgents);

    // Get active agents count
    $scope.getActiveAgents = function() {
        return $scope.agents.filter(function(agent) {
            return agent.status === 'active';
        }).length;
    };

    // Get total knowledge bases count
    $scope.getTotalKnowledgeBases = function() {
        return $scope.agents.reduce(function(total, agent) {
            return total + (agent.knowledgeBases ? agent.knowledgeBases.length : 0);
        }, 0);
    };

    // Toggle agent status
    $scope.toggleAgentStatus = function(agent) {
        console.log('toggleAgentStatus called for agent:', agent);
        var newStatus = agent.status === 'active' ? 'inactive' : 'active';
        var actionText = newStatus === 'active' ? 'activate' : 'deactivate';
        
        NotificationService.showConfirmation($scope,
            'Confirm Action',
            'Are you sure you want to ' + actionText + ' the agent "' + agent.name + '"?',
            function() {
                $http.put('/api/ai-agents/' + agent.id, { status: newStatus })
                    .then(function(response) {
                        agent.status = newStatus;
                        NotificationService.showToast($scope, 'Agent ' + actionText + 'd successfully!', 'success');
                    })
                    .catch(function(error) {
                        console.error('Error updating agent status:', error);
                        NotificationService.showToast($scope, 'Error updating agent status. Please try again.', 'error');
                    });
            },
            null,
            actionText.charAt(0).toUpperCase() + actionText.slice(1),
            'Cancel'
        );
    };

    // Delete agent
    $scope.deleteAgent = function(agent) {
        console.log('deleteAgent called for agent:', agent);
        NotificationService.showConfirmation($scope,
            'Delete AI Agent',
            'Are you sure you want to delete the agent "' + agent.name + '"? This action cannot be undone.',
            function() {
                $http.delete('/api/ai-agents/' + agent.id)
                    .then(function(response) {
                        // Remove from local array
                        var index = $scope.agents.indexOf(agent);
                        if (index > -1) {
                            $scope.agents.splice(index, 1);
                            $scope.filterAgents();
                        }
                        NotificationService.showToast($scope, 'Agent deleted successfully!', 'success');
                    })
                    .catch(function(error) {
                        console.error('Error deleting agent:', error);
                        NotificationService.showToast($scope, 'Error deleting agent. Please try again.', 'error');
                    });
            },
            null,
            'Delete',
            'Cancel'
        );
    };

    // Format date
    $scope.formatDate = function(dateString) {
        if (!dateString) return 'Never';
        var date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    // Open edit page for agent
    $scope.openEditPage = function(agentId) {
        $location.path('/ai-agents/' + agentId);
    };

    // Initialize on load
    $scope.init();
}]);
