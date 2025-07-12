angular.module('autopostWaApp.groups').controller('GroupsController', function($scope, $location, AuthService, ApiService) {
  // Authentication and navigation
  $scope.isActive = function(path) {
    return $location.path().indexOf(path) === 0;
  };

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
    if (confirm('Are you sure you want to delete this group?')) {
      ApiService.deleteGroup(id)
        .then(function() {
          console.log('Group deleted successfully');
          loadGroups();
        })
        .catch(function(error) {
          console.error('Error deleting group:', error);
          $scope.groupError = 'Failed to delete group';
        });
    }
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
});