angular.module('autopostWaApp.core').controller('SidebarController', ['$scope', '$location', 'AuthService', function($scope, $location, AuthService) {
  $scope.isActive = function(route) {
    return $location.path().indexOf(route) === 0;
  };
  
  $scope.user = null;
  $scope.loadingUser = true;
  $scope.userError = false;
  $scope.desktopScrollDirection = 'down'; // Track scroll direction for desktop
  $scope.mobileScrollDirection = 'down';  // Track scroll direction for mobile
  
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
  
  // Enhanced force refresh function for production cache issues
  $scope.forceRefresh = function() {
    $scope.refreshing = true;
    
    console.log('Force refresh initiated - clearing all caches...');
    
    // Step 1: Clear service worker caches
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({type: 'CLEAR_CACHE'});
    }
    
    // Step 2: Clear all browser caches
    if ('caches' in window) {
      caches.keys().then(function(names) {
        names.forEach(function(name) {
          caches.delete(name);
          console.log('Cleared cache:', name);
        });
      });
    }
    
    // Step 3: Clear all storage
    try {
      localStorage.clear();
      sessionStorage.clear();
      console.log('Cleared localStorage and sessionStorage');
    } catch (e) {
      console.warn('Could not clear storage:', e);
    }
    
    // Step 4: Unregister all service workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        registrations.forEach(function(registration) {
          registration.unregister();
          console.log('Unregistered service worker');
        });
        
        // Step 5: Force reload with aggressive cache busting
        setTimeout(function() {
          const cacheBuster = Date.now();
          const currentUrl = window.location.href.split('?')[0]; // Remove existing params
          window.location.href = currentUrl + '?v=' + cacheBuster + '&refresh=' + cacheBuster;
        }, 1000);
      });
    } else {
      // No service worker - just do aggressive reload
      setTimeout(function() {
        const cacheBuster = Date.now();
        const currentUrl = window.location.href.split('?')[0];
        window.location.href = currentUrl + '?v=' + cacheBuster + '&refresh=' + cacheBuster;
      }, 1000);
    }
  };
  
  // Production auto-refresh mechanism - more conservative approach
  $scope.setupAutoRefresh = function() {
    // Only enable in production and if there are no console errors
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      console.log('Production environment detected - enabling cache monitoring');
      
      // Check every 60 seconds if critical resources are fresh
      const monitorInterval = setInterval(function() {
        // Simple health check by trying to fetch a controller file with cache busting
        const testUrl = '/controllers/sidebar.controller.js?check=' + Date.now();
        fetch(testUrl, { cache: 'no-cache' })
          .then(response => {
            if (!response.ok) {
              console.warn('Health check failed for sidebar controller');
            }
          })
          .catch(error => {
            console.warn('Health check network error:', error);
          });
      }, 60000); // Every 60 seconds
      
      // Store interval ID for cleanup if needed
      window.healthCheckInterval = monitorInterval;
    }
  };
  
  // Initialize monitoring on controller load
  $scope.setupAutoRefresh();
  
  $scope.sidebarOpen = false;
  $scope.openSidebar = function() {
    $scope.sidebarOpen = true;
    setTimeout(function() {
      var btn = document.querySelector('[aria-label="Open sidebar"]');
      if (btn) btn.blur();
      // Check scroll indicators after sidebar opens
      $scope.checkScrollIndicators();
    }, 200);
  };
  $scope.closeSidebar = function() {
    $scope.sidebarOpen = false;
  };

  // Function to toggle scroll direction and scroll accordingly
  $scope.toggleScroll = function(navId) {
    var nav = document.getElementById(navId);
    if (!nav) return;
    
    var scrollAmount = nav.clientHeight * 0.7;
    var isDesktop = navId === 'desktop-nav';
    var currentDirection = isDesktop ? $scope.desktopScrollDirection : $scope.mobileScrollDirection;
    
    if (currentDirection === 'down') {
      // Scroll down
      nav.scrollBy({
        top: scrollAmount,
        behavior: 'smooth'
      });
    } else {
      // Scroll up
      nav.scrollBy({
        top: -scrollAmount,
        behavior: 'smooth'
      });
    }
    
    // Re-check indicators after scroll
    setTimeout(function() {
      $scope.checkScrollIndicators();
      if (!$scope.$$phase) {
        $scope.$apply();
      }
    }, 500);
  };

  // Function to check and show scroll indicators
  $scope.checkScrollIndicators = function() {
    setTimeout(function() {
      // Check desktop nav
      var desktopNav = document.getElementById('desktop-nav');
      var desktopIndicator = document.getElementById('desktop-scroll-indicator');
      if (desktopNav && desktopIndicator) {
        var scrollHeight = desktopNav.scrollHeight;
        var clientHeight = desktopNav.clientHeight;
        var scrollTop = desktopNav.scrollTop;
        var isScrollable = scrollHeight > clientHeight;
        
        if (!isScrollable) {
          desktopIndicator.style.display = 'none';
        } else {
          // Calculate remaining content
          var remainingBelow = scrollHeight - (scrollTop + clientHeight);
          var remainingAbove = scrollTop;
          var threshold = 30;
          
          // Determine direction and visibility
          if (remainingAbove <= threshold && remainingBelow > threshold) {
            // Near top - show down arrow
            $scope.desktopScrollDirection = 'down';
            desktopIndicator.style.display = 'block';
          } else if (remainingBelow <= threshold && remainingAbove > threshold) {
            // Near bottom - show up arrow
            $scope.desktopScrollDirection = 'up';
            desktopIndicator.style.display = 'block';
          } else if (remainingAbove > threshold && remainingBelow > threshold) {
            // In middle - show down arrow (default)
            $scope.desktopScrollDirection = 'down';
            desktopIndicator.style.display = 'block';
          } else {
            // At very edge or not enough content
            desktopIndicator.style.display = 'none';
          }
        }
      }
      
      // Check mobile nav
      var mobileNav = document.getElementById('mobile-nav');
      var mobileIndicator = document.getElementById('mobile-scroll-indicator');
      if (mobileNav && mobileIndicator) {
        var scrollHeight = mobileNav.scrollHeight;
        var clientHeight = mobileNav.clientHeight;
        var scrollTop = mobileNav.scrollTop;
        var isScrollable = scrollHeight > clientHeight;
        
        if (!isScrollable) {
          mobileIndicator.style.display = 'none';
        } else {
          // Calculate remaining content
          var remainingBelow = scrollHeight - (scrollTop + clientHeight);
          var remainingAbove = scrollTop;
          var threshold = 30;
          
          // Determine direction and visibility
          if (remainingAbove <= threshold && remainingBelow > threshold) {
            // Near top - show down arrow
            $scope.mobileScrollDirection = 'down';
            mobileIndicator.style.display = 'block';
          } else if (remainingBelow <= threshold && remainingAbove > threshold) {
            // Near bottom - show up arrow
            $scope.mobileScrollDirection = 'up';
            mobileIndicator.style.display = 'block';
          } else if (remainingAbove > threshold && remainingBelow > threshold) {
            // In middle - show down arrow (default)
            $scope.mobileScrollDirection = 'down';
            mobileIndicator.style.display = 'block';
          } else {
            // At very edge or not enough content
            mobileIndicator.style.display = 'none';
          }
        }
      }
      
      // Apply scope changes
      if (!$scope.$$phase) {
        $scope.$apply();
      }
    }, 200);
  };

  // Close sidebar on route change (for mobile UX)
  $scope.$on('$locationChangeSuccess', function() {
    $scope.sidebarOpen = false;
  });

  // Initialize scroll indicators after controller loads
  $scope.$on('$viewContentLoaded', function() {
    setTimeout(function() {
      $scope.checkScrollIndicators();
      // Add scroll listeners to update indicators in real-time
      ['desktop-nav', 'mobile-nav'].forEach(function(navId) {
        var nav = document.getElementById(navId);
        if (nav) {
          nav.addEventListener('scroll', function() {
            setTimeout(function() {
              $scope.checkScrollIndicators();
            }, 50);
          });
        }
      });
    }, 500);
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
