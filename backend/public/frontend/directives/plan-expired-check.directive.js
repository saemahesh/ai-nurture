angular.module('autopostWaApp.core').directive('planExpiredCheck', function(PlanExpiryService, $location) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      // Watch for plan expiry status changes
      scope.$watch(function() {
        return PlanExpiryService.isExpired;
      }, function(isExpired) {
        if (isExpired) {
          // Disable all navigation links except dashboard
          var href = element.attr('href');
          if (href && href !== '#/dashboard' && href !== '#/login' && href !== '#/register') {
            element.addClass('nav-disabled');
            element.attr('title', 'Plan expired - Please contact support');
            
            // Prevent navigation
            element.off('click.planExpired').on('click.planExpired', function(e) {
              e.preventDefault();
              PlanExpiryService.redirectToDashboard();
              return false;
            });
          }
        } else {
          // Re-enable navigation
          element.removeClass('nav-disabled');
          element.removeAttr('title');
          element.off('click.planExpired');
        }
      });
    }
  };
});
