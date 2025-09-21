angular.module('autopostWaApp').controller('AIAgentCreateController', ['$scope', '$http', '$location', '$routeParams', 'NotificationService', function($scope, $http, $location, $routeParams, NotificationService) {
    $scope.agent = {
        name: '',
        description: '',
        status: 'active',
        systemPrompt: 'You are a helpful assistant that provides accurate and helpful responses based on the provided knowledge base. Always be polite and professional.',
        knowledgeBases: [],
        autoRespond: true,
        responseDelay: 2,
        triggerKeywords: '',
        ignoreKeywordsExact: '',
        ignoreKeywordsContains: ''
    };
    
    $scope.isEditMode = false;
    $scope.saving = false;
    $scope.errors = {};
    $scope.agentId = $routeParams.id;

    // Initialize notification service
    NotificationService.initToast($scope);
    NotificationService.initConfirmModal($scope);

    // Load current user info
    $scope.loadCurrentUser = function() {
        $http.get('/auth/me')
            .then(function(response) {
                $scope.currentUser = response.data.user;
            })
            .catch(function(error) {
                console.error('Error loading current user:', error);
                // Fallback - try to get username from session or use default
                $scope.currentUser = { username: 'default_user' };
            });
    };

    // Initialize
    $scope.init = function() {
        $scope.loadCurrentUser();
        if ($scope.agentId) {
            $scope.isEditMode = true;
            $scope.loadAgent();
        }
    };

    // Load existing agent for editing
    $scope.loadAgent = function() {
        $http.get('/api/ai-agents/' + $scope.agentId)
            .then(function(response) {
                $scope.agent = response.data;
                
                // Ensure knowledgeBases array exists
                if (!$scope.agent.knowledgeBases) {
                    $scope.agent.knowledgeBases = [];
                }
                
                // Set defaults for new fields
                if (!$scope.agent.systemPrompt) {
                    $scope.agent.systemPrompt = 'You are a helpful assistant that provides accurate and helpful responses based on the provided knowledge base. Always be polite and professional.';
                }
                if ($scope.agent.autoRespond === undefined) $scope.agent.autoRespond = true;
                if (!$scope.agent.responseDelay) $scope.agent.responseDelay = 2;
                // Convert keyword arrays to comma-separated strings for display
                if ($scope.agent.triggerKeywords && Array.isArray($scope.agent.triggerKeywords)) {
                    $scope.agent.triggerKeywords = $scope.agent.triggerKeywords.join(', ');
                } else {
                    $scope.agent.triggerKeywords = '';
                }
                
                // Handle exact match ignore keywords
                if ($scope.agent.ignoreKeywordsExact && Array.isArray($scope.agent.ignoreKeywordsExact)) {
                    $scope.agent.ignoreKeywordsExact = $scope.agent.ignoreKeywordsExact.join(', ');
                } else {
                    $scope.agent.ignoreKeywordsExact = '';
                }

                // Handle contains ignore keywords
                if ($scope.agent.ignoreKeywordsContains && Array.isArray($scope.agent.ignoreKeywordsContains)) {
                    $scope.agent.ignoreKeywordsContains = $scope.agent.ignoreKeywordsContains.join(', ');
                } else {
                    $scope.agent.ignoreKeywordsContains = '';
                }
                
                // Ensure knowledge bases have active status
                $scope.agent.knowledgeBases.forEach(function(kb) {
                    if (kb.active === undefined) kb.active = true;
                });
            })
            .catch(function(error) {
                console.error('Error loading agent:', error);
                NotificationService.showToast($scope, 'Error loading agent. Redirecting to agents list.', 'error');
                $location.path('/ai-agents');
            });
    };

    // Add knowledge base
    $scope.addKnowledgeBase = function() {
        $scope.agent.knowledgeBases.push({
            name: '',
            content: '',
            active: true
        });
    };

    // Confirm and remove knowledge base
    $scope.confirmRemoveKnowledgeBase = function(index) {
        var kbName = $scope.agent.knowledgeBases[index].name || 'Untitled Knowledge Base';
        NotificationService.showConfirmation($scope,
            'Delete Knowledge Base',
            'Are you sure you want to delete the knowledge base "' + kbName + '"? This action cannot be undone.',
            function() {
                $scope.removeKnowledgeBase(index);
                NotificationService.showToast($scope, 'Knowledge base deleted successfully!', 'success');
            },
            null,
            'Delete',
            'Cancel'
        );
    };

    // Remove knowledge base
    $scope.removeKnowledgeBase = function(index) {
        $scope.agent.knowledgeBases.splice(index, 1);
    };

    // Validate form
    $scope.isFormValid = function() {
        $scope.errors = {};
        var isValid = true;

        // Check agent name
        if (!$scope.agent.name || $scope.agent.name.trim() === '') {
            $scope.errors.name = 'Agent name is required';
            isValid = false;
        }

        // Check knowledge bases
        $scope.agent.knowledgeBases.forEach(function(kb, index) {
            if (!kb.name || kb.name.trim() === '') {
                $scope.errors['kb_name_' + index] = 'Knowledge base name is required';
                isValid = false;
            }
            if (!kb.content || kb.content.trim() === '') {
                $scope.errors['kb_content_' + index] = 'Knowledge base content is required';
                isValid = false;
            }
        });

        return isValid;
    };

    // Save agent
    $scope.saveAgent = function() {
        if (!$scope.isFormValid() || $scope.saving) return;
        
        $scope.saving = true;

        // Prepare agent data
        const agentData = angular.copy($scope.agent);
        
        // Clean up data
        agentData.name = agentData.name.trim();
        if (agentData.description) {
            agentData.description = agentData.description.trim();
        }
        
        // Process knowledge bases
        agentData.knowledgeBases = agentData.knowledgeBases.map(function(kb) {
            return {
                name: kb.name.trim(),
                content: kb.content.trim(),
                active: kb.active !== false // Default to true if not specified
            };
        });
        
        // Process keywords - convert comma-separated strings to arrays
        if (agentData.triggerKeywords) {
            agentData.triggerKeywords = agentData.triggerKeywords
                .split(',')
                .map(function(keyword) { return keyword.trim(); })
                .filter(function(keyword) { return keyword.length > 0; });
        } else {
            agentData.triggerKeywords = [];
        }
        
        // Process exact match ignore keywords
        if (agentData.ignoreKeywordsExact) {
            if (typeof agentData.ignoreKeywordsExact === 'string') {
                agentData.ignoreKeywordsExact = agentData.ignoreKeywordsExact
                    .split(',')
                    .map(function(keyword) { return keyword.trim(); })
                    .filter(function(keyword) { return keyword.length > 0; });
            }
        } else {
            agentData.ignoreKeywordsExact = [];
        }

        // Process contains ignore keywords
        if (agentData.ignoreKeywordsContains) {
            if (typeof agentData.ignoreKeywordsContains === 'string') {
                agentData.ignoreKeywordsContains = agentData.ignoreKeywordsContains
                    .split(',')
                    .map(function(keyword) { return keyword.trim(); })
                    .filter(function(keyword) { return keyword.length > 0; });
            }
        } else {
            agentData.ignoreKeywordsContains = [];
        }
        
        // Process trigger keywords
        if (agentData.triggerKeywords) {
            if (typeof agentData.triggerKeywords === 'string') {
                agentData.triggerKeywords = agentData.triggerKeywords.split(',').map(function(keyword) {
                    return keyword.trim().toLowerCase();
                }).filter(function(keyword) {
                    return keyword.length > 0;
                });
            } else if (Array.isArray(agentData.triggerKeywords)) {
                // If it's already an array, just normalize it
                agentData.triggerKeywords = agentData.triggerKeywords.map(function(keyword) {
                    return keyword.toString().trim().toLowerCase();
                }).filter(function(keyword) {
                    return keyword.length > 0;
                });
            }
        } else {
            agentData.triggerKeywords = [];
        }

        const request = $scope.isEditMode ? 
            $http.put('/api/ai-agents/' + $scope.agentId, agentData) :
            $http.post('/api/ai-agents', agentData);

        request
            .then(function(response) {
                NotificationService.showToast($scope, $scope.isEditMode ? 'Agent updated successfully!' : 'Agent created successfully!', 'success');
                $location.path('/ai-agents');
            })
            .catch(function(error) {
                console.error('Error saving agent:', error);
                var errorMessage = 'Error saving agent. Please try again.';
                if (error.data && error.data.error) {
                    errorMessage = error.data.error;
                }
                NotificationService.showToast($scope, errorMessage, 'error');
            })
            .finally(function() {
                $scope.saving = false;
            });
    };



    // Initialize on load
    $scope.init();
}]);
