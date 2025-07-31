angular.module('autopostWaApp.dashboard')
  .controller('DashboardController', function($scope, $location, AuthService, ApiService, PlanExpiryService) {
  $scope.isActive = function(path) {
    return $location.path().indexOf(path) === 0;
  };

  AuthService.me().then(function(res) {
    $scope.user = res.data.user;
    loadAll();
  }).catch(function() {
    $location.path('/login');
  });

  $scope.users = [];
  $scope.userFilter = '';
  $scope.selectedStatus = '';
  $scope.expired = false;
  $scope.accessCountdown = '';
  $scope.expirationDate = '';

  // Update expired status from PlanExpiryService
  $scope.$watch(function() {
    return PlanExpiryService.isExpired;
  }, function(newVal) {
    $scope.expired = newVal;
  });

  function loadAll() {
    ApiService.getGroups().then(function(res) {
      $scope.groups = res.data;
    });
    ApiService.getSchedules().then(function(res) {
      $scope.schedules = res.data.sort((a, b) => new Date(b.time) - new Date(a.time));
      // Calculate group schedules (schedules with groupId that are not event reminders)
      $scope.groupSchedules = $scope.schedules.filter(schedule => 
        schedule.groupId && !schedule.eventId && !schedule.reminderType
      );
    });
    ApiService.getMedia().then(function(res) {
      $scope.media = res.data;
    });
    
    // Load additional data for new dashboard cards
    ApiService.getEvents().then(function(res) {
      $scope.events = res.data || [];
    }).catch(function() {
      $scope.events = [];
    });
    
    ApiService.getSequences().then(function(res) {
      $scope.sequences = res.data || [];
    }).catch(function() {
      $scope.sequences = [];
    });
    
    ApiService.getStatuses().then(function(res) {
      $scope.statuses = res.data || [];
    }).catch(function() {
      $scope.statuses = [];
    });
    
    ApiService.getDirectSchedules().then(function(res) {
      $scope.directSchedules = res.data || [];
    }).catch(function() {
      $scope.directSchedules = [];
    });
    
    ApiService.getUsers().then(function(res) {
      $scope.users = res.data;
      if ($scope.user) {
        var me = $scope.users.find(u => u.username === $scope.user.username);
        if (me) {
          $scope.expirationDate = me.expirationDate;
          var isExpired = me.status !== 'active' || (me.expirationDate && new Date(me.expirationDate) < new Date());
          
          // Update PlanExpiryService with current expiry status
          PlanExpiryService.setExpiryStatus(isExpired);
          
          $scope.accessCountdown = getCountdown(me.expirationDate);
        }
      }
    });
  }

  $scope.approveUser = function(username) {
    ApiService.approveUser(username).then(loadAll);
  };
  $scope.denyUser = function(username) {
    ApiService.denyUser(username).then(loadAll);
  };
  $scope.setExpiration = function(username, date) {
    ApiService.updateUserExpiration(username, date).then(loadAll);
  };

  $scope.filterUsers = function(user) {
    var matches = true;
    if ($scope.userFilter) {
      matches = user.username.toLowerCase().includes($scope.userFilter.toLowerCase());
    }
    if ($scope.selectedStatus) {
      matches = matches && user.status === $scope.selectedStatus;
    }
    return matches;
  };

  function getCountdown(expirationDate) {
    if (!expirationDate) return '';
    var now = new Date();
    var exp = new Date(expirationDate);
    var diff = exp - now;
    if (diff <= 0) return 'Expired';
    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days + ' day' + (days !== 1 ? 's' : '') + ' left';
  }

  $scope.getCountdown = getCountdown;
});

angular.module('autopostWaApp.dashboard')
  .controller('HeaderUserController', function($scope, $location, AuthService) {
    $scope.showUserMenu = false;
    $scope.logout = function() {
      AuthService.logout().then(function() {
        $location.path('/login');
      });
    };
    // Close menu on outside click
    document.addEventListener('click', function(e) {
      if (!$scope.showUserMenu) return;
      var menu = document.querySelector('.relative .absolute');
      var btn = document.querySelector('.relative button');
      if (menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
        $scope.$apply(function() { $scope.showUserMenu = false; });
      }
    });
  });
