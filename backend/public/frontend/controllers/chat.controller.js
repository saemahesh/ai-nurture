angular.module('autopostWaApp').controller('ChatController', ['$scope', '$http', '$interval', '$location', '$timeout', function($scope, $http, $interval, $location, $timeout) {
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

    // Initialize
    $scope.init = function() {
        $scope.initSocket();
        $scope.loadContacts();
        // Auto-refresh contacts every 30 seconds
        $interval($scope.loadContacts, 30000);
    };

    // Load contacts list
    $scope.loadContacts = function(showLoading = true) {
        if (showLoading) $scope.loadingContacts = true;
        
        $http.get('/api/chat/contacts')
            .then(function(response) {
                $scope.contacts = response.data;
                $scope.filterContacts();
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
        if (showLoading) $scope.loadingMessages = true;
        
        $http.get('/api/chat/messages/' + encodeURIComponent(phone))
            .then(function(response) {
                $scope.messages = response.data;
                // Scroll to bottom after messages load
                setTimeout(function() {
                    $scope.scrollToBottom();
                }, 100);
            })
            .catch(function(error) {
                console.error('Error loading messages:', error);
                $scope.messages = [];
            })
            .finally(function() {
                $scope.loadingMessages = false;
                $scope.refreshingMessages = false;
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

    // Scroll messages container to bottom
    $scope.scrollToBottom = function() {
        const container = document.getElementById('messagesContainer');
        if (container) {
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

    // Initialize on load
    $scope.init();

    // Cleanup scroll listeners when scope is destroyed
    $scope.$on('$destroy', function() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.removeEventListener('scroll', $scope.handleScroll);
        }
    });
}]);
