angular.module('autopostWaApp.schedules').controller('ScheduleController', function($scope, $location, AuthService, ApiService) {
  // Authentication and navigation
  $scope.isActive = function(path) {
    return $location.path().indexOf(path) === 0;
  };

  // Load user data and authentication check
  AuthService.me().then(function(res) {
    $scope.user = res.data.user;
    loadSchedules();
  }).catch(function() {
    $location.path('/login');
  });
  
  // Schedules functionality
  $scope.schedules = [];
  $scope.groups = [];
  $scope.loading = true;
  $scope.error = '';
  $scope.success = '';

  // Load groups for group selection in schedule form
  function loadGroups() {
    ApiService.getGroups()
      .then(function(response) {
        $scope.groups = response.data;
      })
      .catch(function(error) {
        console.error('Error loading groups:', error);
        $scope.groups = [];
      });
  }

  function loadSchedules() {
    $scope.loading = true;
    ApiService.getSchedules()
      .then(function(response) {
        console.log('Schedules loaded:', response.data);
        $scope.schedules = response.data;
        $scope.loading = false;
      })
      .catch(function(error) {
        console.error('Error loading schedules:', error);
        $scope.error = 'Failed to load schedules';
        $scope.loading = false;
      });
  }

  // Load groups when controller initializes
  loadGroups();
  
  $scope.deleteSchedule = function(id) {
    if (confirm('Are you sure you want to delete this schedule?')) {
      ApiService.deleteSchedule(id)
        .then(function() {
          loadSchedules();
          $scope.success = 'Schedule deleted successfully';
        })
        .catch(function(error) {
          console.error('Error deleting schedule:', error);
          $scope.error = 'Failed to delete schedule';
        });
    }
  };

  // Logout functionality
  $scope.logout = function() {
    AuthService.logout().then(function() {
      $location.path('/login');
    }).catch(function(error) {
      console.error('Logout failed:', error);
      $scope.error = 'Logout failed. Please try again.';
    });
  };
});