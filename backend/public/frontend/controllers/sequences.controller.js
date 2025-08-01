angular.module('autopostWaApp').controller('SequencesController', ['$scope', '$http', '$location', 'NotificationService', function($scope, $http, $location, NotificationService) {
    $scope.sequences = [];
    $scope.enrollmentCounts = {};
    $scope.loading = true;
    $scope.dropdownOpen = null;
    $scope.showDeleteModal = false;
    $scope.sequenceToDelete = null;

    // Initialize notification service
    NotificationService.initToast($scope);
    NotificationService.initConfirmModal($scope);

    // Load sequences
    $scope.loadSequences = function() {
        $scope.loading = true;
        $http.get('/api/sequences')
            .then(function(response) {
                $scope.sequences = response.data;
                $scope.loadEnrollmentCounts();
            })
            .catch(function(error) {
                console.error('Error loading sequences:', error);
                NotificationService.showToast($scope, 'Error loading sequences. Please try again.', 'error');
            })
            .finally(function() {
                $scope.loading = false;
            });
    };

    // Load enrollment counts for all sequences
    $scope.loadEnrollmentCounts = function() {
        $http.get('/api/enrollments')
            .then(function(response) {
                const enrollments = response.data;
                $scope.enrollmentCounts = {};
                
                // Count active enrollments per sequence
                enrollments.forEach(function(enrollment) {
                    if (enrollment.status === 'active') {
                        if (!$scope.enrollmentCounts[enrollment.sequence_id]) {
                            $scope.enrollmentCounts[enrollment.sequence_id] = 0;
                        }
                        $scope.enrollmentCounts[enrollment.sequence_id]++;
                    }
                });
            })
            .catch(function(error) {
                console.error('Error loading enrollment counts:', error);
            });
    };

    // Get enrollment count for a sequence
    $scope.getEnrollmentCount = function(sequenceId) {
        return $scope.enrollmentCounts[sequenceId] || 0;
    };

    // Toggle dropdown menu
    $scope.toggleDropdown = function(sequenceId) {
        $scope.dropdownOpen = $scope.dropdownOpen === sequenceId ? null : sequenceId;
    };

    // Close dropdown when clicking outside (jqLite compatible)
    angular.element(document).on('click', function(event) {
        var $target = angular.element(event.target);
        // Only close if not inside a dropdown menu or toggle button
        if (!$target.closest('[ng-click="toggleDropdown(sequence.id)"]').length && !$target.closest('.relative').length) {
            if ($scope.dropdownOpen !== null) {
                $scope.$apply(function() {
                    $scope.dropdownOpen = null;
                });
            }
        }
    });

    // Create new sequence
    $scope.createSequence = function() {
        $location.path('/sequence-create');
    };

    // Edit sequence
    $scope.editSequence = function(sequence) {
        $scope.dropdownOpen = null;
        $location.path('/sequence-create/' + sequence.id);
    };

    // View enrollments
    $scope.viewEnrollments = function(sequence) {
        $scope.dropdownOpen = null;
        $location.path('/enrollments/' + sequence.id);
    };

    // Duplicate sequence
    $scope.duplicateSequence = function(sequence) {
        $scope.dropdownOpen = null;
        
        const duplicatedSequence = {
            name: sequence.name + ' (Copy)',
            description: sequence.description,
            messages: angular.copy(sequence.messages),
            status: 'inactive'
        };

        $http.post('/api/sequences', duplicatedSequence)
            .then(function(response) {
                $scope.loadSequences();
                NotificationService.showToast($scope, 'Sequence duplicated successfully!', 'success');
            })
            .catch(function(error) {
                console.error('Error duplicating sequence:', error);
                NotificationService.showToast($scope, 'Error duplicating sequence. Please try again.', 'error');
            });
    };

    // Toggle sequence status (active/inactive)
    $scope.toggleSequenceStatus = function(sequence) {
        $scope.dropdownOpen = null;
        
        const newStatus = sequence.status === 'active' ? 'inactive' : 'active';
        const updatedSequence = angular.copy(sequence);
        updatedSequence.status = newStatus;

        $http.put('/api/sequences/' + sequence.id, updatedSequence)
            .then(function(response) {
                sequence.status = newStatus;
                
                // If deactivating, we should also pause all active enrollments
                if (newStatus === 'inactive') {
                    $scope.pauseSequenceEnrollments(sequence.id);
                }
            })
            .catch(function(error) {
                console.error('Error updating sequence status:', error);
                NotificationService.showToast($scope, 'Error updating sequence status. Please try again.', 'error');
            });
    };

    // Pause all enrollments for a sequence
    $scope.pauseSequenceEnrollments = function(sequenceId) {
        $http.post('/api/enrollments/pause-sequence', { sequenceId: sequenceId })
            .then(function(response) {
                console.log('Enrollments paused for sequence:', sequenceId);
            })
            .catch(function(error) {
                console.error('Error pausing enrollments:', error);
            });
    };

    // Delete sequence
    $scope.deleteSequence = function(sequence) {
        $scope.dropdownOpen = null;
        $scope.sequenceToDelete = sequence;
        $scope.showDeleteModal = true;
    };

    // Confirm delete
    $scope.confirmDelete = function() {
        if (!$scope.sequenceToDelete) return;

        $http.delete('/api/sequences/' + $scope.sequenceToDelete.id)
            .then(function(response) {
                $scope.loadSequences();
                $scope.showDeleteModal = false;
                $scope.sequenceToDelete = null;
                NotificationService.showToast($scope, 'Sequence deleted successfully!', 'success');
            })
            .catch(function(error) {
                console.error('Error deleting sequence:', error);
                const errorMessage = error.data?.message || error.data?.error || 'Unknown error occurred';
                
                if (errorMessage.includes('active enrollments')) {
                    // Show specific error for active enrollments with option to stop them
                    NotificationService.showConfirmation($scope, 
                        'Active Enrollments Found',
                        'Cannot delete sequence with active enrollments.\n\nWould you like to stop all active enrollments for this sequence and then delete it?',
                        function() {
                            $scope.stopEnrollmentsAndDelete();
                        },
                        null,
                        'Yes, Stop & Delete',
                        'Cancel'
                    );
                } else {
                    NotificationService.showToast($scope, 'Error deleting sequence: ' + errorMessage, 'error');
                }
            });
    };

    // Stop all enrollments and delete sequence
    $scope.stopEnrollmentsAndDelete = function() {
        if (!$scope.sequenceToDelete) return;

        // Use the new bulk unenroll endpoint
        $http.post('/api/enrollments/stop-sequence', { sequenceId: $scope.sequenceToDelete.id })
            .then(function(response) {
                console.log('Stopped enrollments:', response.data);
                // Now try to delete the sequence
                return $http.delete('/api/sequences/' + $scope.sequenceToDelete.id);
            })
            .then(function(response) {
                $scope.loadSequences();
                $scope.showDeleteModal = false;
                $scope.sequenceToDelete = null;
                NotificationService.showToast($scope, 'All enrollments stopped and sequence deleted successfully!', 'success');
            })
            .catch(function(error) {
                console.error('Error stopping enrollments or deleting sequence:', error);
                const errorMessage = error.data?.message || error.data?.error || 'Unknown error occurred';
                NotificationService.showToast($scope, 'Error: ' + errorMessage, 'error');
            });
    };

    // Cancel delete
    $scope.cancelDelete = function() {
        $scope.showDeleteModal = false;
        $scope.sequenceToDelete = null;
    };

    // Initialize
    $scope.loadSequences();
}]);
