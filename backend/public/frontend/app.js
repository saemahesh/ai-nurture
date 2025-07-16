// Core application module
angular.module('autopostWaApp.core', []);

// Add app version - ONLY change this when you deploy new code
const APP_VERSION = '1.0.1'; // Static version - increment manually when deploying
window.APP_VERSION = APP_VERSION;

// Features modules
angular.module('autopostWaApp.auth', ['autopostWaApp.core']);
angular.module('autopostWaApp.dashboard', ['autopostWaApp.core']);
angular.module('autopostWaApp.groups', ['autopostWaApp.core']);
angular.module('autopostWaApp.events', ['autopostWaApp.core']);
angular.module('autopostWaApp.media', ['autopostWaApp.core']);
angular.module('autopostWaApp.schedules', ['autopostWaApp.core']);
angular.module('autopostWaApp.sequences', ['autopostWaApp.core']);
angular.module('autopostWaApp.status', ['autopostWaApp.core']);

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
  'autopostWaApp.status'
]);

// Main routing configuration
app.config(function($routeProvider, $locationProvider, $httpProvider) {
  $routeProvider
    .when('/login', {
      templateUrl: 'login.html',
      controller: 'AuthController'
    })
    .when('/register', {
      templateUrl: 'register.html',
      controller: 'AuthController'
    })
    .when('/dashboard', {
      templateUrl: 'dashboard.html',
      controller: 'DashboardController'
    })
    .when('/groups/create', {
      templateUrl: 'group-create.html',
      controller: 'GroupCreateController'
    })
    .when('/automation/schedule', {
      templateUrl: 'automation-schedule.html',
      controller: 'AutomationScheduleController'
    })
    .when('/groups', {
      templateUrl: 'groups.html',
      controller: 'GroupsController'  // Fixed from GroupsPageController
    })
    .when('/schedules', {
      templateUrl: 'schedules.html',
      controller: 'ScheduleController'  // Fixed from SchedulesPageController
    })
    .when('/events', {
      templateUrl: 'events.html',
      controller: 'EventsController'  // Fixed from EventsPageController
    })
    .when('/event-reminders', {
      templateUrl: 'event-reminders.html',
      controller: 'EventRemindersController'
    })
    .when('/event-reminders/:id', {
      templateUrl: 'event-reminders.html',
      controller: 'EventRemindersController'
    })
    .when('/media', {
      templateUrl: 'media.html',
      controller: 'MediaPageController'
    })
    .when('/users', {
      templateUrl: 'users.html',
      controller: 'DashboardController'
    })
    .when('/settings', {
      templateUrl: 'settings.html',
      controller: 'SettingsController'
    })
    .when('/direct-schedule', {
      templateUrl: 'direct-schedule.html',
      controller: 'DirectScheduleController'
    })
    .when('/sequences', {
      templateUrl: 'sequences.html',
      controller: 'SequencesController'
    })
    .when('/sequences/create', {
      templateUrl: 'sequence-create.html',
      controller: 'SequenceCreateController'
    })
    .when('/sequence-create', {
      templateUrl: 'sequence-create.html',
      controller: 'SequenceCreateController'
    })
    .when('/sequence-create/:id', {
      templateUrl: 'sequence-create.html',
      controller: 'SequenceCreateController'
    })
    .when('/enrollments/:sequenceId', {
      templateUrl: 'enrollments.html',
      controller: 'EnrollmentsController'
    })
    .when('/campaigns', {
      redirectTo: '/sequences'
    })
    .when('/status', {
      templateUrl: 'status.html',
      controller: 'StatusController'
    })

    .otherwise({ redirectTo: '/login' });
  $locationProvider.hashPrefix('');

  $httpProvider.interceptors.push(function($q, $location) {
    return {
      responseError: function(rejection) {
        if (rejection.status === 401) {
          // Only redirect to login for critical endpoints, not for optional ones like media list
          const url = rejection.config.url;
          const isOptionalEndpoint = url.includes('/media/list') || url.includes('/uploads/');
          
          if (!isOptionalEndpoint) {
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
    }, function(err) {
      $scope.saving = false;
      $scope.saveError = err.data && err.data.error ? err.data.error : 'Failed to save settings';
    });
  };

  $scope.openTestPopup = function() {
    $scope.testMobile = '';
    $scope.testResult = null;
    $scope.showTestPopup = true;
  };

  $scope.closeTestPopup = function() {
    $scope.showTestPopup = false;
    $scope.testMobile = '';
  };

  $scope.testConnection = function() {
    if (!$scope.settings.test_mobile || !$scope.settings.test_mobile.trim()) {
      $scope.testResult = { success: false, message: 'Please enter a test mobile number.' };
      return;
    }
    if (!$scope.settings.access_token || !$scope.settings.instance_id || !$scope.settings.wa_phone) {
      $scope.testResult = { success: false, message: 'Please fill all required fields and save first.' };
      return;
    }
    $scope.testingConn = true;
    $http({
      method: 'POST',
      url: 'https://wa.robomate.in/api/send',
      headers: { 'Content-Type': 'application/json' },
      data: {
        number: $scope.settings.test_mobile,
        type: 'text',
        message: 'WhatsApp API connection is working! You are ready to go! 🚀',
        instance_id: $scope.settings.instance_id,
        access_token: $scope.settings.access_token
      }
    }).then(function(res) {
      $scope.testingConn = false;
      $scope.testResult = { success: true, message: 'Connected successfully! Check ' + $scope.settings.test_mobile + '.' };
    }, function(err) {
      $scope.testingConn = false;
      var msg = (err.data && err.data.message) ? err.data.message : 'Failed to send test message.';
      $scope.testResult = { success: false, message: msg };
    });
  };

  loadSettings();
})

// App run block for cache busting and mobile optimization
app.run(function($rootScope, $location, $timeout) {
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
    
    // Only force refresh if stored version exists and is different (not on first load)
    if (storedVersion && storedVersion !== currentVersion && storedVersion !== 'undefined') {
      console.log('App version changed from', storedVersion, 'to', currentVersion, '- forcing refresh...');
      localStorage.setItem('app_version', currentVersion);
      // Add a flag to prevent infinite reload loops
      if (!sessionStorage.getItem('version_refresh_done')) {
        sessionStorage.setItem('version_refresh_done', 'true');
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
    if (isMobile && next && next.templateUrl) {
      // Add cache buster to template URLs on mobile using timestamp
      if (next.templateUrl.indexOf('?') === -1) {
        next.templateUrl += '?v=' + Date.now(); // Use timestamp for templates only
      }
    }
  });
});