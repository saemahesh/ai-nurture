angular.module('autopostWaApp.core').directive('sidebarNav', function() {
  return {
    restrict: 'E',
    templateUrl: function() {
      // Add cache buster for mobile devices using timestamp
      var isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      var url = 'sidebar.html';
      if (isMobile) {
        url += '?v=' + Date.now(); // Use timestamp for template cache busting
      }
      return url;
    },
    controller: 'SidebarController'
  };
});
