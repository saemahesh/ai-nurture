angular.module('autopostWaApp.core').directive('sidebarNav', function() {
  return {
    restrict: 'E',
    templateUrl: 'sidebar.html',
    controller: 'SidebarController'
  };
});
