angular.module('autopostWaApp.core').controller('MainController', function($scope, $location, AuthService) {
    $scope.isLoggedIn = false;
    
    AuthService.me().then(function(response) {
        $scope.isLoggedIn = true;
        $scope.user = response.data.user;
    }).catch(function() {
        $scope.isLoggedIn = false;
    });

    $scope.logout = function() {
        AuthService.logout().then(function() {
            $location.path('/login');
        });
    };
});