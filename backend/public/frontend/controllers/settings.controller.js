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
  
  // Calendly specific variables
  $scope.testingCalendly = false;
  $scope.calendlyTestResult = null;
  $scope.showNotificationTemplates = false;

  // Email specific variables
  $scope.emailSettings = {};
  $scope.testingEmail = false;
  $scope.sendingTest = false;
  $scope.emailTestResult = null;
  $scope.emailProviders = {};
  $scope.selectedProvider = {};

  function loadSettings() {
    ApiService.getUserSettings()
      .then(function(res) {
        $scope.settings = res.data;
        
        // Initialize Calendly notifications if not present
        if (!$scope.settings.calendly_notifications) {
          $scope.settings.calendly_notifications = {
            enabled: true,
            booking_confirmation: {
              enabled: true,
              message: "🎉 Congratulations {{invitee_name}}! Your meeting '{{meeting_name}}' has been booked for {{meeting_date}} at {{meeting_time}}. We look forward to connecting with you!"
            },
            five_days_reminder: {
              enabled: true,
              message: "📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting '{{meeting_name}}' scheduled in 5 days on {{meeting_date}} at {{meeting_time}}."
            },
            four_days_reminder: {
              enabled: true,
              message: "📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting '{{meeting_name}}' scheduled in 4 days on {{meeting_date}} at {{meeting_time}}."
            },
            three_days_reminder: {
              enabled: true,
              message: "📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting '{{meeting_name}}' scheduled in 3 days on {{meeting_date}} at {{meeting_time}}."
            },
            two_days_reminder: {
              enabled: true,
              message: "📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting '{{meeting_name}}' scheduled in 2 days on {{meeting_date}} at {{meeting_time}}."
            },
            one_day_reminder: {
              enabled: true,
              message: "📅 Hi {{invitee_name}}, this is a friendly reminder that you have a meeting '{{meeting_name}}' scheduled tomorrow on {{meeting_date}} at {{meeting_time}}."
            },
            twelve_hours_reminder: {
              enabled: true,
              message: "⏰ Hi {{invitee_name}}, your meeting '{{meeting_name}}' is in 12 hours! It's scheduled for {{meeting_date}} at {{meeting_time}}."
            },
            six_hours_reminder: {
              enabled: true,
              message: "⏰ Hi {{invitee_name}}, your meeting '{{meeting_name}}' is in 6 hours! It's scheduled for {{meeting_date}} at {{meeting_time}}."
            },
            three_hours_reminder: {
              enabled: true,
              message: "⏰ Hi {{invitee_name}}, your meeting '{{meeting_name}}' is in 3 hours! It's scheduled for {{meeting_date}} at {{meeting_time}}."
            },
            one_hour_reminder: {
              enabled: true,
              message: "⏰ Hi {{invitee_name}}, your meeting '{{meeting_name}}' is in 1 hour! It's scheduled for {{meeting_date}} at {{meeting_time}}."
            },
            five_minutes_reminder: {
              enabled: true,
              message: "🚨 Hi {{invitee_name}}, your meeting '{{meeting_name}}' is starting in 5 minutes! {{join_url}}"
            },
            meeting_live: {
              enabled: true,
              message: "🎥 Hi {{invitee_name}}, your meeting '{{meeting_name}}' is now live! Please join: {{join_url}}"
            },
            post_meeting_thanks: {
              enabled: true,
              message: "🙏 Thank you {{invitee_name}} for attending the meeting '{{meeting_name}}'! We hope it was valuable. Feel free to reach out if you have any questions."
            }
          };
        }
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
        
        console.log('✅ All settings including Calendly token saved successfully');
        
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

  // Test Calendly sync
  $scope.testCalendlySync = function() {
    $scope.testingCalendly = true;
    $scope.calendlyTestResult = null;
    
    // First save the token
    var calendlySettings = {
      calendly_token: $scope.settings.calendly_token,
      calendly_sync_enabled: $scope.settings.calendly_sync_enabled,
      calendly_notifications: $scope.settings.calendly_notifications
    };
    
    ApiService.calendlyUpdateSettings(calendlySettings)
      .then(function() {
        // Then test sync
        return ApiService.calendlySyncMeetings();
      })
      .then(function(response) {
        $scope.calendlyTestResult = {
          success: true,
          message: `Success! Found ${response.data.newMeetings} new meetings (${response.data.totalMeetings} total)`
        };
      })
      .catch(function(error) {
        $scope.calendlyTestResult = {
          success: false,
          message: error.data?.error || 'Test failed'
        };
      })
      .finally(function() {
        $scope.testingCalendly = false;
      });
  };

  // Email Configuration Functions
  function loadEmailProviders() {
    ApiService.get('/api/email/providers')
      .then(function(response) {
        $scope.emailProviders = response.data.providers;
      })
      .catch(function(error) {
        console.error('Failed to load email providers:', error);
      });
  }

  function loadEmailSettings() {
    ApiService.get('/api/email/settings')
      .then(function(response) {
        if (response.data.success) {
          $scope.emailSettings = response.data.settings || {};
          if ($scope.emailSettings.provider) {
            $scope.selectedProvider = $scope.emailProviders[$scope.emailSettings.provider] || {};
          }
        }
      })
      .catch(function(error) {
        console.error('Failed to load email settings:', error);
      });
  }

  $scope.onProviderChange = function() {
    if ($scope.emailSettings.provider && $scope.emailProviders[$scope.emailSettings.provider]) {
      $scope.selectedProvider = $scope.emailProviders[$scope.emailSettings.provider];
      
      // Auto-fill SMTP settings based on provider
      if ($scope.selectedProvider.smtpServer) {
        $scope.emailSettings.smtpServer = $scope.selectedProvider.smtpServer;
        $scope.emailSettings.smtpPort = $scope.selectedProvider.smtpPort;
      }
    } else {
      $scope.selectedProvider = {};
    }
  };

  $scope.testEmailConnection = function() {
    $scope.testingEmail = true;
    $scope.emailTestResult = null;

    // First save settings, then test
    $scope.saveEmailSettings().then(function() {
      return ApiService.post('/api/email/test', {});
    })
    .then(function(response) {
      $scope.emailTestResult = response.data;
    })
    .catch(function(error) {
      $scope.emailTestResult = {
        success: false,
        message: error.data?.message || 'Connection test failed'
      };
    })
    .finally(function() {
      $scope.testingEmail = false;
    });
  };

  $scope.sendTestEmail = function() {
    if (!$scope.emailSettings.email) {
      $scope.emailTestResult = {
        success: false,
        message: 'Please enter your email address first'
      };
      return;
    }

    $scope.sendingTest = true;
    $scope.emailTestResult = null;

    // First save settings, then send test email
    $scope.saveEmailSettings().then(function() {
      return ApiService.post('/api/email/send-test', {
        to: $scope.emailSettings.email
      });
    })
    .then(function(response) {
      $scope.emailTestResult = response.data;
    })
    .catch(function(error) {
      $scope.emailTestResult = {
        success: false,
        message: error.data?.message || 'Test email failed'
      };
    })
    .finally(function() {
      $scope.sendingTest = false;
    });
  };

  $scope.saveEmailSettings = function() {
    return ApiService.post('/api/email/settings', $scope.emailSettings)
      .then(function(response) {
        if (response.data.success) {
          $scope.showCustomToast('Email settings saved successfully', 'success');
          return response;
        } else {
          throw new Error(response.data.message || 'Failed to save email settings');
        }
      })
      .catch(function(error) {
        $scope.showCustomToast('Failed to save email settings: ' + (error.data?.message || error.message), 'error');
        throw error;
      });
  };

  // Update the main saveSettings function to also save email settings
  var originalSaveSettings = $scope.saveSettings;
  $scope.saveSettings = function() {
    console.log('=== SAVE SETTINGS DEBUG START (with Email) ===');
    
    // Save email settings first if they exist
    var emailPromise = Promise.resolve();
    if ($scope.emailSettings && ($scope.emailSettings.email || $scope.emailSettings.provider)) {
      emailPromise = $scope.saveEmailSettings().catch(function(error) {
        console.warn('Email settings save failed, continuing with other settings:', error);
      });
    }

    // Then save other settings
    emailPromise.then(function() {
      originalSaveSettings();
    });
  };

  // Initialize email settings
  loadEmailProviders();
  
  // Load email settings after a short delay to ensure providers are loaded
  $timeout(function() {
    loadEmailSettings();
  }, 100);

  loadSettings();
});
