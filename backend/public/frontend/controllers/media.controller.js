angular.module('autopostWaApp.media').controller('MediaPageController', function($scope, $timeout, ApiService, $sce) {
  $scope.mediaFiles = [];
  $scope.newMedia = {
    name: '',
    type: 'image',
    file: null
  };
  $scope.error = '';
  $scope.success = '';
  $scope.submitted = false;
  $scope.uploading = false;
  $scope.previewUrl = null;
  $scope.loading = true;
  $scope.editingMedia = { id: null };
  $scope.confirmingDelete = null;
  $scope.fileDetails = {};
  $scope.showImageModal = false;
  $scope.selectedImage = null;
  
  console.log("Media controller initialized");

  // Precompute and cache trusted URLs for all media files
  function computeTrustedUrl(media) {
    let src = media.url;
    if (!src) {
      // Use local placeholder if url is missing
      src = media.type === 'video' ? '/images/video-placeholder.png' : '/images/image-placeholder.png';
    } else if (!src.startsWith('http') && !src.startsWith('blob:') && !src.startsWith('/')) {
      src = '/' + src;
    }
    if (src.startsWith('/uploads/')) {
      src = window.location.origin + src;
    }
    // Always use local placeholder if placeholder.com is found (shouldn't happen, but for safety)
    if (src.includes('placeholder.com')) {
      src = media.type === 'video' ? '/images/video-placeholder.png' : '/images/image-placeholder.png';
      src = window.location.origin + src;
    }
    return $sce.trustAsResourceUrl(src);
  }

  // Load media files
  function loadMedia() {
    $scope.loading = true;
    console.log("Loading media files...");
    ApiService.getMedia().then(function(res) {
      $scope.mediaFiles = res.data;
      console.log("Media files loaded:", $scope.mediaFiles);
      $scope.mediaFiles.forEach(function(media) {
        // Format file size
        if (media.fileSize) {
          media.formattedSize = formatFileSize(media.fileSize);
        } else {
          media.formattedSize = 'Unknown size';
        }
        // Format upload date
        if (media.uploadDate) {
          media.formattedDate = new Date(media.uploadDate).toLocaleString();
        } else {
          media.formattedDate = 'Unknown date';
        }
        // Make sure type is set
        if (!media.type) {
          const ext = media.filename ? media.filename.split('.').pop().toLowerCase() : '';
          media.type = ['jpg', 'jpeg', 'png', 'gif'].includes(ext) ? 'image' : 'video';
        }
        // Make sure name is set
        if (!media.name) {
          media.name = media.filename ? media.filename.split('.')[0] : 'Unnamed Media';
        }
        // Make sure url is properly set
        if (media.url && !media.url.startsWith('http') && !media.url.startsWith('/')) {
          media.url = '/' + media.url;
        }
        // Precompute trusted URL for template use
        media._trustedUrl = computeTrustedUrl(media);
        // Mark as checked to remove loading indicator
        media.checked = true;
      });
      $scope.loading = false;
    }).catch(function(err) {
      $scope.error = 'Failed to load media files';
      console.error('Error loading media:', err);
      $scope.loading = false;
    });
  }

  // Start by loading media immediately
  loadMedia();

  // Format file size for display
  function formatFileSize(bytes) {
    if (!bytes || isNaN(parseInt(bytes))) return 'Unknown size';
    
    bytes = parseInt(bytes);
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1048576) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else {
      return (bytes / 1048576).toFixed(2) + ' MB';
    }
  }

  $scope.getAcceptedFileTypes = function() {
    return $scope.newMedia.type === 'image' ? 'image/*' : 'video/*';
  };

  $scope.getFileTypeHelper = function() {
    if ($scope.newMedia.type === 'image') {
      return 'Accepted formats: JPG, PNG, GIF (max 5MB)';
    }
    return 'Accepted formats: MP4, WebM (max 20MB)';
  };

  // Fixed file selection handler to prevent digest issues
  $scope.handleFileSelect = function(event) {
    var file = event.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name);
    $scope.error = '';
    
    // Validate file type
    if ($scope.newMedia.type === 'image' && !file.type.match('image.*')) {
      $scope.error = 'Please select an image file';
      event.target.value = '';
      return;
    }
    if ($scope.newMedia.type === 'video' && !file.type.match('video.*')) {
      $scope.error = 'Please select a video file';
      event.target.value = '';
      return;
    }

    // Validate file size
    const maxSize = $scope.newMedia.type === 'image' ? 5 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      $scope.error = `File size exceeds ${maxSize / (1024 * 1024)}MB limit`;
      event.target.value = '';
      return;
    }

    // Clean up previous object URL if it exists
    if ($scope.previewUrl && $scope.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL($scope.previewUrl);
    }
    
    // Create the file preview URL outside of Angular digest cycle
    var previewUrl = URL.createObjectURL(file);
    
    // Use $timeout to safely update scope in the next digest cycle
    $timeout(function() {
      $scope.newMedia.file = file;
      $scope.fileDetails = {
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type
      };
        
      // Set a default name based on the file name if no name is provided
      if (!$scope.newMedia.name) {
        $scope.newMedia.name = file.name.split('.')[0];
      }
      
      // Apply the preview URL we created earlier
      $scope.previewUrl = previewUrl;
    });
  };

  $scope.resetForm = function() {
    // Revoke any object URLs to prevent memory leaks
    if ($scope.previewUrl && $scope.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL($scope.previewUrl);
    }
    
    $scope.newMedia = {
      name: '',
      type: 'image',
      file: null
    };
    $scope.error = '';
    $scope.success = '';
    $scope.submitted = false;
    $scope.previewUrl = null;
    document.getElementById('mediaFile').value = '';
  };

  $scope.uploadMedia = function() {
    $scope.submitted = true;
    $scope.error = '';

    if (!$scope.newMedia.name || $scope.newMedia.name.trim() === '') {
      $scope.error = 'Media name is required';
      return;
    }

    if (!$scope.newMedia.file) {
      $scope.error = 'Please select a file';
      return;
    }

    $scope.uploading = true;
    const formData = new FormData();
    formData.append('name', $scope.newMedia.name.trim());
    formData.append('type', $scope.newMedia.type);
    formData.append('file', $scope.newMedia.file);

    ApiService.uploadMedia(formData)
      .then(function(response) {
        console.log('Upload successful:', response);
        $scope.success = 'Media uploaded successfully!';
        $scope.resetForm();
        // Auto-hide success message after 3 seconds
        $timeout(function() {
          $scope.success = '';
        }, 3000);
        loadMedia();
      })
      .catch(function(err) {
        console.error('Upload failed:', err);
        $scope.error = err.data?.error || 'Upload failed';
      })
      .finally(function() {
        $scope.uploading = false;
      });
  };

  // Methods for inline editing
  $scope.startEditing = function(media) {
    console.log("Starting edit for media:", media.id);
    $scope.editingMedia = angular.copy(media);
    $scope.originalName = media.name;
  };

  $scope.cancelEditing = function() {
    console.log("Canceling edit mode");
    $scope.editingMedia = { id: null };
  };

  $scope.saveMediaName = function(media) {
    if (!$scope.editingMedia.name || $scope.editingMedia.name.trim() === '') {
      $scope.error = 'Media name cannot be empty';
      return;
    }

    const id = media.id;
    const newName = $scope.editingMedia.name.trim();
    console.log("Saving new name for media", id, ":", newName);
    
    ApiService.updateMediaName(id, newName)
      .then(function(response) {
        const index = $scope.mediaFiles.findIndex(m => m.id === id);
        if (index !== -1) {
          $scope.mediaFiles[index].name = newName;
          $scope.success = 'Media name updated successfully!';
          $timeout(function() {
            $scope.success = '';
          }, 3000);
        }
        $scope.editingMedia = { id: null };
      })
      .catch(function(err) {
        console.error('Failed to update media name:', err);
        $scope.error = 'Failed to update media name';
      });
  };

  // Methods for media deletion
  $scope.confirmDelete = function(media) {
    $scope.confirmingDelete = media;
  };

  $scope.cancelDelete = function() {
    $scope.confirmingDelete = null;
  };

  $scope.deleteMedia = function(id) {
    ApiService.deleteMedia(id)
      .then(function() {
        $scope.mediaFiles = $scope.mediaFiles.filter(media => media.id !== id);
        $scope.success = 'Media deleted successfully!';
        $timeout(function() {
          $scope.success = '';
        }, 3000);
        $scope.confirmingDelete = null;
      })
      .catch(function(err) {
        console.error('Failed to delete media:', err);
        $scope.error = 'Failed to delete media';
        $scope.confirmingDelete = null;
      });
  };

  // Image preview modal
  $scope.openImageModal = function(media) {
    $scope.selectedImage = media;
    $scope.showImageModal = true;
  };

  $scope.closeImageModal = function() {
    $scope.showImageModal = false;
    $scope.selectedImage = null;
  };

  // Get media details
  $scope.getMediaDetails = function(id) {
    if ($scope.fileDetails[id]) {
      return;
    }
    
    ApiService.getMediaDetails(id)
      .then(function(response) {
        $scope.fileDetails[id] = response.data;
      })
      .catch(function(err) {
        console.error('Failed to get media details:', err);
      });
  };

  // Select media for event reminders
  $scope.selectForEventReminder = function(media) {
    // Store the selected media in localStorage for use in event-reminders
    localStorage.setItem('selectedMediaForReminder', JSON.stringify({
      id: media.id,
      name: media.name,
      url: media.url,
      type: media.type
    }));
    $scope.success = 'Media selected for event reminder!';
    $timeout(function() {
      $scope.success = '';
    }, 3000);
  };

  // Cleanup blob URLs when controller is destroyed
  $scope.$on('$destroy', function() {
    if ($scope.previewUrl && $scope.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL($scope.previewUrl);
    }
  });
});
