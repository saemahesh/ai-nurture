angular.module('autopostWaApp.schedules').controller('ScheduleController', function($scope, $location, $timeout, AuthService, ApiService, NotificationService) {
  // Initialize notifications
  NotificationService.initToast($scope);
  NotificationService.initConfirmModal($scope);
  
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
  $scope.searchQuery = '';
  $scope.isSearching = false;
  $scope.searchTimeout = null;

  // Enhanced search function with debouncing
  $scope.searchSchedules = function(schedule) {
    if (!$scope.searchQuery) return true;
    
    var query = $scope.searchQuery.toLowerCase();
    var name = (schedule.name || '').toLowerCase();
    var message = (schedule.message || '').toLowerCase();
    var groupName = ($scope.getGroupName(schedule.groupId) || '').toLowerCase();
    
    return name.includes(query) || message.includes(query) || groupName.includes(query);
  };

  // Keyboard navigation support
  $scope.handleKeyboardNavigation = function(event) {
    // Ctrl/Cmd + K to focus search
    if ((event.ctrlKey || event.metaKey) && event.keyCode === 75) {
      event.preventDefault();
      var searchInput = document.querySelector('input[ng-model="searchQuery"]');
      if (searchInput) searchInput.focus();
    }
    
    // Escape to clear search when search input is focused
    if (event.keyCode === 27 && document.activeElement.getAttribute('ng-model') === 'searchQuery') {
      $scope.clearSearch();
      $scope.$apply();
    }
  };

  // Debounced search to improve performance
  $scope.handleSearchInput = function() {
    $scope.isSearching = true;
    
    if ($scope.searchTimeout) {
      clearTimeout($scope.searchTimeout);
    }
    
    $scope.searchTimeout = setTimeout(function() {
      $scope.$apply(function() {
        $scope.isSearching = false;
        $scope.filteredSchedules = $scope.getFilteredSchedules();
      });
    }, 300);
  };

  // Get filtered schedules count for UI
  $scope.getFilteredSchedules = function() {
    if (!$scope.searchQuery) return $scope.schedules;
    return $scope.schedules.filter($scope.searchSchedules);
  };

  // Clear search functionality
  $scope.clearSearch = function() {
    $scope.searchQuery = '';
    $scope.isSearching = false;
    $scope.filteredSchedules = $scope.schedules;
  };

  // Watch for search changes to update filtered count
  $scope.$watch('searchQuery', function(newVal, oldVal) {
    if (newVal !== oldVal) {
      $scope.handleSearchInput();
    }
  });

  $scope.$watch('schedules', function() {
    $scope.filteredSchedules = $scope.getFilteredSchedules();
  });

  // Bind keyboard events
  document.addEventListener('keydown', $scope.handleKeyboardNavigation);
  
  // Cleanup on scope destroy
  $scope.$on('$destroy', function() {
    document.removeEventListener('keydown', $scope.handleKeyboardNavigation);
    if ($scope.searchTimeout) {
      clearTimeout($scope.searchTimeout);
    }
  });

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
    return ApiService.getMedia().then(function(response) {
      $scope.mediaLibrary = response.data;
      console.log('Loaded media library:', response.data);
      $scope.loadingMedia = false;
      return response.data;
    }).catch(function(error) {
      console.error('Error loading media library:', error);
      $scope.loadingMedia = false;
      throw error;
    });
  };

  // Open media selector (unified for both create and edit)
  $scope.openMediaSelector = function() {
    $scope.showMediaSelector = true;
    $scope.loadMediaLibrary();
  };

  // Close media selector
  $scope.closeMediaSelector = function() {
    $scope.showMediaSelector = false;
  };

  // Select media for schedule
  $scope.selectMediaForSchedule = function(media) {
    console.log('Selected media:', media);
    console.log('Before media selection - formData:', $scope.formData);
    // Use unified formData system for both create and edit modes
    $scope.formData.selectedMedia = media;
    $scope.formData.imageUrl = ''; // Clear URL field when selecting from library
    $scope.formData.imageMethod = 'library'; // Set method when selecting from library
    console.log('After media selection - formData:', $scope.formData);
    $scope.closeMediaSelector();
    
    // Force form validation update
    setTimeout(function() {
      $scope.$apply();
      console.log('Form applied after media selection');
    }, 10);
  };

  // Clear selected media (unified for both create and edit)
  $scope.clearSelectedMedia = function() {
    $scope.formData.selectedMedia = null;
    $scope.formData.imageUrl = '';
    $scope.formData.imageMethod = 'library';
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
        NotificationService.showToast($scope, 'Schedule(s) added successfully!', 'success');
      })
      .catch(function(error) {
        console.error('Error adding schedule:', error);
        $scope.scheduleError = 'Failed to add schedule. Please try again.';
      });
  };
  
  $scope.deleteSchedule = function(id) {
    NotificationService.showConfirmation(
      $scope,
      'Delete Schedule',
      'Are you sure you want to delete this schedule?',
      function() {
        // On confirm
        ApiService.deleteSchedule(id)
          .then(function() {
            loadSchedules();
            NotificationService.showToast($scope, 'Schedule deleted successfully!', 'success');
          })
          .catch(function(error) {
            console.error('Error deleting schedule:', error);
            NotificationService.showToast($scope, 'Failed to delete schedule', 'error');
          });
      },
      null, // On cancel - do nothing
      'Delete',
      'Cancel'
    );
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
  
  // Modal functionality (unified create/edit modal)
  $scope.createScheduleModalVisible = false;
  $scope.isEditMode = false;
  $scope.formData = {};
  
  // Show create schedule modal
  $scope.showCreateScheduleModal = function() {
    $scope.isEditMode = false;
    $scope.formData = {
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
    $scope.scheduleError = '';
    $scope.createScheduleModalVisible = true;
  };

  // Show edit schedule modal  
  $scope.showEditScheduleModal = function(schedule) {
    $scope.isEditMode = true;
    
    // Helper function to safely convert date string to Date object for Angular ng-model
    function formatDateTimeLocal(dateString) {
      if (!dateString) return null;
      try {
        console.log('Group Schedule - Processing date string for Date object:', dateString);
        
        // Handle URL-encoded dates (decode first)
        var decodedDateString = decodeURIComponent(dateString);
        console.log('Group Schedule - Decoded date string:', decodedDateString);
        
        var date = new Date(decodedDateString);
        if (isNaN(date.getTime())) {
          // Try original string if decoding fails
          console.log('Group Schedule - Decoding failed, trying original string');
          date = new Date(dateString);
          if (isNaN(date.getTime())) {
            console.error('Group Schedule - Invalid date:', dateString);
            return null;
          }
        }
        
        console.log('Group Schedule - Original date string:', dateString, '-> Date object:', date);
        return date;
      } catch (e) {
        console.error('Group Schedule - Error parsing date to object:', dateString, e);
        return null;
      }
    }
    
    $scope.formData = {
      id: schedule.id,
      name: schedule.name,
      message: schedule.message,
      time: null, // Initialize as null first
      groupId: schedule.groupId,
      currentMediaUrl: schedule.media,
      imageMethod: schedule.media ? 'library' : 'library', // Set method based on existing media
      selectedMedia: null,
      imageUrl: schedule.media && (schedule.media.startsWith('http://') || schedule.media.startsWith('https://')) ? schedule.media : ''
    };
    
    console.log('Edit schedule formData after setup:', $scope.formData);
    console.log('Original schedule time:', schedule.time);
    
    // Set the Date object after a brief delay to force Angular refresh
    $timeout(function() {
      $scope.formData.time = formatDateTimeLocal(schedule.time);
      console.log('Group Schedule - Date object set to:', $scope.formData.time);
    }, 50);
    
    // If there's existing media and it's from library, try to find it in media library
    if (schedule.media && !schedule.media.startsWith('http://') && !schedule.media.startsWith('https://')) {
      // Load media library to find the selected media
      $scope.loadMediaLibrary().then(function() {
        var foundMedia = $scope.mediaLibrary.find(function(media) {
          return media.url === schedule.media || $scope.getImageUrl(media.url) === $scope.getImageUrl(schedule.media);
        });
        if (foundMedia) {
          $scope.formData.selectedMedia = foundMedia;
          $scope.formData.imageMethod = 'library';
        } else {
          // If not found in library, treat as URL
          $scope.formData.imageMethod = 'url';
          $scope.formData.imageUrl = $scope.getImageUrl(schedule.media);
        }
      });
    } else if (schedule.media && (schedule.media.startsWith('http://') || schedule.media.startsWith('https://'))) {
      // External URL
      $scope.formData.imageMethod = 'url';
      $scope.formData.imageUrl = schedule.media;
    }
    
    // Set the selected group for editing
    $scope.groups.forEach(function(group) {
      group.selected = (group.groupId === schedule.groupId);
    });
    
    $scope.scheduleError = '';
    $scope.createScheduleModalVisible = true;
    
    // Reset form validation state after data is populated
    $timeout(function() {
      // Ensure Angular detects the changes
      $scope.$evalAsync(function() {
        console.log('Group Schedule - Final formData.time (Date object):', $scope.formData.time);
        console.log('Group Schedule - Is Date object?', $scope.formData.time instanceof Date);
        if ($scope.scheduleForm) {
          $scope.scheduleForm.$setPristine();
          $scope.scheduleForm.$setUntouched();
          console.log('Group Schedule - Form reset completed. Form valid:', !$scope.scheduleForm.$invalid);
          console.log('Group Schedule - Form data after reset:', $scope.formData);
        }
      });
    }, 300);
  };
  
  // Hide schedule modal
  $scope.hideCreateScheduleModal = function() {
    $scope.createScheduleModalVisible = false;
    $scope.isEditMode = false;
    $scope.formData = {};
    $scope.scheduleError = '';
  };
  
  // Save schedule (unified create/edit)
  $scope.saveSchedule = function() {
    $scope.scheduleError = '';
    
    console.log('Save schedule called with formData:', $scope.formData);
    console.log('Groups with selection:', $scope.groups.map(function(g) { return {id: g.groupId, name: g.name, selected: g.selected}; }));
    
    // Validate form
    if (!$scope.formData.message || !$scope.formData.time) {
      console.log('Form validation failed - missing message or time');
      $scope.scheduleError = 'Please fill in all required fields';
      return;
    }
    
    if (!$scope.hasSelectedGroups()) {
      console.log('No groups selected');
      $scope.scheduleError = 'Please select at least one group';
      return;
    }
    
    // Get selected groups
    var selectedGroups = $scope.groups.filter(function(group) {
      return group.selected;
    });
    
    // Prepare form data
    var formData = new FormData();
    if ($scope.formData.name) {
      formData.append('name', $scope.formData.name);
    }
    formData.append('message', $scope.formData.message);
    formData.append('time', $scope.formData.time);
    
    // Handle media - either library selection or URL
    if ($scope.formData.imageMethod === 'library' && $scope.formData.selectedMedia) {
      formData.append('imageUrl', $scope.formData.selectedMedia.url);
    } else if ($scope.formData.imageMethod === 'url' && $scope.formData.imageUrl) {
      formData.append('imageUrl', $scope.formData.imageUrl);
    }
    
    if ($scope.isEditMode) {
      // Edit mode: use single group ID
      var groupId = selectedGroups[0].groupId; // Take first selected group
      formData.append('groupId', groupId);
      
      ApiService.editSchedule($scope.formData.id, formData)
        .then(function() {
          $scope.hideCreateScheduleModal();
          loadSchedules();
          NotificationService.showToast($scope, 'Schedule updated successfully!', 'success');
        })
        .catch(function(error) {
          console.error('Error updating schedule:', error);
          $scope.scheduleError = 'Failed to update schedule. Please try again.';
        });
    } else {
      // Create mode: use array of group IDs  
      var groupIds = selectedGroups.map(function(group) {
        return group.groupId;
      });
      formData.append('groupIds', JSON.stringify(groupIds));
      
      ApiService.addSchedule(formData)
        .then(function() {
          $scope.hideCreateScheduleModal();
          loadSchedules();
          NotificationService.showToast($scope, 'Schedule(s) added successfully!', 'success');
        })
        .catch(function(error) {
          console.error('Error adding schedule:', error);
          $scope.scheduleError = 'Failed to add schedule. Please try again.';
        });
    }
  };
  
  // Update media selection for formData
  $scope.selectMediaForSchedule = function(media) {
    console.log('Selected media:', media);
    $scope.formData.selectedMedia = media;
    $scope.formData.imageUrl = ''; // Clear URL field when selecting from library
    $scope.closeMediaSelector();
  };

  // Clear selected media for formData
  $scope.clearSelectedMedia = function() {
    $scope.formData.selectedMedia = null;
  };

  // Legacy edit modal functions (keeping for compatibility)
  $scope.showEditModal = function(schedule) {
    $scope.editingSchedule = true;
    $scope.editScheduleData = {
      id: schedule.id,
      name: schedule.name,
      message: schedule.message,
      time: formatDateTimeLocal(schedule.time), // Safely format for datetime-local input
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
        NotificationService.showToast($scope, 'Schedule updated successfully!', 'success');
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