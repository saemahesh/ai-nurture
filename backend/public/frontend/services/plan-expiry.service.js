angular.module('autopostWaApp.core').factory('PlanExpiryService', function($location, $timeout, ApiService) {
  var service = {
    isExpired: false,
    checkInterval: null,
    
    // Initialize plan expiry checking
    init: function() {
      // Don't check expiry on login/register pages
      var currentPath = $location.path();
      if (currentPath === '/login' || currentPath === '/register') {
        console.log('Skipping plan expiry check on auth page:', currentPath);
        return;
      }
      
      this.checkExpiry();
      // Check every 5 minutes
      this.checkInterval = setInterval(() => {
        // Only check if not on auth pages
        var currentPath = $location.path();
        if (currentPath !== '/login' && currentPath !== '/register') {
          this.checkExpiry();
        }
      }, 5 * 60 * 1000);
    },
    
    // Check plan expiry status
    checkExpiry: function() {
      var self = this;
      ApiService.checkPlanExpiry().then(function(response) {
        var isExpired = response.data.isExpired || false;
        self.setExpiryStatus(isExpired);
      }).catch(function() {
        // If API fails, check localStorage
        var storedExpiry = localStorage.getItem('plan_expired');
        if (storedExpiry === 'true') {
          self.setExpiryStatus(true);
        }
      });
    },
    
    // Set expiry status and handle redirect
    setExpiryStatus: function(expired) {
      var self = this;
      this.isExpired = expired;
      localStorage.setItem('plan_expired', expired.toString());
      
      if (expired) {
        var currentPath = $location.path();
        // Don't redirect if on login, register, or dashboard pages
        if (currentPath !== '/dashboard' && 
            currentPath !== '/login' && 
            currentPath !== '/register') {
          console.log('Plan expired - redirecting from', currentPath, 'to dashboard');
          $timeout(function() {
            $location.path('/dashboard');
          }, 100);
        }
        // If on register page, stay there - don't redirect
        else if (currentPath === '/register') {
          console.log('Plan expired but staying on register page');
        }
      }
    },
    
    // Force redirect to dashboard
    redirectToDashboard: function() {
      if (this.isExpired) {
        $timeout(function() {
          $location.path('/dashboard');
        }, 100);
      }
    },
    
    // Check if route is allowed when plan is expired
    isRouteAllowed: function(templateUrl) {
      if (!this.isExpired) {
        return true; // Allow all routes if plan is not expired
      }
      
      // Allow login, register, and dashboard when expired
      var allowedRoutes = ['login.html', 'register.html', 'dashboard.html'];
      
      if (!templateUrl) {
        return true; // Allow if no template URL
      }
      
      return allowedRoutes.some(function(route) {
        return templateUrl.indexOf(route) !== -1;
      });
    },
    
    // Test function to simulate plan expiry - for testing only
    simulateExpiry: function() {
      console.log('Simulating plan expiry for testing');
      this.setExpiryStatus(true);
    },
    
    // Reset expiry status - for testing only
    resetExpiry: function() {
      console.log('Resetting plan expiry for testing');
      this.setExpiryStatus(false);
    },
    
    // Cleanup
    destroy: function() {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }
  };
  
  return service;
});
