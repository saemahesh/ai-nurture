angular.module('autopostWaApp').controller('CustomersController', ['$scope', '$http', '$location', '$timeout', function($scope, $http, $location, $timeout) {
    // Initialize scope variables
    $scope.customers = [];
    $scope.filteredCustomers = [];
    $scope.analytics = null;
    $scope.loading = true;
    
    // Search and filter
    $scope.search = {
        query: '',
        type: '',
        tags: ''
    };
    
    // Modal states - EXPLICITLY ENSURE THEY ARE FALSE
    $scope.showCustomerModal = false;
    $scope.showConvertModal = false;
    $scope.customerModalMode = 'create'; // 'create' or 'edit'
    $scope.currentCustomer = null;
    $scope.saving = false;
    $scope.converting = false;
    
    // Form data
    $scope.customerForm = {
        name: '',
        phone: '',
        designation: '',
        business: '',
        servicesNeeded: '',
        productsInterested: '',
        tagsInput: '',
        notes: ''
    };
    
    $scope.convertForm = {
        productsInput: ''
    };
    
    // Notification system
    $scope.notifications = [];
    $scope.showConfirmModal = false;
    $scope.confirmModal = {
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: null,
        onCancel: null
    };

    // Initialize
    $scope.init = function() {
        // Forcefully ensure modal is closed
        $scope.showCustomerModal = false;
        $scope.showConvertModal = false;
        $scope.showConfirmModal = false;
        
        // Reset any modal states
        $scope.customerModalMode = 'create';
        $scope.currentCustomer = null;
        $scope.saving = false;
        $scope.converting = false;
        
        // Use timeout to ensure modal stays closed
        $timeout(function() {
            $scope.showCustomerModal = false;
            $scope.showConvertModal = false;
        }, 100);
        
        $scope.loadCustomers();
        $scope.loadAnalytics();
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

    // Load analytics
    $scope.loadAnalytics = function() {
        $http.get('/api/customers/analytics/summary')
            .then(function(response) {
                $scope.analytics = response.data;
            })
            .catch(function(error) {
                console.error('Error loading analytics:', error);
            });
    };

    // Filter customers
    $scope.filterCustomers = function() {
        let params = {};
        
        if ($scope.search.query) {
            params.search = $scope.search.query;
        }
        
        if ($scope.search.type) {
            params.type = $scope.search.type;
        }
        
        if ($scope.search.tags) {
            params.tags = $scope.search.tags;
        }

        $http.get('/api/customers', { params: params })
            .then(function(response) {
                $scope.filteredCustomers = response.data;
            })
            .catch(function(error) {
                console.error('Error filtering customers:', error);
                $scope.filteredCustomers = $scope.customers;
            });
    };

    // Show notification
    $scope.showNotification = function(message, type) {
        const notification = {
            id: Date.now(),
            message: message,
            type: type || 'info'
        };
        $scope.notifications.push(notification);
        
        // Auto remove after 5 seconds
        setTimeout(function() {
            $scope.removeNotification(notification);
            $scope.$apply();
        }, 5000);
    };

    // Remove notification
    $scope.removeNotification = function(notification) {
        const index = $scope.notifications.indexOf(notification);
        if (index > -1) {
            $scope.notifications.splice(index, 1);
        }
    };

    // Show confirmation modal
    $scope.showConfirmation = function(title, message, onConfirm, onCancel) {
        $scope.confirmModal = {
            title: title,
            message: message,
            onConfirm: onConfirm,
            onCancel: onCancel
        };
        $scope.showConfirmModal = true;
    };

    // Close confirmation modal
    $scope.closeConfirmModal = function() {
        $scope.showConfirmModal = false;
        $scope.confirmModal = {
            title: '',
            message: '',
            onConfirm: null,
            onCancel: null
        };
    };

    // Open create customer modal
    $scope.openCreateCustomerModal = function() {
        $scope.customerModalMode = 'create';
        $scope.currentCustomer = null;
        $scope.resetCustomerForm();
        $scope.showCustomerModal = true;
    };

    // Edit customer
    $scope.editCustomer = function(customer) {
        $scope.customerModalMode = 'edit';
        $scope.currentCustomer = customer;
        $scope.customerForm = {
            name: customer.name || '',
            phone: customer.phone || '',
            designation: customer.designation || '',
            business: customer.business || '',
            servicesNeeded: customer.servicesNeeded || '',
            productsInterested: customer.productsInterested || '',
            tagsInput: customer.tags ? customer.tags.join(', ') : '',
            notes: customer.notes || ''
        };
        $scope.showCustomerModal = true;
    };

    // Reset customer form
    $scope.resetCustomerForm = function() {
        $scope.customerForm = {
            name: '',
            phone: '',
            designation: '',
            business: '',
            servicesNeeded: '',
            productsInterested: '',
            tagsInput: '',
            notes: ''
        };
    };

    // Close customer modal
    $scope.closeCustomerModal = function() {
        $scope.showCustomerModal = false;
        $scope.currentCustomer = null;
        $scope.resetCustomerForm();
        $scope.saving = false;
    };

    // Save customer (create or update)
    $scope.saveCustomer = function() {
        if (!$scope.customerForm.phone) {
            $scope.showNotification('Phone number is required', 'error');
            return;
        }

        $scope.saving = true;

        const customerData = {
            name: $scope.customerForm.name,
            designation: $scope.customerForm.designation,
            business: $scope.customerForm.business,
            servicesNeeded: $scope.customerForm.servicesNeeded,
            productsInterested: $scope.customerForm.productsInterested,
            notes: $scope.customerForm.notes
        };

        // Parse tags
        let tags = [];
        if ($scope.customerForm.tagsInput) {
            tags = $scope.customerForm.tagsInput.split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
        }

        let request;
        if ($scope.customerModalMode === 'create') {
            customerData.phone = $scope.customerForm.phone;
            customerData.tags = tags;
            request = $http.post('/api/customers', customerData);
        } else {
            request = $http.put('/api/customers/' + $scope.currentCustomer.id, customerData);
        }

        request.then(function(response) {
            $scope.showNotification(
                $scope.customerModalMode === 'create' ? 'Customer added successfully' : 'Customer updated successfully', 
                'success'
            );
            
            // If editing and tags changed, update tags separately
            if ($scope.customerModalMode === 'edit' && tags.length > 0) {
                $scope.updateCustomerTags($scope.currentCustomer.id, tags);
            }
            
            $scope.loadCustomers();
            $scope.loadAnalytics();
            $scope.closeCustomerModal();
        })
        .catch(function(error) {
            console.error('Error saving customer:', error);
            const errorMessage = error.data?.error || 'Failed to save customer';
            $scope.showNotification(errorMessage, 'error');
        })
        .finally(function() {
            $scope.saving = false;
        });
    };

    // Update customer tags
    $scope.updateCustomerTags = function(customerId, tags) {
        // First remove all existing tags, then add new ones
        const customer = $scope.customers.find(c => c.id === customerId);
        if (customer && customer.tags.length > 0) {
            $http.delete('/api/customers/' + customerId + '/tags', { data: { tags: customer.tags } })
                .then(function() {
                    if (tags.length > 0) {
                        return $http.post('/api/customers/' + customerId + '/tags', { tags: tags });
                    }
                })
                .then(function() {
                    $scope.loadCustomers();
                })
                .catch(function(error) {
                    console.error('Error updating tags:', error);
                });
        } else if (tags.length > 0) {
            $http.post('/api/customers/' + customerId + '/tags', { tags: tags })
                .then(function() {
                    $scope.loadCustomers();
                })
                .catch(function(error) {
                    console.error('Error adding tags:', error);
                });
        }
    };

    // Convert to paid customer
    $scope.convertToCustomer = function(customer) {
        $scope.currentCustomer = customer;
        $scope.convertForm = {
            productsInput: ''
        };
        $scope.showConvertModal = true;
    };

    // Close convert modal
    $scope.closeConvertModal = function() {
        $scope.showConvertModal = false;
        $scope.currentCustomer = null;
        $scope.convertForm = {
            productsInput: ''
        };
        $scope.converting = false;
    };

    // Confirm conversion
    $scope.confirmConversion = function() {
        if (!$scope.convertForm.productsInput) {
            $scope.showNotification('Products/services are required for conversion', 'error');
            return;
        }

        $scope.converting = true;

        const products = $scope.convertForm.productsInput.split(',')
            .map(product => product.trim())
            .filter(product => product.length > 0);

        $http.post('/api/customers/' + $scope.currentCustomer.id + '/convert', { products: products })
            .then(function(response) {
                $scope.showNotification('Customer converted to paid customer successfully!', 'success');
                $scope.loadCustomers();
                $scope.loadAnalytics();
                $scope.closeConvertModal();
            })
            .catch(function(error) {
                console.error('Error converting customer:', error);
                const errorMessage = error.data?.error || 'Failed to convert customer';
                $scope.showNotification(errorMessage, 'error');
            })
            .finally(function() {
                $scope.converting = false;
            });
    };

    // Setup follow-up
    $scope.setupFollowUp = function(customer) {
        $http.post('/api/customers/' + customer.id + '/follow-up')
            .then(function(response) {
                if (response.data.redirectUrl) {
                    $location.path('/direct-schedule').search({
                        phone: customer.phone,
                        name: customer.name || ''
                    });
                }
            })
            .catch(function(error) {
                console.error('Error setting up follow-up:', error);
                $scope.showNotification('Error setting up follow-up. Please try again.', 'error');
            });
    };

    // Delete customer
    $scope.deleteCustomer = function(customer) {
        $scope.showConfirmation(
            'Delete Customer',
            'Are you sure you want to permanently delete this customer? This action cannot be undone.',
            function() {
                $http.delete('/api/customers/' + customer.id)
                    .then(function(response) {
                        $scope.showNotification('Customer deleted successfully', 'success');
                        $scope.loadCustomers();
                        $scope.loadAnalytics();
                    })
                    .catch(function(error) {
                        console.error('Error deleting customer:', error);
                        const errorMessage = error.data?.error || 'Failed to delete customer';
                        $scope.showNotification(errorMessage, 'error');
                    });
            }
        );
    };

    // Export customers
    $scope.exportCustomers = function() {
        const csvContent = $scope.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'customers_' + new Date().toISOString().split('T')[0] + '.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Generate CSV content
    $scope.generateCSV = function() {
        const headers = ['Name', 'Phone', 'Type', 'Designation', 'Business', 'Services Needed', 'Products Interested', 'Tags', 'Notes', 'Created At', 'Converted At'];
        const rows = $scope.customers.map(function(customer) {
            return [
                customer.name || '',
                customer.phone,
                customer.type === 'paid_customer' ? 'Paid Customer' : 'Lead',
                customer.designation || '',
                customer.business || '',
                customer.servicesNeeded || '',
                customer.productsInterested || '',
                customer.tags ? customer.tags.join('; ') : '',
                customer.notes || '',
                $scope.formatDate(customer.created_at),
                customer.convertedAt ? $scope.formatDate(customer.convertedAt) : ''
            ];
        });

        return [headers, ...rows].map(function(row) {
            return row.map(function(field) {
                return '"' + String(field).replace(/"/g, '""') + '"';
            }).join(',');
        }).join('\n');
    };

    // Get initials for avatar
    $scope.getInitials = function(name) {
        if (!name) return '?';
        return name.split(' ')
            .map(part => part.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    // Format date
    $scope.formatDate = function(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Go back to dashboard
    $scope.goBack = function() {
        $location.path('/dashboard');
    };

    // Initialize the controller
    $scope.init();
}]);
