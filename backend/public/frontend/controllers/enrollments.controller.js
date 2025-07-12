angular.module('autopostWaApp').controller('EnrollmentsController', ['$scope', '$http', '$location', '$routeParams', function($scope, $http, $location, $routeParams) {
    $scope.sequenceId = $routeParams.sequenceId;
    $scope.sequence = {};
    $scope.enrollments = [];
    $scope.filteredEnrollments = [];
    $scope.stats = {
        total: 0,
        active: 0,
        completed: 0,
        stopped: 0
    };
    $scope.loading = true;
    $scope.search = {
        query: '',
        status: ''
    };
    
    // Modal states
    $scope.showEnrollModal = false;
    $scope.enrollTab = 'single';
    $scope.enrolling = false;
    $scope.uploading = false;
    
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
    
    // Show confirmation modal
    $scope.showConfirmation = function(title, message, onConfirm, onCancel = null, confirmText = 'Confirm', cancelText = 'Cancel') {
        $scope.confirmModal = {
            title: title,
            message: message,
            confirmText: confirmText,
            cancelText: cancelText,
            onConfirm: onConfirm,
            onCancel: onCancel
        };
        $scope.showConfirmModal = true;
    };
    
    // Handle confirmation
    $scope.handleConfirm = function() {
        if ($scope.confirmModal.onConfirm) {
            $scope.confirmModal.onConfirm();
        }
        $scope.showConfirmModal = false;
    };
    
    // Handle cancel
    $scope.handleCancel = function() {
        if ($scope.confirmModal.onCancel) {
            $scope.confirmModal.onCancel();
        }
        $scope.showConfirmModal = false;
    };
    
    // Open modal function
    $scope.openEnrollModal = function() {
        $scope.showEnrollModal = true;
        $scope.enrollTab = 'single'; // Ensure tab is set to single
        // Reset form data
        $scope.singleLead = {
            name: '',
            phone: '',
            additionalData: ''
        };
        $scope.csvFile = null;
    };
    
    // Close modal function
    $scope.closeEnrollModal = function() {
        $scope.showEnrollModal = false;
        $scope.enrollTab = 'single';
        // Reset form data
        $scope.singleLead = {
            name: '',
            phone: '',
            additionalData: ''
        };
        $scope.csvFile = null;
    };
    
    // Form data
    $scope.singleLead = {
        name: '',
        phone: '',
        additionalData: ''
    };
    $scope.csvFile = null;

    // Initialize
    $scope.init = function() {
        $scope.loadSequence();
        $scope.loadEnrollments();
    };

    // Load sequence details
    $scope.loadSequence = function() {
        $http.get('/api/sequences/' + $scope.sequenceId)
            .then(function(response) {
                $scope.sequence = response.data;
            })
            .catch(function(error) {
                console.error('Error loading sequence:', error);
                $scope.showNotification('Error loading sequence. Redirecting to sequences list.', 'error');
                $location.path('/sequences');
            });
    };

    // Load enrollments
    $scope.loadEnrollments = function() {
        $scope.loading = true;
        $http.get('/api/enrollments?sequenceId=' + $scope.sequenceId)
            .then(function(response) {
                $scope.enrollments = response.data;
                $scope.calculateStats();
                $scope.filterEnrollments();
            })
            .catch(function(error) {
                console.error('Error loading enrollments:', error);
                $scope.showNotification('Error loading enrollments. Please try again.', 'error');
            })
            .finally(function() {
                $scope.loading = false;
            });
    };

    // Calculate statistics
    $scope.calculateStats = function() {
        $scope.stats = {
            total: $scope.enrollments.length,
            active: 0,
            completed: 0,
            stopped: 0,
            paused: 0
        };

        $scope.enrollments.forEach(function(enrollment) {
            if ($scope.stats[enrollment.status] !== undefined) {
                $scope.stats[enrollment.status]++;
            }
        });
    };

    // Filter enrollments based on search and status
    $scope.filterEnrollments = function() {
        $scope.filteredEnrollments = $scope.enrollments.filter(function(enrollment) {
            let matchesSearch = true;
            let matchesStatus = true;

            // Search filter
            if ($scope.search.query) {
                const query = $scope.search.query.toLowerCase();
                matchesSearch = (enrollment.name && enrollment.name.toLowerCase().includes(query)) ||
                               (enrollment.phone && enrollment.phone.includes(query));
            }

            // Status filter
            if ($scope.search.status) {
                matchesStatus = enrollment.status === $scope.search.status;
            }

            return matchesSearch && matchesStatus;
        });
    };

    // Watch search inputs
    $scope.$watch('search.query', $scope.filterEnrollments);
    $scope.$watch('search.status', $scope.filterEnrollments);
    
    // Get initials for avatar
    $scope.getInitials = function(name) {
        if (!name) return '?';
        return name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().substring(0, 2);
    };

    // Get next message day
    $scope.getNextMessageDay = function(enrollment) {
        if (enrollment.status === 'completed' || !$scope.sequence.messages || $scope.sequence.messages.length === 0) {
            return 'Completed';
        }
        if (enrollment.status !== 'active' || !enrollment.next_message_due) {
            return '-';
        }
        // Ensure current_day is within bounds and sequence messages are available
        if (enrollment.current_day >= 0 && enrollment.current_day < $scope.sequence.messages.length) {
            const nextMessage = $scope.sequence.messages[enrollment.current_day];
            if (nextMessage && nextMessage.day) {
                return 'Day ' + nextMessage.day;
            }
        }
        // Fallback if data is inconsistent
        return 'Next';
    };

    // Format date
    $scope.formatDate = function(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Enroll single lead
    $scope.enrollSingleLead = function() {
        if (!$scope.singleLead.phone) {
            $scope.showNotification('Phone number is required', 'warning');
            return;
        }

        $scope.enrolling = true;

        const leadData = {
            phone: $scope.singleLead.phone,
            name: $scope.singleLead.name || ''
        };

        $http.post('/api/enrollments/' + $scope.sequenceId + '/enroll', leadData)
            .then(function(response) {
                $scope.showNotification('Lead enrolled successfully!', 'success');
                $scope.loadEnrollments();
                $scope.closeEnrollModal();
            })
            .catch(function(error) {
                console.error('Error enrolling lead:', error);
                const errorMessage = error.data?.error || error.data?.message || 'Please try again.';
                $scope.showNotification('Error enrolling lead: ' + errorMessage, 'error');
            })
            .finally(function() {
                $scope.enrolling = false;
            });
    };

    // Reset single lead form
    $scope.resetSingleLeadForm = function() {
        $scope.singleLead = {
            name: '',
            phone: '',
            additionalData: ''
        };
    };

    // Upload CSV
    $scope.uploadCSV = function() {
        console.log('Upload CSV called, csvFile:', $scope.csvFile); // Debug log
        
        if (!$scope.csvFile) {
            $scope.showNotification('Please select a CSV file', 'warning');
            return;
        }

        $scope.uploading = true;

        const formData = new FormData();
        formData.append('csvFile', $scope.csvFile);
        formData.append('sequenceId', $scope.sequenceId);

        $http.post('/api/enrollments/' + $scope.sequenceId + '/enroll/csv', formData, {
            transformRequest: angular.identity,
            headers: {'Content-Type': undefined}
        })
        .then(function(response) {
            console.log('CSV upload response:', response.data);
            
            const data = response.data;
            const enrolled = data.enrolled || 0;
            const skipped = data.skipped || 0;
            const errors = data.errors || 0;
            
            console.log('Parsed values - enrolled:', enrolled, 'skipped:', skipped, 'errors:', errors);
            
            let message = `CSV processed - Enrolled: ${enrolled}, Skipped: ${skipped}`;
            
            if (errors > 0) {
                message += `, Errors: ${errors}`;
                
                // Show detailed error information if available
                if (data.details && data.details.length > 0) {
                    let errorDetails = '\n\nError details:\n';
                    data.details.forEach(function(detail, index) {
                        if (detail.error) {
                            errorDetails += `${index + 1}. Phone: ${detail.phone}, Error: ${detail.error}\n`;
                        }
                    });
                    message += errorDetails;
                }
                
                $scope.showNotification(message, 'warning');
            } else {
                $scope.showNotification(message, 'success');
            }
            
            $scope.loadEnrollments();
            $scope.closeEnrollModal();
        })
        .catch(function(error) {
            console.error('Error uploading CSV:', error);
            const errorMessage = error.data?.error || error.data?.message || 'Please try again.';
            $scope.showNotification('Error uploading CSV: ' + errorMessage, 'error');
        })
        .finally(function() {
            $scope.uploading = false;
        });
    };

    // Pause enrollment
    $scope.pauseEnrollment = function(enrollment) {
        $scope.showConfirmation(
            'Pause Enrollment',
            'Are you sure you want to pause this enrollment?',
            function() {
                $http.put('/api/enrollments/' + enrollment.id, { status: 'paused' })
                    .then(function(response) {
                        enrollment.status = 'paused';
                        $scope.calculateStats();
                        $scope.filterEnrollments();
                        $scope.showNotification('Enrollment paused successfully', 'success');
                    })
                    .catch(function(error) {
                        console.error('Error pausing enrollment:', error);
                        $scope.showNotification('Error pausing enrollment. Please try again.', 'error');
                    });
            }
        );
    };

    // Resume enrollment
    $scope.resumeEnrollment = function(enrollment) {
        $scope.showConfirmation(
            'Resume Enrollment',
            'Are you sure you want to resume this enrollment?',
            function() {
                $http.put('/api/enrollments/' + enrollment.id, { status: 'active' })
                    .then(function(response) {
                        enrollment.status = 'active';
                        $scope.calculateStats();
                        $scope.filterEnrollments();
                        $scope.loadEnrollments(); // Reload to get updated nextMessageAt
                        $scope.showNotification('Enrollment resumed successfully', 'success');
                    })
                    .catch(function(error) {
                        console.error('Error resuming enrollment:', error);
                        $scope.showNotification('Error resuming enrollment. Please try again.', 'error');
                    });
            }
        );
    };

    // Stop enrollment
    $scope.stopEnrollment = function(enrollment) {
        $scope.showConfirmation(
            'Stop Enrollment',
            'Are you sure you want to stop this enrollment? This action cannot be undone.',
            function() {
                $http.put('/api/enrollments/' + enrollment.id, { status: 'stopped' })
                    .then(function(response) {
                        enrollment.status = 'stopped';
                        $scope.calculateStats();
                        $scope.filterEnrollments();
                        $scope.showNotification('Enrollment stopped successfully', 'success');
                    })
                    .catch(function(error) {
                        console.error('Error stopping enrollment:', error);
                        $scope.showNotification('Error stopping enrollment. Please try again.', 'error');
                    });
            }
        );
    };

    // Bulk unenroll all active and paused enrollments
    $scope.bulkUnenrollAll = function() {
        const activeCount = $scope.stats.active || 0;
        const pausedCount = $scope.stats.paused || 0;
        const totalCount = activeCount + pausedCount;
        
        if (totalCount === 0) {
            $scope.showNotification('No active or paused enrollments to stop.', 'info');
            return;
        }

        $scope.showConfirmation(
            'Stop All Enrollments',
            `Are you sure you want to stop ALL ${totalCount} active/paused enrollments for this sequence? This action cannot be undone.`,
            function() {
                $http.post('/api/enrollments/stop-sequence', { sequenceId: $scope.sequenceId })
                    .then(function(response) {
                        $scope.showNotification(`Successfully stopped ${response.data.stoppedCount} enrollments.`, 'success');
                        $scope.loadEnrollments();
                    })
                    .catch(function(error) {
                        console.error('Error stopping all enrollments:', error);
                        const errorMessage = error.data?.message || 'Please try again.';
                        $scope.showNotification('Error stopping all enrollments: ' + errorMessage, 'error');
                    });
            }
        );
    };

    // Bulk resume all stopped enrollments
    $scope.bulkResumeAll = function() {
        const stoppedCount = $scope.stats.stopped || 0;
        
        if (stoppedCount === 0) {
            $scope.showNotification('No stopped enrollments to resume.', 'info');
            return;
        }

        $scope.showConfirmation(
            'Resume All Enrollments',
            `Are you sure you want to resume ALL ${stoppedCount} stopped enrollments for this sequence?`,
            function() {
                $http.post('/api/enrollments/resume-sequence', { sequenceId: $scope.sequenceId })
                    .then(function(response) {
                        $scope.showNotification(`Successfully resumed ${response.data.resumedCount} enrollments.`, 'success');
                        $scope.loadEnrollments();
                    })
                    .catch(function(error) {
                        console.error('Error resuming all enrollments:', error);
                        const errorMessage = error.data?.message || 'Please try again.';
                        $scope.showNotification('Error resuming all enrollments: ' + errorMessage, 'error');
                    });
            }
        );
    };

    // Restart individual enrollment
    $scope.restartEnrollment = function(enrollment) {
        $scope.showConfirmation(
            'Restart Enrollment',
            'Are you sure you want to restart this enrollment?',
            function() {
                $http.put('/api/enrollments/' + enrollment.id, { status: 'active' })
                    .then(function(response) {
                        enrollment.status = 'active';
                        $scope.calculateStats();
                        $scope.filterEnrollments();
                        $scope.loadEnrollments(); // Reload to get updated schedule
                        $scope.showNotification('Enrollment restarted successfully', 'success');
                    })
                    .catch(function(error) {
                        console.error('Error restarting enrollment:', error);
                        $scope.showNotification('Error restarting enrollment. Please try again.', 'error');
                    });
            }
        );
    };

    // Delete individual enrollment
    $scope.deleteEnrollment = function(enrollment) {
        $scope.showConfirmation(
            'Delete Enrollment',
            `Are you sure you want to PERMANENTLY DELETE this enrollment for ${enrollment.name || enrollment.phone}? This action cannot be undone.`,
            function() {
                $http.delete('/api/enrollments/' + enrollment.id)
                    .then(function(response) {
                        $scope.showNotification('Enrollment deleted successfully.', 'success');
                        $scope.loadEnrollments();
                    })
                    .catch(function(error) {
                        console.error('Error deleting enrollment:', error);
                        const errorMessage = error.data?.message || 'Please try again.';
                        $scope.showNotification('Error deleting enrollment: ' + errorMessage, 'error');
                    });
            }
        );
    };

    // View enrollment details
    $scope.viewEnrollmentDetails = function(enrollment) {
        // TODO: Implement enrollment details modal or page
        $scope.showNotification('Enrollment details view coming soon!', 'info');
    };

    // Export enrollments
    $scope.exportEnrollments = function() {
        const csvContent = $scope.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', $scope.sequence.name + '_enrollments_' + new Date().toISOString().split('T')[0] + '.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Generate CSV content
    $scope.generateCSV = function() {
        const headers = ['Name', 'Phone', 'Status', 'Current Step', 'Enrolled At', 'Next Message At'];
        const rows = $scope.enrollments.map(function(enrollment) {
            return [
                enrollment.name || '',
                enrollment.phone,
                enrollment.status,
                enrollment.current_day + '/' + $scope.sequence.messages.length,
                $scope.formatDate(enrollment.enrolled_at),
                enrollment.next_message_due ? $scope.formatDate(enrollment.next_message_due) : ''
            ];
        });

        return [headers, ...rows].map(function(row) {
            return row.map(function(field) {
                return '"' + String(field).replace(/"/g, '""') + '"';
            }).join(',');
        }).join('\n');
    };

    // Go back to sequences
    $scope.goBack = function() {
        $location.path('/sequences');
    };

    // Handle file select (backup method)
    $scope.handleFileSelect = function(element) {
        if (element.files && element.files[0]) {
            $scope.$apply(function() {
                $scope.csvFile = element.files[0];
            });
        }
    };
    
    // Initialize controller
    $scope.init();
}]);
