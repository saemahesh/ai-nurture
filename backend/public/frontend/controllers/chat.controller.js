angular.module('autopostWaApp').controller('ChatController', ['$scope', '$http', '$interval', '$location', '$timeout', '$routeParams', function($scope, $http, $interval, $location, $timeout, $routeParams) {
    // Initialize data
    $scope.contacts = [];
    $scope.filteredContacts = [];
    $scope.messages = [];
    $scope.selectedContact = null;
    $scope.messageInput = { text: '' };  // Use object instead of primitive
    $scope.searchQuery = '';
    $scope.showContactList = true;
    $scope.isMobile = window.innerWidth < 768;
    
    // Loading states
    $scope.loadingContacts = false;
    $scope.loadingMessages = false;
    $scope.refreshing = false;
    $scope.refreshingMessages = false;
    $scope.sending = false;
    
    // Modal states
    $scope.showDeleteModal = false;
    $scope.deletingChat = false;
    
    // Toast notification system
    $scope.toast = { show: false };
    
    // Load Earlier Messages button state
    $scope.showLoadEarlierButton = false;
    
    // Initialize chat with auto-scroll to bottom
    $scope.initializeChat = function() {
        // Set scroll to bottom immediately on page load
        $scope.scrollToBottom();
    };
    
    // Show toast notification
    $scope.showToast = function(message, type) {
        $scope.toast = {
            show: true,
            message: message,
            type: type || 'success'
        };
        
        // Auto-hide toast after 3 seconds
        $timeout(function() {
            $scope.toast.show = false;
        }, 3000);
    };

    // Initialize Socket.IO
    $scope.socket = null;
    $scope.initSocket = function() {
        if (typeof io !== 'undefined') {
            $scope.socket = io();
            
            // Handle connection
            $scope.socket.on('connect', function() {
                console.log('🔌 Connected to server with Socket.IO');
            });
            
            // Handle new messages
            $scope.socket.on('new-message', function(message) {
                console.log('📨 Received new message:', message);
                
                // Add message to current conversation if it matches selected contact
                if ($scope.selectedContact && message.phone === $scope.selectedContact.phone) {
                    $scope.messages.push(message);
                    $scope.$apply(); // Trigger digest cycle
                    
                    // Scroll to bottom
                    setTimeout(function() {
                        $scope.scrollToBottom();
                    }, 100);
                    
                    // If user is viewing this conversation, mark new messages as read immediately
                    setTimeout(function() {
                        $scope.markMessagesAsRead(message.phone);
                    }, 500);
                } else {
                    // If message is not for currently selected contact, increment unread count
                    const contact = $scope.contacts.find(c => c.phone === message.phone);
                    if (contact && (message.type === 'incoming' || message.type === 'ai')) {
                        contact.unreadCount = (contact.unreadCount || 0) + 1;
                        $scope.$apply();
                    }
                }
                
                // Update contacts list
                $scope.loadContacts();
            });
            
            // Handle unread count updates
            $scope.socket.on('unread-count-update', function(data) {
                console.log('📊 Received unread count update:', data);
                
                // Update the contact's unread count
                const contact = $scope.contacts.find(c => c.phone === data.phone);
                if (contact) {
                    contact.unreadCount = data.unreadCount;
                    $scope.$apply();
                }
                
                // Update filtered contacts as well
                const filteredContact = $scope.filteredContacts.find(c => c.phone === data.phone);
                if (filteredContact) {
                    filteredContact.unreadCount = data.unreadCount;
                    $scope.$apply();
                }
                
                // Note: Total unread count updates are now handled by Socket.IO 'total-unread-update' events
            });
            
            // Handle disconnection
            $scope.socket.on('disconnect', function() {
                console.log('🔌 Disconnected from server');
            });
        } else {
            console.error('Socket.IO not loaded');
        }
    };

    // Helper function to check if message is valid
    $scope.isMessageValid = function() {
        return $scope.messageInput.text && $scope.messageInput.text.trim().length > 0;
    };

    // Simple test function
    $scope.testClick = function() {
        alert('Angular function called!');
    };

    // Handle window resize
    window.addEventListener('resize', function() {
        $scope.$apply(function() {
            $scope.isMobile = window.innerWidth < 768;
        });
    });

    // Check for phone parameter and fill search box
    $scope.checkAutoSelect = function() {
        console.log('=== CHECKING FOR PHONE PARAMETER ===');
        const urlParams = $location.search();
        const routePhone = $routeParams.phone;
        const phoneParam = urlParams.phone || routePhone;
        
        console.log('Current URL:', $location.url());
        console.log('URL search params:', urlParams);
        console.log('Route params:', $routeParams);
        console.log('Phone parameter found:', phoneParam);
        
        if (phoneParam) {
            console.log('Filling search box with phone number:', phoneParam);
            // Simply fill the search box with the phone number
            $scope.searchQuery = phoneParam;
            $scope.filterContacts();
            console.log('Search box filled successfully');
        } else {
            console.log('No phone parameter found');
        }
        console.log('=== PHONE PARAMETER CHECK COMPLETED ===');
    };

    // Listen for route changes to fill search box
    $scope.$on('$routeChangeSuccess', function(event, current, previous) {
        console.log('Route change detected, checking for phone parameter');
        $scope.checkAutoSelect();
    });

    // Initialize
    $scope.init = function() {
        $scope.checkAutoSelect();
        $scope.initSocket();
        $scope.loadContacts();
        // Auto-refresh contacts every 30 seconds
        $interval($scope.loadContacts, 30000);

        // Watch for text changes to auto-resize textarea
        $scope.$watch('messageInput.text', function(newVal, oldVal) {
            if (newVal !== oldVal) {
                $timeout(function() {
                    const textarea = document.querySelector('textarea[ng-model="messageInput.text"]');
                    if (textarea) {
                        $scope.autoResizeTextarea(textarea);
                    }
                }, 0);
            }
        });
    };

    // Load contacts list
    $scope.loadContacts = function(showLoading = true) {
        if (showLoading) $scope.loadingContacts = true;
        
        $http.get('/api/chat/contacts')
            .then(function(response) {
                $scope.contacts = response.data;
                $scope.filterContacts();
                
                // Just load contacts normally - no auto-selection
                console.log('Contacts loaded successfully:', $scope.contacts.length);
            })
            .catch(function(error) {
                console.error('Error loading contacts:', error);
            })
            .finally(function() {
                $scope.loadingContacts = false;
                $scope.refreshing = false;
            });
    };

    // Filter contacts based on search query
    $scope.filterContacts = function() {
        if (!$scope.searchQuery) {
            $scope.filteredContacts = $scope.contacts;
        } else {
            const query = $scope.searchQuery.toLowerCase();
            $scope.filteredContacts = $scope.contacts.filter(function(contact) {
                const name = $scope.getContactName(contact.phone).toLowerCase();
                const phone = contact.phone.toLowerCase();
                const message = (contact.lastMessage || '').toLowerCase();
                return name.includes(query) || phone.includes(query) || message.includes(query);
            });
        }
    };

    // Watch search query changes
    $scope.$watch('searchQuery', $scope.filterContacts);

    // Clear search box
    $scope.clearSearch = function() {
        $scope.searchQuery = '';
        $scope.filterContacts();
        console.log('Search box cleared');
    };

    // Refresh contacts manually
    $scope.refreshContacts = function() {
        $scope.refreshing = true;
        $scope.loadContacts(false);
    };

    // Select a contact to view messages
    $scope.selectContact = function(contact) {
        // Leave previous chat room if any
        if ($scope.selectedContact && $scope.socket) {
            $scope.socket.emit('leave-chat', $scope.selectedContact.phone);
        }
        
        $scope.selectedContact = contact;
        
        // Join new chat room
        if ($scope.socket && contact) {
            $scope.socket.emit('join-chat', contact.phone);
        }
        
        // Only hide contact list on mobile when selecting a contact
        if ($scope.isMobile) {
            $scope.showContactList = false;
        }
        
        $scope.loadMessages(contact.phone);
        
        // Ensure scroll to bottom after contact selection
        $timeout(function() {
            $scope.scrollToBottom();
        }, 10);
        
        // Mark messages as read for this contact
        if (contact.unreadCount > 0) {
            $scope.markMessagesAsRead(contact.phone);
            
            // Update filtered contacts as well (immediate UI update)
            const filteredContact = $scope.filteredContacts.find(c => c.phone === $scope.selectedContact.phone);
            if (filteredContact) {
                filteredContact.unreadCount = 0;
            }
        }
        
        // Set up scroll detection for Load Earlier Messages button
        $scope.setupScrollDetection();
    };

    // Setup scroll detection for Load Earlier Messages button
    $scope.setupScrollDetection = function() {
        $timeout(function() {
            const messagesContainer = document.getElementById('messagesContainer');
            if (messagesContainer) {
                // Remove any existing scroll listener
                messagesContainer.removeEventListener('scroll', $scope.handleScroll);
                
                // Add new scroll listener
                messagesContainer.addEventListener('scroll', $scope.handleScroll);
            }
        }, 100);
    };

    // Handle scroll events to show/hide Load Earlier Messages button
    $scope.handleScroll = function() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            // Check if scrolled to top (within 10px threshold)
            const isAtTop = messagesContainer.scrollTop <= 10;
            
            if (isAtTop !== $scope.showLoadEarlierButton) {
                $scope.$apply(function() {
                    $scope.showLoadEarlierButton = isAtTop;
                });
            }
        }
    };

    // Check if should show Load Earlier Messages button
    $scope.shouldShowLoadEarlierButton = function() {
        // Show button if no messages or if scrolled to top
        return !$scope.messages || $scope.messages.length === 0 || $scope.showLoadEarlierButton;
    };

    // Mark messages as read for a phone number
    $scope.markMessagesAsRead = function(phone) {
        $http.post('/api/chat/read/' + encodeURIComponent(phone))
            .then(function(response) {
                console.log('Messages marked as read for', phone);
                
                // Update the contact's unread count to 0 in the contacts list
                const contact = $scope.contacts.find(c => c.phone === phone);
                if (contact) {
                    contact.unreadCount = 0;
                }
                
                // Update filtered contacts as well
                const filteredContact = $scope.filteredContacts.find(c => c.phone === phone);
                if (filteredContact) {
                    filteredContact.unreadCount = 0;
                }
                
                // Note: Total unread count updates are now handled by Socket.IO 'total-unread-update' events
            })
            .catch(function(error) {
                console.error('Error marking messages as read:', error);
            });
    };

    // Back to contact list (mobile)
    $scope.backToContactList = function() {
        $scope.showContactList = true;
        // Don't clear selectedContact on desktop
        if ($scope.isMobile) {
            $scope.selectedContact = null;
        }
    };

    // Load messages for selected contact
    $scope.loadMessages = function(phone, showLoading = true) {
        console.log('=== LOADING MESSAGES ===');
        console.log('Loading messages for phone:', phone);
        console.log('Show loading:', showLoading);
        
        if (showLoading) $scope.loadingMessages = true;
        
        $http.get('/api/chat/messages/' + encodeURIComponent(phone))
            .then(function(response) {
                $scope.messages = response.data;
                console.log('Messages loaded successfully:', $scope.messages.length, 'messages');
                console.log('Messages:', $scope.messages);
                
                // Scroll to bottom after messages load
                $timeout(function() {
                    $scope.scrollToBottom();
                }, 20);
            })
            .catch(function(error) {
                console.error('Error loading messages:', error);
                $scope.messages = [];
            })
            .finally(function() {
                $scope.loadingMessages = false;
                $scope.refreshingMessages = false;
                console.log('=== MESSAGES LOADING COMPLETED ===');
            });
    };

    // Refresh messages manually
    $scope.refreshMessages = function() {
        if ($scope.selectedContact) {
            $scope.refreshingMessages = true;
            $scope.loadMessages($scope.selectedContact.phone, false);
        }
    };

    // Send message
    $scope.sendMessage = function() {
        console.log('SendMessage function called!');
        if (!$scope.messageInput.text || !$scope.messageInput.text.trim() || !$scope.selectedContact || $scope.sending) {
            console.log('Validation failed:', { 
                messageText: $scope.messageInput.text, 
                selectedContact: $scope.selectedContact, 
                sending: $scope.sending 
            });
            return;
        }

        $scope.sending = true;
        const messageText = $scope.messageInput.text.trim();
        const phone = $scope.selectedContact.phone;

        $http.post('/api/chat/send', {
            phone: phone,
            message: messageText
        })
        .then(function(response) {
            // Add message to local array immediately for better UX
            const newMessage = {
                id: 'temp_' + Date.now(),
                phone: phone,
                text: messageText,
                type: 'outgoing',
                timestamp: new Date().toISOString()
            };
            $scope.messages.push(newMessage);
            
            // Clear input
            $scope.messageInput.text = '';
            
            // Reset textarea height
            $scope.resetTextareaHeight();
            
            // Scroll to bottom
            setTimeout(function() {
                $scope.scrollToBottom();
            }, 50);
            
            // Refresh messages to get the actual saved message
            setTimeout(function() {
                $scope.loadMessages(phone, false);
            }, 1000);
        })
        .catch(function(error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        })
        .finally(function() {
            $scope.sending = false;
        });
    };

    // Handle keyboard events in message input
    $scope.handleKeyPress = function(event) {
        // Send on Enter (but allow Shift+Enter for new line)
        if (event.keyCode === 13 && !event.shiftKey) {
            event.preventDefault();
            $scope.sendMessage();
        }
        // Also send on Ctrl+Enter or Cmd+Enter
        if ((event.ctrlKey || event.metaKey) && event.keyCode === 13) {
            event.preventDefault();
            $scope.sendMessage();
        }
        
        // Auto-resize textarea
        $scope.autoResizeTextarea(event.target);
    };

    // Auto-resize textarea based on content
    $scope.autoResizeTextarea = function(element) {
        // Reset height to get accurate scrollHeight
        element.style.height = '36px';
        
        // Set height based on scroll height, with min and max limits
        const minHeight = 36;
        const maxHeight = 120;
        const scrollHeight = element.scrollHeight;
        
        if (scrollHeight > minHeight) {
            const newHeight = Math.min(scrollHeight, maxHeight);
            element.style.height = newHeight + 'px';
            
            // Also update parent container min-height to match
            const parentContainer = element.closest('.min-h-\\[40px\\]');
            if (parentContainer) {
                parentContainer.style.minHeight = (newHeight + 8) + 'px'; // Add padding
            }
        }
    };

    // Handle input events for auto-resize (covers typing, pasting, etc.)
    $scope.handleInput = function(event) {
        if (event && event.target) {
            $scope.autoResizeTextarea(event.target);
        }
    };

    // Handle text model changes for auto-resize
    $scope.handleTextChange = function() {
        $timeout(function() {
            const textarea = document.querySelector('textarea[ng-model="messageInput.text"]');
            if (textarea) {
                $scope.autoResizeTextarea(textarea);
            }
        }, 0);
    };

    // Reset textarea height to original size
    $scope.resetTextareaHeight = function() {
        // Use timeout to ensure the input is cleared first
        $timeout(function() {
            const textarea = document.querySelector('textarea[ng-model="messageInput.text"]');
            if (textarea) {
                textarea.style.height = '36px';
                
                // Reset parent container min-height
                const parentContainer = textarea.closest('.min-h-\\[40px\\]');
                if (parentContainer) {
                    parentContainer.style.minHeight = '40px';
                }
            }
        }, 0);
    };

    // Get contact name (or format phone number)
    $scope.getContactName = function(phone) {
        if (!phone) return 'Unknown';
        
        // First check if we have a contact with this phone number
        const contact = $scope.contacts.find(c => c.phone === phone);
        if (contact && contact.name && contact.name !== contact.phone) {
            return contact.name;
        }
        
        // Fallback to formatted phone number
        let formatted = phone.replace(/^\+?1?/, '');
        if (formatted.length === 10) {
            return `(${formatted.substr(0,3)}) ${formatted.substr(3,3)}-${formatted.substr(6,4)}`;
        }
        return phone;
    };

    // Get contact initials for avatar
    $scope.getContactInitials = function(phone) {
        if (!phone) return '?';
        
        const name = $scope.getContactName(phone);
        const parts = name.split(/[\s\-\(\)]+/).filter(p => p.length > 0);
        
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (parts.length === 1 && parts[0].length >= 2) {
            return parts[0].substr(0, 2).toUpperCase();
        }
        
        return phone.substr(-2);
    };

    // Format timestamp for display
    $scope.formatTime = function(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Less than 1 minute
        if (diff < 60000) {
            return 'now';
        }
        
        // Less than 1 hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return minutes + 'm';
        }
        
        // Same day - show time only
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        }
        
        // Yesterday - show Yesterday with time
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        }
        
        // This week - show day name with time
        if (diff < 604800000) { // 7 days
            return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        }
        
        // Older - show date with time
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    // Scroll messages container to bottom - instant and silent
    $scope.scrollToBottom = function() {
        const container = document.getElementById('messagesContainer');
        if (container) {
            // Set scroll position instantly without any animation or delay
            container.style.scrollBehavior = 'auto'; // Disable smooth scrolling
            container.scrollTop = container.scrollHeight;
        }
    };

    // Auto-resize textarea
    $scope.$watch('newMessage', function() {
        setTimeout(function() {
            const textarea = document.querySelector('textarea');
            if (textarea) {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
            }
        }, 0);
    });

    // Show delete chat confirmation modal
    $scope.showDeleteChatModal = function() {
        if (!$scope.selectedContact) return;
        $scope.showDeleteModal = true;
    };

    // Close delete modal
    $scope.closeDeleteModal = function() {
        $scope.showDeleteModal = false;
        $scope.deletingChat = false;
    };

    // Confirm delete chat history
    $scope.confirmDeleteChat = function() {
        if (!$scope.selectedContact) return;
        
        $scope.deletingChat = true;
        
        $http.delete('/api/chat/history/' + encodeURIComponent($scope.selectedContact.phone))
            .then(function(response) {
                console.log('Chat history deleted successfully');
                
                // Clear messages for current conversation
                $scope.messages = [];
                
                // Update the contact in contacts list to show empty chat history
                const contactIndex = $scope.contacts.findIndex(c => c.phone === $scope.selectedContact.phone);
                if (contactIndex !== -1) {
                    // Keep the contact but clear its message data
                    $scope.contacts[contactIndex].lastMessage = '';
                    $scope.contacts[contactIndex].lastMessageType = '';
                    $scope.contacts[contactIndex].unreadCount = 0;
                    $scope.contacts[contactIndex].timestamp = new Date().toISOString();
                    $scope.filterContacts();
                }
                
                // Close modal but keep contact selected
                $scope.closeDeleteModal();
                
                // Show success toast message
                $scope.showToast('Chat history deleted successfully', 'success');
                
            })
            .catch(function(error) {
                console.error('Error deleting chat history:', error);
                $scope.deletingChat = false;
                $scope.showToast('Failed to delete chat history. Please try again.', 'error');
            });
    };

    // AI Toggle functionality
    $scope.contactAIStatus = {}; // Store AI status for each contact
    $scope.togglingAI = false;
    
    // Check AI status for selected contact
    $scope.checkContactAIStatus = function(phone) {
        if (!phone) return;
        
        // Initialize with loading state to prevent disabled button
        if (!$scope.contactAIStatus[phone]) {
            $scope.contactAIStatus[phone] = {
                enabled: true, // Default to enabled while loading
                agentsCount: 0,
                loading: true
            };
        }
        
        $http.get('/api/ai-agents/check-contact-ai/' + phone)
            .then(function(response) {
                $scope.contactAIStatus[phone] = {
                    enabled: response.data.aiEnabled,
                    agentsCount: response.data.agentsCount,
                    loading: false
                };
                console.log('AI status for ' + phone + ':', response.data);
            })
            .catch(function(error) {
                console.error('Error checking AI status:', error);
                // On error, default to enabled
                $scope.contactAIStatus[phone] = {
                    enabled: true,
                    agentsCount: 0,
                    loading: false,
                    error: true
                };
            });
    };
    
    // Toggle AI for contact
    $scope.toggleContactAI = function() {
        console.log('=== Toggle AI called ===');
        
        if (!$scope.selectedContact) {
            console.error('No contact selected');
            $scope.showToast('❌ Please select a contact first', 'error');
            return;
        }
        
        if ($scope.togglingAI) {
            console.log('Already toggling, please wait...');
            return;
        }
        
        const phone = $scope.selectedContact.phone;
        const currentStatus = $scope.contactAIStatus[phone];
        
        console.log('Current status:', currentStatus);
        
        // If status not loaded yet or still loading, wait
        if (!currentStatus || currentStatus.loading) {
            console.log('AI status still loading, please wait...');
            $scope.showToast('⏳ Loading AI status, please wait...', 'info');
            return;
        }
        
        const newStatus = !currentStatus.enabled;
        console.log('Toggling from', currentStatus.enabled, 'to', newStatus);
        
        $scope.togglingAI = true;
        
        $http.post('/api/ai-agents/toggle-contact-ai', {
            phone: phone,
            enabled: newStatus
        })
            .then(function(response) {
                console.log('✅ AI toggle response:', response.data);
                
                // Update local status
                $scope.contactAIStatus[phone].enabled = newStatus;
                
                // Show success message with clearer wording
                const message = newStatus ? 
                    '✅ AI Enabled - Will respond to this contact' : 
                    '🔴 AI Disabled - Will ignore this contact';
                $scope.showToast(message, 'success');
            })
            .catch(function(error) {
                console.error('❌ Error toggling AI:', error);
                console.error('Error details:', error.data);
                console.error('Error status:', error.status);
                
                let errorMsg = '❌ Failed to toggle AI. ';
                if (error.status === 401) {
                    errorMsg += 'Please login again.';
                } else if (error.status === 404) {
                    errorMsg += 'No AI agents found.';
                } else if (error.data && error.data.error) {
                    errorMsg += error.data.error;
                } else {
                    errorMsg += 'Please try again.';
                }
                
                $scope.showToast(errorMsg, 'error');
            })
            .finally(function() {
                $scope.togglingAI = false;
                console.log('=== Toggle AI finished ===');
            });
    };
    
    // Get AI status for selected contact
    $scope.getContactAIStatus = function() {
        if (!$scope.selectedContact) return null;
        return $scope.contactAIStatus[$scope.selectedContact.phone];
    };

    // Initialize on load
    $scope.init();

    // Watch messages array and auto-scroll to bottom when messages change
    $scope.$watchCollection('messages', function(newMessages, oldMessages) {
        if (newMessages && newMessages.length > 0 && $scope.selectedContact) {
            // Only scroll if messages were added (not on initial load which is handled separately)
            if (oldMessages && newMessages.length > oldMessages.length) {
                $scope.scrollToBottom(); // Instant scroll without timeout
            }
        }
    });

    // Ensure scroll to bottom when selectedContact changes
    $scope.$watch('selectedContact', function(newContact, oldContact) {
        if (newContact && newContact !== oldContact) {
            $scope.scrollToBottom(); // Instant scroll without timeout
            
            // Check AI status when contact is selected
            if (newContact) {
                $scope.checkContactAIStatus(newContact.phone);
            }
        }
    });

    // Cleanup scroll listeners when scope is destroyed
    $scope.$on('$destroy', function() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.removeEventListener('scroll', $scope.handleScroll);
        }
    });
}]);
