angular.module('autopostWaApp').controller('ChatController', ['$scope', '$http', '$interval', function($scope, $http, $interval) {
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
        $scope.selectedContact = contact;
        // Only hide contact list on mobile when selecting a contact
        if ($scope.isMobile) {
            $scope.showContactList = false;
        }
        $scope.loadMessages(contact.phone);
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
        
        // Same day
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        }
        
        // Yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }
        
        // This week
        if (diff < 604800000) { // 7 days
            return date.toLocaleDateString([], { weekday: 'short' });
        }
        
        // Older
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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

    // Initialize on load
    $scope.init();
}]);
