angular.module('autopostWaApp').controller('SettingsController', function($scope, ApiService, NotificationService) {
  // Initialize notification service
  NotificationService.initToast($scope);
  
  $scope.settings = {};
  $scope.successMsg = '';
  $scope.errorMsg = '';

  function loadSettings() {
    ApiService.getUserSettings()
      .then(function(res) {
        $scope.settings = res.data;
      })
      .catch(function(err) {
        $scope.errorMsg = 'Failed to load settings';
        NotificationService.showToast($scope, 'Failed to load settings', 'error');
      });
  }

  $scope.saveSettings = function() {
    $scope.successMsg = '';
    $scope.errorMsg = '';
    ApiService.saveUserSettings($scope.settings)
      .then(function(res) {
        $scope.successMsg = 'Settings saved successfully!';
        NotificationService.showToast($scope, 'Settings saved successfully!', 'success');
      })
      .catch(function(err) {
        $scope.errorMsg = err.data?.error || 'Failed to save settings';
        NotificationService.showToast($scope, 'Failed to save settings', 'error');
      });
  };

  loadSettings();
});
