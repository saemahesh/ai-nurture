angular.module('autopostWaApp.status').controller('StatusController', function($scope, ApiService, NotificationService) {
  // Initialize notification service
  NotificationService.initToast($scope);
  NotificationService.initConfirmModal($scope);

  // Sidebar scroll management - ensure status item is visible
  $scope.ensureSidebarScroll = function() {
    setTimeout(function() {
      var statusNavItem = document.querySelector('a[href="#/status"]');
      var sidebarNav = document.getElementById('desktop-nav');
      
      if (statusNavItem && sidebarNav) {
        var itemOffsetTop = statusNavItem.offsetTop;
        var sidebarHeight = sidebarNav.clientHeight;
        var itemHeight = statusNavItem.offsetHeight;
        
        // Calculate scroll position to show the status item
        var scrollPosition = itemOffsetTop - sidebarHeight + itemHeight + 20;
        
        // Ensure we don't scroll beyond bounds
        scrollPosition = Math.max(0, scrollPosition);
        
        sidebarNav.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  // Auto-scroll sidebar when status page loads
  $scope.$on('$viewContentLoaded', function() {
    $scope.ensureSidebarScroll();
  });

  $scope.$on('$routeChangeSuccess', function(event, current, previous) {
    if (current && current.controller === 'StatusController') {
      $scope.ensureSidebarScroll();
    }
  });

  $scope.status = {
    caption: '',
    textColor: '#000000',
    bgColor: '#ffffff',
    hour: '12',
    minute: '00',
    ampm: 'AM',
    repeat: 'once',
    days: {}
  };
  $scope.days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  $scope.hours = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  $scope.minutes = Array.from({length: 60}, (_, i) => i.toString().padStart(2, '0'));
  $scope.scheduledStatuses = [];
  $scope.saving = false;
  $scope.saveSuccess = false;
  $scope.saveError = '';
  $scope.mediaLibrary = [];
  $scope.createStatusModalVisible = false;
  $scope.editingStatus = null;

  function loadStatuses() {
    ApiService.getStatuses().then(function(res) {
      $scope.scheduledStatuses = res.data.map(function(s) {
        s.timeDisplay = $scope.formatIST(s.time, s.repeat !== 'once');
        s.statusDisplay = $scope.getStatusDisplay(s);
        return s;
      });
    });
  }

  ApiService.getMedia().then(function(res) {
    $scope.mediaLibrary = res.data;
  });

  // Function to get status display text for UI
  $scope.getStatusDisplay = function(status) {
    if (status.repeat === 'once') {
      if (status.posted) {
        return {
          text: 'Sent',
          class: 'bg-green-900/50 text-green-300 border-green-500/30',
          icon: 'fas fa-check-circle'
        };
      } else {
        var scheduledTime = new Date(status.time);
        var now = new Date();
        if (scheduledTime <= now) {
          return {
            text: 'Pending',
            class: 'bg-orange-900/50 text-orange-300 border-orange-500/30',
            icon: 'fas fa-clock'
          };
        } else {
          return {
            text: 'Scheduled',
            class: 'bg-blue-900/50 text-blue-300 border-blue-500/30',
            icon: 'fas fa-calendar-check'
          };
        }
      }
    } else if (status.repeat === 'daily') {
      return {
        text: 'Daily',
        class: 'bg-blue-900/50 text-blue-300 border-blue-500/30',
        icon: 'fas fa-repeat'
      };
    } else if (status.repeat === 'custom') {
      return {
        text: 'Custom',
        class: 'bg-purple-900/50 text-purple-300 border-purple-500/30',
        icon: 'fas fa-calendar-days'
      };
    }
  };

  $scope.getMediaType = function(url) {
    var ext = (url||'').split('.').pop().toLowerCase();
    if(['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image';
    if(['mp4','mov','avi','webm'].includes(ext)) return 'video';
    return '';
  };

  $scope.scheduleStatus = function() {
    $scope.saving = true;
    $scope.saveSuccess = false;
    $scope.saveError = '';
    var data = {
      caption: $scope.status.caption,
      textColor: $scope.status.textColor,
      bgColor: $scope.status.bgColor,
      time: '', // will set below
      repeat: $scope.status.repeat,
      mediaUrl: $scope.status.mediaUrl,
      days: $scope.status.days
    };

    var hour = parseInt($scope.status.hour, 10);
    if ($scope.status.ampm === 'PM' && hour < 12) {
      hour += 12;
    }
    if ($scope.status.ampm === 'AM' && hour === 12) {
      hour = 0;
    }
    var minute = parseInt($scope.status.minute, 10);

    // Since both server and users are in India, no timezone conversion needed
    var selectedTime = new Date();
    selectedTime.setHours(hour, minute, 0, 0);
    
    // Store as ISO string for backend
    data.time = selectedTime.toISOString();

    console.log('Scheduling status for:', selectedTime.toLocaleString('en-IN'));
    console.log('ISO time:', data.time);

    var promise;
    if ($scope.editingStatus) {
      data.id = $scope.editingStatus.id;
      promise = ApiService.updateStatus(data);
    } else {
      promise = ApiService.scheduleStatus(data);
    }

    promise.then(function() {
      $scope.saving = false;
      $scope.saveSuccess = true;
      loadStatuses();
      $scope.hideCreateStatusModal();
    }).catch(function(err) {
      $scope.saving = false;
      $scope.saveError = err.data?.error || 'Failed to schedule status';
    });
  };

  $scope.formatIST = function(dateString, isRecurring) {
    if (!dateString) return 'Not set';
    var date = new Date(dateString);
    var options = {
      timeZone: 'Asia/Kolkata',
      hour12: true,
      hour: 'numeric',
      minute: 'numeric'
    };
    if (!isRecurring) {
      options.year = 'numeric';
      options.month = 'short';
      options.day = 'numeric';
    }
    return date.toLocaleString('en-IN', options);
  };

  $scope.deleteStatus = function(id) {
    NotificationService.showConfirmation($scope,
      'Confirm Delete',
      'Are you sure you want to delete this status?',
      function() {
        ApiService.deleteStatus(id)
          .then(function() {
            loadStatuses();
            NotificationService.showToast($scope, 'Status deleted successfully!', 'success');
          })
          .catch(function(error) {
            console.error('Error deleting status:', error);
            NotificationService.showToast($scope, 'Failed to delete status', 'error');
          });
      }
    );
  };

  $scope.getSelectedDays = function(daysObj) {
    return Object.keys(daysObj).filter(function(day) { return daysObj[day]; }).join(', ');
  };

  $scope.showCreateStatusModal = function() {
    $scope.editingStatus = null;
    $scope.createStatusModalVisible = true;
    var now = new Date();
    var hour = now.getHours();
    var minute = now.getMinutes();
    var ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; // the hour '0' should be '12'
    $scope.status = {
      caption: '',
      textColor: '#000000',
      bgColor: '#ffffff',
      hour: hour.toString().padStart(2, '0'),
      minute: minute.toString().padStart(2, '0'),
      ampm: ampm,
      repeat: 'once',
      days: {},
      mediaUrl: ''
    };

    $scope.saveSuccess = false;
    $scope.saveError = '';
  };

  $scope.editStatus = function(status) {
    $scope.editingStatus = status;
    $scope.createStatusModalVisible = true;
    
    // Since both server and users are in India, no timezone conversion needed
    var time = new Date(status.time);
    var hour = time.getHours();
    var minute = time.getMinutes();
    var ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; // the hour '0' should be '12'
    
    // Find the selected media object from media library
    var selectedMedia = null;
    if (status.media) {
      selectedMedia = $scope.mediaLibrary.find(function(media) {
        return media.url === status.media;
      });
    }
    
    $scope.status = {
      caption: status.caption,
      textColor: status.textColor,
      bgColor: status.bgColor,
      hour: hour.toString().padStart(2, '0'),
      minute: minute.toString().padStart(2, '0'),
      ampm: ampm,
      repeat: status.repeat,
      days: angular.copy(status.days),
      mediaUrl: status.media,
      selectedMedia: selectedMedia
    };
    $scope.saveSuccess = false;
    $scope.saveError = '';
  };

  $scope.hideCreateStatusModal = function() {
    $scope.createStatusModalVisible = false;
    $scope.editingStatus = null;
    $scope.status = {
      caption: '',
      textColor: '#000000',
      bgColor: '#ffffff',
      hour: '12',
      minute: '00',
      ampm: 'AM',
      repeat: 'once',
      days: {},
      mediaUrl: '',
      selectedMedia: null
    };
    $scope.saveSuccess = false;
    $scope.saveError = '';
  };

  // Media selector functions (like group schedule)
  $scope.showMediaSelector = false;
  $scope.loadingMedia = false;

  $scope.openMediaSelector = function() {
    $scope.showMediaSelector = true;
    $scope.loadingMedia = true;
    // Reload media library
    ApiService.getMedia().then(function(res) {
      $scope.mediaLibrary = res.data;
      $scope.loadingMedia = false;
    }).catch(function() {
      $scope.loadingMedia = false;
    });
  };

  $scope.closeMediaSelector = function() {
    $scope.showMediaSelector = false;
  };

  $scope.selectMediaForStatus = function(media) {
    $scope.status.selectedMedia = media;
    $scope.status.mediaUrl = media.url;
    $scope.closeMediaSelector();
  };

  $scope.removeSelectedMedia = function() {
    $scope.status.selectedMedia = null;
    $scope.status.mediaUrl = '';
  };

  $scope.getImageUrl = function(url) {
    if (!url) return '';
    
    // Check if we're in development environment (localhost)
    var isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.includes('local');
    
    // If URL is relative or starts with /uploads/, prepend localhost for development
    if (isDevelopment && (url.startsWith('/uploads/') || url.startsWith('uploads/'))) {
      return 'http://localhost:3000/' + url.replace(/^\//, '');
    }
    
    return url;
  };

  $scope.getSelectedDays = function(days) {
    if (!days) return '';
    return Object.keys(days).filter(function(day) {
      return days[day];
    }).join(', ');
  };

  loadStatuses();
});

// File input directive
angular.module('autopostWaApp').directive('fileModel', ['$parse', function ($parse) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var model = $parse(attrs.fileModel);
      element.bind('change', function(){
        scope.$apply(function(){
          model.assign(scope, element[0].files[0]);
        });
      });
    }
  };
}]);
