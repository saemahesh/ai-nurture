// Core application module
angular.module('autopostWaApp.core', []);

// Simple app version for cache busting - no complex synchronization needed
var APP_VERSION = 'v' + Date.now(); // Always fresh version for cache busting
window.APP_VERSION = APP_VERSION;
console.log('App Version (cache busting):', APP_VERSION);

// Features modules
angular.module('autopostWaApp.auth', ['autopostWaApp.core']);
angular.module('autopostWaApp.dashboard', ['autopostWaApp.core']);
angular.module('autopostWaApp.groups', ['autopostWaApp.core']);
angular.module('autopostWaApp.events', ['autopostWaApp.core']);
angular.module('autopostWaApp.media', ['autopostWaApp.core']);
angular.module('autopostWaApp.schedules', ['autopostWaApp.core']);
angular.module('autopostWaApp.sequences', ['autopostWaApp.core']);
angular.module('autopostWaApp.status', ['autopostWaApp.core']);
angular.module('autopostWaApp.meetings', ['autopostWaApp.core']);

// Main application module with dependencies
var app = angular.module('autopostWaApp', [
  'ngRoute',
  'autopostWaApp.core',
  'autopostWaApp.auth',
  'autopostWaApp.dashboard',
  'autopostWaApp.groups',
  'autopostWaApp.events',
  'autopostWaApp.media',
  'autopostWaApp.schedules',
  'autopostWaApp.sequences',
  'autopostWaApp.status',
  'autopostWaApp.meetings'
]);

