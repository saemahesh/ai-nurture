angular.module('autopostWaApp').controller('SequencesController', ['$scope', '$http', '$location', function($scope, $http, $location) {
    $scope.sequences = [];
    $scope.enrollmentCounts = {};
    $scope.loading = true;
    $scope.dropdownOpen = null;
    $scope.showDeleteModal = false;
    $scope.sequenceToDelete = null;

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
                alert('Error loading sequences. Please try again.');
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

    // Close dropdown when clicking outside
    angular.element(document).on('click', function(event) {
        if (!angular.element(event.target).closest('.relative').length) {
            $scope.$apply(function() {
                $scope.dropdownOpen = null;
            });
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
                alert('Sequence duplicated successfully!');
            })
            .catch(function(error) {
                console.error('Error duplicating sequence:', error);
                alert('Error duplicating sequence. Please try again.');
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
                alert('Error updating sequence status. Please try again.');
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
                alert('Sequence deleted successfully!');
            })
            .catch(function(error) {
                console.error('Error deleting sequence:', error);
                const errorMessage = error.data?.message || error.data?.error || 'Unknown error occurred';
                
                if (errorMessage.includes('active enrollments')) {
                    // Show specific error for active enrollments with option to stop them
                    const confirmStop = confirm(
                        'Cannot delete sequence with active enrollments.\n\n' +
                        'Would you like to stop all active enrollments for this sequence and then delete it?'
                    );
                    
                    if (confirmStop) {
                        $scope.stopEnrollmentsAndDelete();
                    }
                } else {
                    alert('Error deleting sequence: ' + errorMessage);
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
                alert('All enrollments stopped and sequence deleted successfully!');
            })
            .catch(function(error) {
                console.error('Error stopping enrollments or deleting sequence:', error);
                const errorMessage = error.data?.message || error.data?.error || 'Unknown error occurred';
                alert('Error: ' + errorMessage);
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
