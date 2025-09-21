angular.module('autopostWaApp').controller('AIAgentsController', ['$scope', '$http', '$location', 'NotificationService', function($scope, $http, $location, NotificationService) {
    $scope.agents = [];
    $scope.filteredAgents = [];
    $scope.loading = true;
    $scope.searchQuery = '';
    $scope.statusFilter = '';
    
    // Test functionality variables
    $scope.showTestModal = false;
    $scope.currentTestAgent = null;
    $scope.testConversation = [];
    $scope.testInput = { text: '' };
    $scope.testingAgent = false;

    // Initialize notification service
    NotificationService.initToast($scope);
    NotificationService.initConfirmModal($scope);

    // Initialize
    $scope.init = function() {
        $scope.loadCurrentUser();
        $scope.loadAgents();
    };

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

    // Test agent functionality
    $scope.testAgent = function(agent) {
        $scope.currentTestAgent = agent;
        $scope.showTestModal = true;
        $scope.testInput.text = '';
        
        // Load previous test conversation history if available
        $scope.loadTestConversationHistory();
    };

    // Close test modal
    $scope.closeTestModal = function() {
        $scope.showTestModal = false;
        $scope.testInput.text = '';
        // Don't clear testConversation - let it persist for next time
    };

    // Load test conversation history
    $scope.loadTestConversationHistory = function() {
        if (!$scope.currentTestAgent || !$scope.currentTestAgent.id) {
            console.log('No currentTestAgent available for loading test history');
            $scope.testConversation = [];
            return;
        }
        
        if (!$scope.currentUser || !$scope.currentUser.username) {
            console.log('Current user not loaded yet, trying again in 500ms...');
            setTimeout(function() {
                $scope.loadTestConversationHistory();
            }, 500);
            return;
        }
        
        // Get test phone ID for this agent and user
        const testPhoneId = 'test_' + $scope.currentTestAgent.id + '_' + $scope.currentUser.username;
        console.log('Loading test conversation history for:', testPhoneId);
        
        $http.get('/api/chat/messages/' + testPhoneId)
            .then(function(response) {
                console.log('Test conversation history loaded:', response.data.length, 'messages');
                
                // Convert chat messages to test conversation format
                $scope.testConversation = response.data.map(function(msg) {
                    return {
                        text: msg.text,
                        type: msg.type,
                        timestamp: msg.timestamp,
                        sender: msg.type === 'incoming' ? 'User' : (msg.type === 'ai' ? 'AI' : 'System')
                    };
                });
                
                // Scroll to bottom after loading with proper timing
                $scope.$evalAsync(function() {
                    setTimeout(function() {
                        $scope.scrollToBottom();
                    }, 300);
                });
            })
            .catch(function(error) {
                // If no history found, start with empty conversation
                console.log('No test conversation history found, starting fresh:', error.status);
                $scope.testConversation = [];
            });
    };

    // Clear test conversation
    $scope.clearTestConversation = function() {
        if (!$scope.currentTestAgent || !$scope.currentTestAgent.id) return;
        
        // Clear from backend
        const testPhoneId = 'test_' + $scope.currentTestAgent.id + '_' + $scope.currentUser.username;
        
        $http.delete('/api/chat/messages/' + testPhoneId)
            .then(function() {
                $scope.testConversation = [];
                console.log('Test conversation cleared successfully');
            })
            .catch(function(error) {
                console.error('Error clearing test conversation:', error);
                // Clear locally anyway
                $scope.testConversation = [];
            });
    };

    // Send test message
    $scope.sendTestMessage = function() {
        if (!$scope.testInput.text || $scope.testingAgent) return;
        
        const userMessage = $scope.testInput.text.trim();
        if (!userMessage) return;
        
        // Add user message to conversation
        $scope.testConversation.push({
            text: userMessage,
            type: 'incoming',
            timestamp: new Date().toISOString(),
            sender: 'User'
        });
        
        // Check ignore keywords before sending to AI
        if ($scope.currentTestAgent.ignoreKeywords && $scope.currentTestAgent.ignoreKeywords.length > 0) {
            const messageLower = userMessage.toLowerCase();
            const hasIgnoreKeyword = $scope.currentTestAgent.ignoreKeywords.some(function(keyword) {
                return messageLower.includes(keyword.toLowerCase());
            });
            
            if (hasIgnoreKeyword) {
                // Add system message explaining why AI didn't respond
                $scope.testConversation.push({
                    text: 'AI Agent did not respond because the message contains an ignore keyword. The agent is configured to ignore messages containing: ' + $scope.currentTestAgent.ignoreKeywords.join(', '),
                    type: 'system',
                    timestamp: new Date().toISOString(),
                    sender: 'System'
                });
                
                $scope.testInput.text = '';
                
                // Scroll to bottom to show system message
                $scope.$evalAsync(function() {
                    setTimeout(function() {
                        $scope.scrollToBottom();
                    }, 50);
                });
                
                return; // Don't send to backend
            }
        }
        
        // Scroll to show user message immediately
        $scope.$evalAsync(function() {
            setTimeout(function() {
                $scope.scrollToBottom();
            }, 50);
        });
        
        $scope.testingAgent = true;
        $scope.testInput.text = '';
        
        // Get last 20 messages for context (or all if less than 20)
        const conversationHistory = $scope.testConversation.slice(-20);
        
        $http.post('/api/ai-agents/' + $scope.currentTestAgent.id + '/test', {
            message: userMessage,
            conversationHistory: conversationHistory
        })
        .then(function(response) {
            // Add AI response to conversation
            $scope.testConversation.push({
                text: response.data.response,
                type: 'ai',
                timestamp: new Date().toISOString(),
                sender: 'AI'
            });
            
            // Scroll to bottom of conversation
            $scope.$evalAsync(function() {
                setTimeout(function() {
                    $scope.scrollToBottom();
                }, 200);
            });
        })
        .catch(function(error) {
            console.error('Error testing agent:', error);
            // Add error message to conversation
            $scope.testConversation.push({
                text: 'Error: ' + (error.data && error.data.error ? error.data.error : 'Unknown error occurred'),
                type: 'error',
                timestamp: new Date().toISOString(),
                sender: 'System'
            });
        })
        .finally(function() {
            $scope.testingAgent = false;
        });
    };

    // Handle enter key in test input
    $scope.handleTestKeyPress = function(event) {
        if (event.keyCode === 13 && !event.shiftKey) {
            event.preventDefault();
            $scope.sendTestMessage();
        }
    };

    // Scroll to bottom of conversation container
    $scope.scrollToBottom = function() {
        try {
            var container = document.getElementById('testConversationContainer');
            if (container) {
                // Multiple techniques to ensure scrolling works
                // 1. Force reflow
                container.style.height = container.style.height;
                
                // 2. Use smooth scroll if supported
                if (container.scrollTo) {
                    container.scrollTo({
                        top: container.scrollHeight,
                        behavior: 'smooth'
                    });
                } else {
                    // 3. Fallback to direct scrollTop
                    container.scrollTop = container.scrollHeight;
                }
                
                console.log('Scrolled to bottom. Container height:', container.scrollHeight, 'Scroll position:', container.scrollTop, 'Client height:', container.clientHeight);
                
                // 4. Double-check after animation frame
                requestAnimationFrame(function() {
                    if (container.scrollTop < container.scrollHeight - container.clientHeight - 5) {
                        container.scrollTop = container.scrollHeight;
                        console.log('Force scrolled to bottom on animation frame');
                    }
                });
            } else {
                console.warn('testConversationContainer not found for scrolling');
            }
        } catch (error) {
            console.error('Error scrolling to bottom:', error);
        }
    };

    // Format time for conversation
    $scope.formatTestTime = function(timestamp) {
        if (!timestamp) return '';
        var date = new Date(timestamp);
        var now = new Date();
        
        // Same day - show time only
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        }
        
        // Different day - show date with time
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    // Initialize on load
    $scope.init();
}]);
