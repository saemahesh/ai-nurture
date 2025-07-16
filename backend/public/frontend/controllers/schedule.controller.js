angular.module('autopostWaApp.schedules').controller('ScheduleController', function($scope, $location, AuthService, ApiService) {
  // Authentication and navigation
  $scope.isActive = function(path) {
    return $location.path().indexOf(path) === 0;
  };

  // Load user data and authentication check
  AuthService.me().then(function(res) {
    $scope.user = res.data.user;
    loadSchedules();
  }).catch(function() {
    $location.path('/login');
  });
  
  // Schedules functionality
  $scope.schedules = [];
  $scope.groups = [];
  $scope.loading = true;
  $scope.error = '';
  $scope.success = '';

  // Load groups for group selection in schedule form
  function loadGroups() {
    ApiService.getGroups()
      .then(function(response) {
        $scope.groups = response.data;
      })
      .catch(function(error) {
        console.error('Error loading groups:', error);
        $scope.groups = [];
      });
  }

  function loadSchedules() {
    $scope.loading = true;
    ApiService.getSchedules()
      .then(function(response) {
        console.log('Schedules loaded:', response.data);
        $scope.schedules = response.data;
        $scope.loading = false;
      })
      .catch(function(error) {
        console.error('Error loading schedules:', error);
        $scope.error = 'Failed to load schedules';
        $scope.loading = false;
      });
  }

  // Load groups when controller initializes
  loadGroups();
  
  // Initialize new schedule form
  $scope.newSchedule = {
    name: '',
    message: '',
    time: '',
    imageMethod: 'library', // Default to media library
    selectedMedia: null,
    imageUrl: ''
  };
  $scope.scheduleError = '';
  
  // Media library functionality
  $scope.mediaLibrary = [];
  $scope.showMediaSelector = false;
  $scope.loadingMedia = false;
  
  // Load media library
  $scope.loadMediaLibrary = function() {
    $scope.loadingMedia = true;
    ApiService.getMedia().then(function(response) {
      $scope.mediaLibrary = response.data;
      console.log('Loaded media library:', response.data);
      $scope.loadingMedia = false;
    }).catch(function(error) {
      console.error('Error loading media library:', error);
      $scope.loadingMedia = false;
    });
  };

  // Open media selector
  $scope.openMediaSelector = function() {
    $scope.showMediaSelector = true;
    $scope.loadMediaLibrary();
  };

  // Open media selector for edit mode
  $scope.openMediaSelectorForEdit = function() {
    $scope.editingForMedia = true;
    $scope.showMediaSelector = true;
    $scope.loadMediaLibrary();
  };

  // Close media selector
  $scope.closeMediaSelector = function() {
    $scope.showMediaSelector = false;
    $scope.editingForMedia = false;
  };

  // Select media for schedule
  $scope.selectMediaForSchedule = function(media) {
    console.log('Selected media:', media);
    if ($scope.editingForMedia) {
      $scope.editScheduleData.selectedMedia = media;
      $scope.editScheduleData.imageUrl = ''; // Clear URL field when selecting from library
    } else {
      $scope.newSchedule.selectedMedia = media;
      $scope.newSchedule.imageUrl = ''; // Clear URL field when selecting from library
    }
    $scope.closeMediaSelector();
  };

  // Clear selected media
  $scope.clearSelectedMedia = function() {
    $scope.newSchedule.selectedMedia = null;
  };

  // Clear selected media for edit
  $scope.clearSelectedMediaForEdit = function() {
    $scope.editScheduleData.selectedMedia = null;
  };
  
  // Check if any groups are selected
  $scope.hasSelectedGroups = function() {
    return $scope.groups && $scope.groups.some(function(group) {
      return group.selected;
    });
  };
  
  // Add new schedule
  $scope.addSchedule = function() {
    // Mark form as submitted for validation display
    $scope.scheduleForm.$setSubmitted();
    
    // Reset error
    $scope.scheduleError = '';
    
    // Force validation display with timeout to ensure form state is updated
    setTimeout(function() {
      $scope.$apply();
    }, 10);
    
    // Validate form
    if (!$scope.newSchedule.message || !$scope.newSchedule.time) {
      $scope.scheduleError = 'Please fill in all required fields';
      return;
    }
    
    if (!$scope.hasSelectedGroups()) {
      $scope.scheduleError = 'Please select at least one group';
      return;
    }
    
    // Note: Image is optional, so no validation needed for it
    
    // Get selected groups
    var selectedGroups = $scope.groups.filter(function(group) {
      return group.selected;
    });
    
    // Prepare form data with groupIds array
    var formData = new FormData();
    if ($scope.newSchedule.name) {
      formData.append('name', $scope.newSchedule.name);
    }
    formData.append('message', $scope.newSchedule.message);
    formData.append('time', $scope.newSchedule.time);
    
    // Send groupIds as an array (backend expects this)
    var groupIds = selectedGroups.map(function(group) {
      return group.groupId; // Use groupId (with @g.us) instead of id
    });
    formData.append('groupIds', JSON.stringify(groupIds));
    
    // Handle media - either library selection or URL
    if ($scope.newSchedule.imageMethod === 'library' && $scope.newSchedule.selectedMedia) {
      formData.append('imageUrl', $scope.newSchedule.selectedMedia.url);
    } else if ($scope.newSchedule.imageMethod === 'url' && $scope.newSchedule.imageUrl) {
      formData.append('imageUrl', $scope.newSchedule.imageUrl);
    }
    
    // Send single request with all groups
    ApiService.addSchedule(formData)
      .then(function() {
        // Reset form
        $scope.newSchedule = {
          name: '',
          message: '',
          time: '',
          imageMethod: 'library',
          selectedMedia: null,
          imageUrl: ''
        };
        
        // Reset group selections
        $scope.groups.forEach(function(group) {
          group.selected = false;
        });
        
        // Reset form validation
        $scope.scheduleForm.$setPristine();
        $scope.scheduleForm.$setUntouched();
        
        // Reload schedules
        loadSchedules();
        $scope.success = 'Schedule(s) added successfully';
      })
      .catch(function(error) {
        console.error('Error adding schedule:', error);
        $scope.scheduleError = 'Failed to add schedule. Please try again.';
      });
  };
  
  $scope.deleteSchedule = function(id) {
    if (confirm('Are you sure you want to delete this schedule?')) {
      ApiService.deleteSchedule(id)
        .then(function() {
          loadSchedules();
          $scope.success = 'Schedule deleted successfully';
        })
        .catch(function(error) {
          console.error('Error deleting schedule:', error);
          $scope.error = 'Failed to delete schedule';
        });
    }
  };

  // Logout functionality
  $scope.logout = function() {
    AuthService.logout().then(function() {
      $location.path('/login');
    }).catch(function(error) {
      console.error('Logout failed:', error);
      $scope.error = 'Logout failed. Please try again.';
    });
  };
  
  // Image popup functionality
  $scope.imagePopupVisible = false;
  $scope.popupImageUrl = '';
  
  $scope.showImagePopup = function(imageUrl) {
    $scope.popupImageUrl = imageUrl;
    $scope.imagePopupVisible = true;
  };
  
  $scope.hideImagePopup = function() {
    $scope.imagePopupVisible = false;
    $scope.popupImageUrl = '';
  };
  
  // Edit schedule functionality
  $scope.editingSchedule = false;
  $scope.editScheduleData = {};
  $scope.editScheduleError = '';
  $scope.editingForMedia = false;
  
  $scope.showEditModal = function(schedule) {
    $scope.editingSchedule = true;
    $scope.editScheduleData = {
      id: schedule.id,
      name: schedule.name,
      message: schedule.message,
      time: new Date(schedule.time).toISOString().slice(0, 16), // Format for datetime-local input
      groupId: schedule.groupId,
      currentMediaUrl: schedule.media,
      imageMethod: 'library', // Default to media library
      selectedMedia: null,
      imageUrl: ''
    };
    $scope.editScheduleError = '';
  };
  
  $scope.hideEditModal = function() {
    $scope.editingSchedule = false;
    $scope.editScheduleData = {};
    $scope.editScheduleError = '';
  };
  
  $scope.saveEditedSchedule = function() {
    $scope.editScheduleError = '';
    
    if (!$scope.editScheduleData.message || !$scope.editScheduleData.time || !$scope.editScheduleData.groupId) {
      $scope.editScheduleError = 'Please fill in all required fields';
      return;
    }
    
    var formData = new FormData();
    if ($scope.editScheduleData.name) {
      formData.append('name', $scope.editScheduleData.name);
    }
    formData.append('message', $scope.editScheduleData.message);
    formData.append('time', $scope.editScheduleData.time);
    formData.append('groupId', $scope.editScheduleData.groupId);
    
    // Handle media - either library selection or URL
    if ($scope.editScheduleData.imageMethod === 'library' && $scope.editScheduleData.selectedMedia) {
      formData.append('imageUrl', $scope.editScheduleData.selectedMedia.url);
    } else if ($scope.editScheduleData.imageMethod === 'url' && $scope.editScheduleData.imageUrl) {
      formData.append('imageUrl', $scope.editScheduleData.imageUrl);
    }
    
    ApiService.editSchedule($scope.editScheduleData.id, formData)
      .then(function() {
        $scope.hideEditModal();
        loadSchedules();
        $scope.success = 'Schedule updated successfully';
      })
      .catch(function(error) {
        console.error('Error updating schedule:', error);
        $scope.editScheduleError = 'Failed to update schedule. Please try again.';
      });
  };
  
  // Helper function to get group name by ID
  $scope.getGroupName = function(groupId) {
    var group = $scope.groups.find(function(g) {
      return g.groupId === groupId; // Match using groupId field
    });
    return group ? group.name : 'Unknown Group';
  };
  
  // Helper function to get full image URL
  $scope.getImageUrl = function(imagePath) {
    if (!imagePath) return null;
    
    // If it's already a complete URL (starts with http:// or https://), return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      console.log('External image URL returned as is:', imagePath);
      return imagePath;
    }
    
    // Otherwise, it's a relative path, prepend API base
    var API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : 'https://whatspro.robomate.in';
    var fullUrl = API_BASE + imagePath;
    console.log('Local image URL generated:', fullUrl);
    console.log('User agent (mobile check):', navigator.userAgent);
    console.log('Window size:', window.innerWidth + 'x' + window.innerHeight);
    return fullUrl;
  };
  
  // Debug function to check image loading
  $scope.onImageError = function(event) {
    console.error('Image failed to load:', event.target.src);
    console.error('Image element:', event.target);
    console.error('Image natural dimensions:', event.target.naturalWidth + 'x' + event.target.naturalHeight);
    event.target.style.display = 'none';
    if (event.target.nextElementSibling) {
      event.target.nextElementSibling.style.display = 'block';
    }
  };
  
  // Debug function for successful image loading
  $scope.onImageLoad = function(event) {
    console.log('Image loaded successfully:', event.target.src);
    console.log('Image natural dimensions:', event.target.naturalWidth + 'x' + event.target.naturalHeight);
    console.log('Image display dimensions:', event.target.width + 'x' + event.target.height);
  };
});