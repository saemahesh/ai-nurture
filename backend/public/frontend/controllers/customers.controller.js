angular.module('autopostWaApp').controller('CustomersController', ['$scope', '$http', function($scope, $http) {
    $scope.customers = [];
    $scope.filteredCustomers = [];
    $scope.loading = true;
    $scope.search = {
        query: ''
    };
    $scope.showEditModal = false;
    $scope.currentCustomer = {};

    // Notification system
    $scope.notifications = [];

    // Show notification
    $scope.showNotification = function(message, type = 'info') {
        const notification = {
            id: Date.now(),
            message: message,
            type: type // 'success', 'error', 'warning', 'info'
        };

        $scope.notifications.push(notification);

        // Auto-remove after 5 seconds
        setTimeout(function() {
            $scope.removeNotification(notification.id);
            $scope.$apply();
        }, 5000);
    };

    // Remove notification
    $scope.removeNotification = function(notificationId) {
        $scope.notifications = $scope.notifications.filter(function(n) {
            return n.id !== notificationId;
        });
    };

    // Load customers
    $scope.loadCustomers = function() {
        $scope.loading = true;
        $http.get('/api/customers')
            .then(function(response) {
                $scope.customers = response.data;
                $scope.filterCustomers();
            })
            .catch(function(error) {
                console.error('Error loading customers:', error);
                $scope.showNotification('Error loading customers. Please try again.', 'error');
            })
            .finally(function() {
                $scope.loading = false;
            });
    };

    // Filter customers
    $scope.filterCustomers = function() {
        $scope.filteredCustomers = $scope.customers.filter(function(customer) {
            let matchesSearch = true;
            if ($scope.search.query) {
                const query = $scope.search.query.toLowerCase();
                matchesSearch = (customer.name && customer.name.toLowerCase().includes(query)) ||
                                (customer.phone && customer.phone.includes(query)) ||
                                (customer.tags && customer.tags.join(' ').toLowerCase().includes(query));
            }
            return matchesSearch;
        });
    };

    $scope.$watch('search.query', $scope.filterCustomers);

    // Format date
    $scope.formatDate = function(dateString) {
        if (!dateString) return '';
        if (typeof moment === 'function' && typeof moment.tz === 'function') {
            return moment(dateString).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mm A');
        } else {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    };

    // Edit customer modal
    $scope.openEditModal = function(customer) {
        $scope.currentCustomer = angular.copy(customer);
        if (Array.isArray($scope.currentCustomer.tags)) {
            $scope.currentCustomer.tags = $scope.currentCustomer.tags.join(',');
        }
        $scope.showEditModal = true;
    };

    $scope.closeEditModal = function() {
        $scope.showEditModal = false;
    };

    $scope.updateCustomer = function() {
        const customerData = angular.copy($scope.currentCustomer);
        if (typeof customerData.tags === 'string') {
            customerData.tags = customerData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        }

        $http.put('/api/customers/' + customerData.id, customerData)
            .then(function(response) {
                $scope.showNotification('Customer updated successfully!', 'success');
                $scope.loadCustomers();
                $scope.closeEditModal();
            })
            .catch(function(error) {
                console.error('Error updating customer:', error);
                const errorMessage = error.data?.error || 'Please try again.';
                $scope.showNotification('Error updating customer: ' + errorMessage, 'error');
            });
    };

    // Initialize
    $scope.loadCustomers();
}]);
