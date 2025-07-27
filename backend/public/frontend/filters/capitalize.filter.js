// Capitalize filter for the application
angular.module('autopostWaApp.core').filter('capitalize', function() {
  return function(input) {
    if (!input) return '';
    return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
  };
});