// Main routing configuration
app.config(function($routeProvider, $locationProvider, $httpProvider) {
  
  // Cache-busting helper function for templates
  function getTemplateUrl(templateName) {
    return templateName + '?v=' + Date.now();
  }
  
  $routeProvider
    .when('/login', {
      templateUrl: getTemplateUrl('login.html'),
      controller: 'AuthController'
    })
    .when('/register', {
      templateUrl: getTemplateUrl('register.html'),
      controller: 'AuthController'
    })
    .when('/dashboard', {
      templateUrl: getTemplateUrl('dashboard.html'),
      controller: 'DashboardController'
    })
    .when('/groups/create', {
      templateUrl: getTemplateUrl('group-create.html'),
      controller: 'GroupCreateController'
    })
    .when('/automation/schedule', {
      templateUrl: getTemplateUrl('automation-schedule.html'),
      controller: 'AutomationScheduleController'
    })
    .when('/groups', {
      templateUrl: getTemplateUrl('groups.html'),
      controller: 'GroupsController'  // Fixed from GroupsPageController
    })
    .when('/schedules', {
      templateUrl: getTemplateUrl('schedules.html'),
      controller: 'ScheduleController'  // Fixed from SchedulesPageController
    })
    .when('/events', {
      templateUrl: getTemplateUrl('events.html'),
      controller: 'EventsController'  // Fixed from EventsPageController
    })
    .when('/event-reminders', {
      templateUrl: getTemplateUrl('event-reminders.html'),
      controller: 'EventRemindersController'
    })
    .when('/event-reminders/:id', {
      templateUrl: getTemplateUrl('event-reminders.html'),
      controller: 'EventRemindersController'
    })
    .when('/media', {
      templateUrl: getTemplateUrl('media.html'),
      controller: 'MediaPageController'
    })
    .when('/users', {
      templateUrl: getTemplateUrl('users.html'),
      controller: 'DashboardController'
    })
    .when('/settings', {
      templateUrl: getTemplateUrl('settings.html'),
      controller: 'SettingsController'
    })
    .when('/direct-schedule', {
      templateUrl: getTemplateUrl('direct-schedule.html'),
      controller: 'DirectScheduleController'
    })
    .when('/sequences', {
      templateUrl: getTemplateUrl('sequences.html'),
      controller: 'SequencesController'
    })
    .when('/sequences/create', {
      templateUrl: getTemplateUrl('sequence-create.html'),
      controller: 'SequenceCreateController'
    })
    .when('/sequence-create', {
      templateUrl: getTemplateUrl('sequence-create.html'),
      controller: 'SequenceCreateController'
    })
    .when('/sequence-create/:id', {
      templateUrl: getTemplateUrl('sequence-create.html'),
      controller: 'SequenceCreateController'
    })
    .when('/enrollments/:sequenceId', {
      templateUrl: getTemplateUrl('enrollments.html'),
      controller: 'EnrollmentsController'
    })
    .when('/customers', {
      templateUrl: getTemplateUrl('customers.html'),
      controller: 'CustomersController'
    })
    .when('/campaigns', {
      redirectTo: '/sequences'
    })
    .when('/status', {
      templateUrl: getTemplateUrl('status.html'),
      controller: 'StatusController'
    })
    .when('/meetings', {
      templateUrl: getTemplateUrl('meetings.html'),
      controller: 'MeetingsController'
    })

    .otherwise({ redirectTo: '/login' });
  $locationProvider.hashPrefix('');

  $httpProvider.interceptors.push(function($q, $location) {
    return {
      'request': function(config) {
        // Add cache-busting for all requests to local JavaScript and CSS files
        if (config.url && !config.url.includes('http') && 
            (config.url.includes('.js') || config.url.includes('.css') || config.url.includes('.html'))) {
          
          // Add cache-busting parameter if not already present
          if (!config.url.includes('?v=')) {
            config.url += (config.url.includes('?') ? '&' : '?') + 'v=' + Date.now() + '&cb=' + Math.random();
          }
          
          // Add aggressive no-cache headers
          config.headers = config.headers || {};
          config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
          config.headers['Pragma'] = 'no-cache';
          config.headers['Expires'] = '0';
        }
        return config;
      },
      responseError: function(rejection) {
        if (rejection.status === 401) {
          // Only redirect to login for critical endpoints, not for optional ones like media list
          const url = rejection.config.url;
          const isOptionalEndpoint = url.includes('/media/list') || url.includes('/uploads/') || url.includes('/plan-status');
          const currentPath = $location.path();
          
          // Don't redirect if on register page, even for auth errors
          if (!isOptionalEndpoint && currentPath !== '/register') {
            $location.path('/login');
          }
        }
        return $q.reject(rejection);
      }
    };
  });
})
.controller('SettingsController', function($scope, $http, $timeout) {
  $scope.settings = {};
  $scope.saving = false;
  $scope.saveSuccess = false;
  $scope.saveError = '';
  $scope.testing = false;
  $scope.testSuccess = false;
  $scope.testError = '';
  $scope.testingConn = false;
  $scope.testResult = null;
  $scope.showTestPopup = false;
  $scope.testMobile = '';

  function loadSettings() {
    $http.get('/users/settings').then(function(res) {
      $scope.settings = res.data;
    });
  }

  $scope.saveSettings = function() {
    $scope.saving = true;
    $scope.saveSuccess = false;
    $scope.saveError = '';
    if (!$scope.settings.access_token || !$scope.settings.instance_id || !$scope.settings.wa_phone) {
      $scope.saving = false;
      $scope.saveError = 'All fields are required.';
      return;
    }
    $http.post('/users/settings', $scope.settings).then(function() {
      $scope.saving = false;
      $scope.saveSuccess = true;
      $timeout(function() {
        $scope.saveSuccess = false;
      }, 3000);
    }, function(err) {
      $scope.saving = false;
      $scope.saveError = err.data && err.data.error ? err.data.error : 'Failed to save settings';
    });
  };

  $scope.testConnection = function() {
    if (!$scope.settings.test_mobile || !$scope.settings.test_mobile.trim()) {
      $scope.testError = 'Please enter a test mobile number in the form.';
      $scope.testSuccess = false;
      return;
    }
    if (!$scope.settings.access_token || !$scope.settings.instance_id || !$scope.settings.wa_phone) {
      $scope.testError = 'Please fill all required fields first.';
      $scope.testSuccess = false;
      return;
    }
    $scope.testing = true;
    $scope.testSuccess = false;
    $scope.testError = '';
    
    // Use backend endpoint to avoid CORS issues
    $http.post('/users/test-connection', {
      test_mobile: $scope.settings.test_mobile,
      access_token: $scope.settings.access_token,
      instance_id: $scope.settings.instance_id
    }).then(function(res) {
      $scope.testing = false;
      $scope.testSuccess = true;
      $scope.testError = '';
      $timeout(function() {
        $scope.testSuccess = false;
      }, 5000);
    }, function(err) {
      $scope.testing = false;
      $scope.testSuccess = false;
      var msg = (err.data && err.data.error) ? err.data.error : 'Failed to send test message.';
      $scope.testError = msg;
    });
  };

  loadSettings();
})

