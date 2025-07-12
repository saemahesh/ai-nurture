angular.module('autopostWaApp.events').controller('EventsController', function($scope, $location, AuthService, ApiService) {
  // Authentication and navigation
  $scope.isActive = function(path) {
    return $location.path().indexOf(path) === 0;
  };

  AuthService.me().then(function(res) {
    $scope.user = res.data.user;
    loadData();
  }).catch(function() {
    $location.path('/login');
  });

  $scope.logout = function() {
    AuthService.logout().then(function() {
      $location.path('/login');
    });
  };
  
  // Event functionality
  $scope.groups = [];
  $scope.events = [];
  $scope.newEvent = {};
  $scope.eventError = '';
  
  // Edit event functionality
  $scope.editingEvent = null;
  $scope.editEventData = {};
  $scope.editEventError = '';
  
  $scope.createEventModalVisible = false;
  $scope.showCreateEventModal = function() {
    $scope.createEventModalVisible = true;
    $scope.eventData = {};
    $scope.eventError = '';
    $scope.groups.forEach(function(g) { g.selected = false; });
  };
  $scope.hideCreateEventModal = function() {
    $scope.createEventModalVisible = false;
    $scope.eventError = '';
    $scope.groups.forEach(function(g) { g.selected = false; });
  };

  function loadData() {
    ApiService.getGroups().then(function(res) {
      $scope.groups = res.data.map(function(group) {
        return { ...group, selected: false };
      });
    });
    
    ApiService.getEvents().then(function(res) {
      $scope.events = res.data;
    });
  }
  
  $scope.hasSelectedGroups = function() {
    return $scope.groups.some(function(g) {
      return g.selected;
    });
  };

  $scope.saveEvent = function() {
    $scope.eventError = '';
    
    if (!$scope.eventData.name || !$scope.eventData.time) {
      $scope.eventError = 'Event name and time are required';
      return;
    }
    
    if (!$scope.hasSelectedGroups()) {
      $scope.eventError = 'Please select at least one group';
      return;
    }
    
    var selectedGroupIds = $scope.groups
      .filter(function(g) { return g.selected; })
      .map(function(g) { return g.groupId; });
    
    var eventData = {
      name: $scope.eventData.name,
      description: $scope.eventData.description || '',
      time: new Date($scope.eventData.time).toISOString(),
      groups: selectedGroupIds
    };
    
    if ($scope.editingEvent) {
      ApiService.updateEvent($scope.editingEvent.id, eventData)
        .then(function(response) {
          console.log("Event updated successfully:", response.data);
          $scope.eventData = {};
          $scope.editingEvent = null;
          $scope.groups.forEach(function(g) {
            g.selected = false;
          });
          loadData();
        })
        .catch(function(err) {
          console.error('Event update error:', err);
          $scope.eventError = err.data && err.data.error 
            ? err.data.error 
            : 'Failed to update event';
        });
    } else {
      ApiService.addEvent(eventData)
        .then(function(response) {
          console.log("Event created successfully:", response.data);
          $scope.eventData = {};
          $scope.groups.forEach(function(g) {
            g.selected = false;
          });
          loadData();
        })
        .catch(function(err) {
          console.error('Event creation error:', err);
          $scope.eventError = err.data && err.data.error 
            ? err.data.error 
            : 'Failed to create event';
        });
    }
  };
  
  $scope.editEvent = function(event) {
    $scope.editingEvent = event;
    $scope.eventData = {
      name: event.name,
      description: event.description || '',
      time: new Date(event.time)
    };
    
    $scope.groups.forEach(function(g) {
      g.selected = event.groups.includes(g.groupId);
    });
  };
  
  $scope.cancelEdit = function() {
    $scope.editingEvent = null;
    $scope.eventData = {};
    $scope.groups.forEach(function(g) {
      g.selected = false;
    });
  };
  
  $scope.deleteEvent = function(id) {
    if (confirm('Are you sure you want to delete this event? All associated reminders will also be deleted.')) {
      ApiService.deleteEvent(id)
        .then(function() {
          loadData();
        })
        .catch(function(err) {
          alert('Failed to delete event: ' + (err.data && err.data.error ? err.data.error : 'Unknown error'));
        });
    }
  };
});
