angular.module('autopostWaApp.groups').controller('GroupsController', function($scope, $location, AuthService, ApiService, NotificationService) {
  // Authentication and navigation
  $scope.isActive = function(path) {
    return $location.path().indexOf(path) === 0;
  };

  // Initialize notification service
  NotificationService.initToast($scope);
  NotificationService.initConfirmModal($scope);

  AuthService.me().then(function(res) {
    $scope.user = res.data.user;
    loadGroups();
  }).catch(function() {
    $location.path('/login');
  });
  
  // Groups functionality
  $scope.groups = [];
  $scope.newGroup = {};
  $scope.groupError = '';
  $scope.createGroupModalVisible = false;
  $scope.syncingGroups = false; // Loading state for sync operation
  
  function loadGroups() {
    ApiService.getGroups()
      .then(function(response) {
        console.log('Groups loaded:', response.data);
        $scope.groups = response.data;
      })
      .catch(function(error) {
        console.error('Error loading groups:', error);
        $scope.groupError = 'Failed to load groups';
      });
  }
  
  $scope.addGroup = function() {
    if (!$scope.newGroup.name || !$scope.newGroup.groupId) {
      $scope.groupError = 'Group name and ID are required';
      return;
    }
    
    ApiService.addGroup($scope.newGroup)
      .then(function(response) {
        console.log('Group added successfully:', response.data);
        $scope.newGroup = {};
        loadGroups();
        $scope.groupError = '';
      })
      .catch(function(error) {
        console.error('Error adding group:', error);
        $scope.groupError = error.data?.error || 'Failed to add group';
      });
  };
  
  $scope.deleteGroup = function(id) {
    NotificationService.showConfirmation($scope, 
      'Confirm Delete',
      'Are you sure you want to delete this group?',
      function() {
        ApiService.deleteGroup(id)
          .then(function() {
            console.log('Group deleted successfully');
            loadGroups();
            NotificationService.showToast($scope, 'Group deleted successfully!', 'success');
          })
          .catch(function(error) {
            console.error('Error deleting group:', error);
            $scope.groupError = 'Failed to delete group';
            NotificationService.showToast($scope, 'Failed to delete group', 'error');
          });
      }
    );
  };

  $scope.showCreateGroupModal = function() {
    $scope.createGroupModalVisible = true;
    $scope.newGroup = {};
    $scope.groupError = '';
  };

  $scope.hideCreateGroupModal = function() {
    $scope.createGroupModalVisible = false;
    $scope.groupError = '';
  };

  $scope.syncGroups = function() {
    $scope.groupError = '';
    $scope.syncingGroups = true; // Start loading
    
    ApiService.syncGroups()
      .then(function(response) {
        loadGroups();
        NotificationService.showToast($scope, 'Groups synced successfully!', 'success');
      })
      .catch(function(error) {
        console.error('Error syncing groups:', error);
        $scope.groupError = error.data?.error || 'Failed to sync groups';
        NotificationService.showToast($scope, 'Failed to sync groups: ' + $scope.groupError, 'error');
      })
      .finally(function() {
        $scope.syncingGroups = false; // Stop loading
      });
  };

  $scope.downloadCSV = function() {
    try {
      ApiService.downloadGroupsCSV();
      NotificationService.showToast($scope, 'CSV download started!', 'success');
    } catch (error) {
      console.error('Error downloading CSV:', error);
      NotificationService.showToast($scope, 'Failed to download CSV', 'error');
    }
  };

  $scope.downloadGroupMembers = function(group) {
    try {
      if (!group || !group.groupId) {
        NotificationService.showToast($scope, 'Invalid group selected', 'error');
        return;
      }
      ApiService.downloadGroupMembersCSV(group.groupId);
      NotificationService.showToast($scope, 'Group members CSV download started!', 'success');
    } catch (error) {
      console.error('Error downloading group members CSV:', error);
      NotificationService.showToast($scope, 'Failed to download group members CSV', 'error');
    }
  };
});