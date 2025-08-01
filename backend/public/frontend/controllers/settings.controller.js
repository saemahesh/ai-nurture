angular.module('autopostWaApp.core').controller('SettingsController', function($scope, $timeout, ApiService) {
  console.log('SettingsController initialized'); // Debug log
  
  // Initialize simple custom toast system
  $scope.customToast = {
    show: false,
    message: '',
    type: 'success'
  };
  
  // Custom toast function with immediate visibility
  $scope.showCustomToast = function(message, type) {
    console.log('Showing custom toast:', message, type);
    
    // Ensure the toast is visible immediately
    $scope.customToast = {
      show: true,
      message: message,
      type: type || 'success'
    };
    
    console.log('Toast state set:', $scope.customToast);
    
    // Auto-hide after 4 seconds
    $timeout(function() {
      console.log('Hiding toast after timeout');
      $scope.customToast.show = false;
    }, 4000);
  };

  // Ultra simple standalone toast function
  $scope.showStandaloneToast = function(message) {
    console.log('Creating standalone toast:', message);
    $scope.standaloneToast = message;
    
    $timeout(function() {
      $scope.standaloneToast = null;
    }, 4000);
  };
  
  $scope.settings = {};
  $scope.successMsg = '';
  $scope.errorMsg = '';
  $scope.saving = false;
  $scope.testing = false;
  $scope.testSuccess = false;
  $scope.saveSuccess = false;
  $scope.testError = '';

  function loadSettings() {
    ApiService.getUserSettings()
      .then(function(res) {
        $scope.settings = res.data;
      })
      .catch(function(err) {
        $scope.errorMsg = 'Failed to load settings';
        $scope.showCustomToast('Failed to load settings', 'error');
      });
  }

  $scope.saveSettings = function() {
    console.log('=== SAVE SETTINGS DEBUG START ===');
    console.log('Form data:', $scope.settings);
    
    // Clear previous states
    $scope.successMsg = '';
    $scope.errorMsg = '';
    $scope.saveSuccess = false;
    $scope.saving = true;
    
    // Validate required fields
    if (!$scope.settings.instance_id || !$scope.settings.access_token || !$scope.settings.wa_phone || !$scope.settings.test_mobile || !$scope.settings.whapi_token) {
      console.log('Validation failed - missing required fields');
      $scope.errorMsg = 'Please fill in all required fields';
      $scope.saving = false;
      return;
    }
    
    console.log('Validation passed, calling API...');
    
    ApiService.saveUserSettings($scope.settings)
      .then(function(res) {
        console.log('✅ Settings saved successfully:', res);
        
        // Use same pattern as test connection
        $scope.saveSuccess = true;
        
        // Auto-hide success message after 5 seconds
        $timeout(function() {
          $scope.saveSuccess = false;
        }, 5000);
        
        console.log('Settings save success notification triggered');
      })
      .catch(function(err) {
        console.error('❌ Settings save error:', err);
        $scope.errorMsg = err.data?.error || 'Failed to save settings';
      })
      .finally(function() {
        console.log('Save settings completed');
        $scope.saving = false;
      });
  };

  $scope.testConnection = function() {
    $scope.testError = '';
    $scope.testSuccess = false;
    $scope.testing = true;
    
    ApiService.testConnection($scope.settings)
      .then(function(res) {
        $scope.testSuccess = true;
        $scope.showCustomToast('Connection test successful!', 'success');
        // Auto-hide success message after 5 seconds
        $timeout(function() {
          $scope.testSuccess = false;
        }, 5000);
      })
      .catch(function(err) {
        $scope.testError = err.data?.error || 'Connection test failed';
        $scope.showCustomToast('Connection test failed: ' + $scope.testError, 'error');
      })
      .finally(function() {
        $scope.testing = false;
      });
  };

  loadSettings();
});
