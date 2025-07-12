angular.module('autopostWaApp.auth').controller('AuthController', function($scope, $location, AuthService) {
  $scope.loginData = {};
  $scope.registerData = {};
  $scope.error = '';

  $scope.login = function() {
    AuthService.login($scope.loginData.username, $scope.loginData.password)
      .then(function() {
        $location.path('/dashboard');
      })
      .catch(function(err) {
        $scope.error = err.data && err.data.error ? err.data.error : 'Login failed';
      });
  };

  $scope.register = function() {
    AuthService.register($scope.registerData.username, $scope.registerData.password)
      .then(function() {
        $location.path('/login');
      })
      .catch(function(err) {
        $scope.error = err.data && err.data.error ? err.data.error : 'Register failed';
      });
  };
});
