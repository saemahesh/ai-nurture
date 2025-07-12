angular.module('autopostWaApp').controller('SettingsController', function($scope, ApiService) {
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
      });
  }

  $scope.saveSettings = function() {
    $scope.successMsg = '';
    $scope.errorMsg = '';
    ApiService.saveUserSettings($scope.settings)
      .then(function(res) {
        $scope.successMsg = 'Settings saved successfully!';
      })
      .catch(function(err) {
        $scope.errorMsg = err.data?.error || 'Failed to save settings';
      });
  };

  loadSettings();
});
