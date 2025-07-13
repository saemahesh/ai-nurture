angular.module('autopostWaApp.core').controller('SidebarController', ['$scope', '$location', 'AuthService', function($scope, $location, AuthService) {
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
  
  $scope.sidebarOpen = false;
  $scope.openSidebar = function() {
    $scope.sidebarOpen = true;
    setTimeout(function() {
      var btn = document.querySelector('[aria-label="Open sidebar"]');
      if (btn) btn.blur();
    }, 200);
  };
  $scope.closeSidebar = function() {
    $scope.sidebarOpen = false;
  };

  // Close sidebar on route change (for mobile UX)
  $scope.$on('$locationChangeSuccess', function() {
    $scope.sidebarOpen = false;
  });

  // Prevent body scroll when sidebar is open (mobile)
  $scope.$watch('sidebarOpen', function(isOpen) {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });
}]);
