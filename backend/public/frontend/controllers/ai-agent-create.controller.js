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
        ignoreKeywords: ''
    };
    
    $scope.isEditMode = false;
    $scope.saving = false;
    $scope.errors = {};
    $scope.agentId = $routeParams.id;
    $scope.showTestModal = false;
    $scope.testMessage = '';
    $scope.testResponse = '';
    $scope.testingAgent = false;
    $scope.testConversation = [];
    $scope.testInput = { text: '' };

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
                
                if ($scope.agent.ignoreKeywords && Array.isArray($scope.agent.ignoreKeywords)) {
                    $scope.agent.ignoreKeywords = $scope.agent.ignoreKeywords.join(', ');
                } else {
                    $scope.agent.ignoreKeywords = '';
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
        
        if (agentData.ignoreKeywords) {
            if (typeof agentData.ignoreKeywords === 'string') {
                agentData.ignoreKeywords = agentData.ignoreKeywords
                    .split(',')
                    .map(function(keyword) { return keyword.trim(); })
                    .filter(function(keyword) { return keyword.length > 0; });
            } else if (Array.isArray(agentData.ignoreKeywords)) {
                // If it's already an array, just normalize it
                agentData.ignoreKeywords = agentData.ignoreKeywords.map(function(keyword) {
                    return keyword.toString().trim();
                }).filter(function(keyword) {
                    return keyword.length > 0;
                });
            }
        } else {
            agentData.ignoreKeywords = [];
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

    // Test agent
    $scope.testAgent = function() {
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
        if (!$scope.agentId) {
            console.log('No agentId available for loading test history');
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
        const testPhoneId = 'test_' + $scope.agentId + '_' + $scope.currentUser.username;
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
        if (!$scope.agentId) return;
        
        // Clear from backend
        const testPhoneId = 'test_' + $scope.agentId + '_' + $scope.currentUser.username;
        
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
        
        $http.post('/api/ai-agents/' + $scope.agentId + '/test', {
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
        return date.toLocaleTimeString();
    };

    // Initialize on load
    $scope.init();
}]);