// App run block for cache busting and mobile optimization
app.run(function($rootScope, $location, $timeout, PlanExpiryService) {
  // Initialize plan expiry service
  PlanExpiryService.init();
  
  // Expose test functions to window for browser console testing
  window.testPlanExpiry = function() {
    PlanExpiryService.simulateExpiry();
  };
  
  window.resetPlanExpiry = function() {
    PlanExpiryService.resetExpiry();
  };
  
  // Register service worker for cache management
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function(registration) {
        console.log('Service Worker registered successfully:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', function() {
          console.log('New service worker found, updating...');
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('New content available, refresh needed');
                // Notify user or auto-refresh
                newWorker.postMessage({type: 'SKIP_WAITING'});
              }
            }
          });
        });
      })
      .catch(function(error) {
        console.log('Service Worker registration failed:', error);
      });
    
    // Listen for service worker messages
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'CACHE_CLEARED') {
        console.log('Cache cleared by service worker');
      }
    });
  }
  
  // Check for mobile devices and implement cache busting
  var isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    console.log('Mobile device detected - implementing cache busting');
    
    // Store current app version
    var currentVersion = window.APP_VERSION;
    var storedVersion = localStorage.getItem('app_version');
    
    // Clear all caches and force refresh for version changes
    if (storedVersion && storedVersion !== currentVersion && storedVersion !== 'undefined') {
      console.log('App version changed from', storedVersion, 'to', currentVersion, '- clearing all caches...');
      localStorage.setItem('app_version', currentVersion);
      
      // Clear service worker caches
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({type: 'CLEAR_CACHE'});
      }
      
      // Clear browser caches
      if ('caches' in window) {
        caches.keys().then(function(names) {
          names.forEach(function(name) {
            caches.delete(name);
          });
        });
      }
      
      // Add a flag to prevent infinite reload loops
      if (!sessionStorage.getItem('version_refresh_done')) {
        sessionStorage.setItem('version_refresh_done', 'true');
        // Force hard reload
        window.location.reload(true);
        return;
      }
    }
    
    // Store current version
    localStorage.setItem('app_version', currentVersion);
    // Clear the refresh flag after successful load
    sessionStorage.removeItem('version_refresh_done');
    
    // Add meta tags to prevent caching on mobile
    var metaElements = [
      { name: 'Cache-Control', content: 'no-cache, no-store, must-revalidate' },
      { name: 'Pragma', content: 'no-cache' },
      { name: 'Expires', content: '0' }
    ];
    
    metaElements.forEach(function(meta) {
      var element = document.createElement('meta');
      element.httpEquiv = meta.name;
      element.content = meta.content;
      document.head.appendChild(element);
    });
  }
  
  // Listen for route changes
  $rootScope.$on('$routeChangeStart', function(event, next, current) {
    // Plan expiry check - redirect to dashboard if expired (except login/register)
    if (next && next.templateUrl) {
      if (!PlanExpiryService.isRouteAllowed(next.templateUrl)) {
        console.log('Plan expired - blocking route:', next.templateUrl);
        event.preventDefault();
        PlanExpiryService.redirectToDashboard();
        return;
      }
    }
    
    if (isMobile && next && next.templateUrl) {
      // Add cache buster to template URLs on mobile using timestamp
      if (next.templateUrl.indexOf('?') === -1) {
        next.templateUrl += '?v=' + Date.now(); // Use timestamp for templates only
      }
    }
  });
});