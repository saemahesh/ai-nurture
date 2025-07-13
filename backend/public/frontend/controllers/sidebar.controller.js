angular.module('autopostWaApp.core').controller('SidebarController', ['$scope', '$location', 'AuthService', '$window', function($scope, $location, AuthService, $window) {
  $scope.isSidebarOpen = false;

  $scope.toggleSidebar = function() {
    $scope.isSidebarOpen = !$scope.isSidebarOpen;
  };

  // Close sidebar on route change
  $scope.$on('$routeChangeStart', function() {
    $scope.isSidebarOpen = false;
  });

  // Adjust sidebar based on window size
  angular.element($window).bind('resize', function() {
    if ($window.innerWidth > 768) {
      $scope.isSidebarOpen = true;
    } else {
      $scope.isSidebarOpen = false;
    }
    $scope.$apply();
  });

  $scope.isActive = function(route) {
    return $location.path().indexOf(route) === 0;
  };
  
  $scope.user = null;
  $scope.loadingUser = true;
  $scope.userError = false;
  
  // Get user info from the auth service
  AuthService.me().then(function(response) {
    $scope.user = response.data.user;
    $scope.loadingUser = false;
  }).catch(function(error) {
    console.error('Error loading user data:', error);
    $scope.loadingUser = false;
    $scope.userError = true;
  });
  
  $scope.logout = function() {
    $scope.loggingOut = true;
    AuthService.logout().then(function() {
      $scope.user = null;
      $location.path('/login');
    }).catch(function(error) {
      console.error('Error during logout:', error);
      alert('Logout failed. Please try again.');
    }).finally(function() {
      $scope.loggingOut = false;
    });
  };
}]);
