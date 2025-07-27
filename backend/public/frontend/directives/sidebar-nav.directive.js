angular.module('autopostWaApp.core').directive('sidebarNav', function() {
  return {
    restrict: 'E',
    template: '<div style="background: blue; color: white; padding: 20px; width: 300px;"><h2>INLINE TEMPLATE TEST</h2><p>If you see this blue box, inline templates work!</p><button ng-click="logout()">Logout Test</button></div>',
    controller: 'SidebarController'
  };
});
