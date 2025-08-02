// Centralized Media Library Modal Directive
angular.module('autopostWaApp.core').directive('mediaLibraryModal', function() {
  return {
    restrict: 'E',
    templateUrl: 'directives/media-library-modal.html?v=' + Date.now(),
    scope: {
      show: '=',
      onSelect: '&',
      onClose: '&'
    },
    controller: function($scope, $http, $sce) {
      $scope.loadingMedia = false;
      $scope.mediaLibrary = [];
      
      // Watch for modal visibility changes
      $scope.$watch('show', function(newVal) {
        if (newVal) {
          $scope.loadMediaLibrary();
        }
      });
      
      // Load media library
      $scope.loadMediaLibrary = function() {
        $scope.loadingMedia = true;
        
        // Try multiple endpoints that might exist in different parts of the app
        const endpoints = ['/api/media', '/media', '/media/list'];
        
        function tryEndpoint(index) {
          if (index >= endpoints.length) {
            // If all endpoints fail, try to use any existing mediaLibrary from parent scope
            if ($scope.$parent && $scope.$parent.mediaLibrary) {
              $scope.mediaLibrary = $scope.$parent.mediaLibrary.map(function(media) {
                media._trustedUrl = $sce.trustAsResourceUrl(media.url);
                return media;
              });
            } else {
              $scope.mediaLibrary = [];
            }
            $scope.loadingMedia = false;
            return;
          }
          
          $http.get(endpoints[index])
            .then(function(response) {
              const mediaData = response.data || [];
              $scope.mediaLibrary = mediaData.map(function(media) {
                // Ensure all media types are included, including documents
                media._trustedUrl = $sce.trustAsResourceUrl(media.url);
                
                // Determine media type if not set
                if (!media.type && media.filename) {
                  const ext = media.filename.split('.').pop().toLowerCase();
                  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                    media.type = 'image';
                  } else if (['mp4', 'avi', 'mov', 'wmv', 'flv'].includes(ext)) {
                    media.type = 'video';
                  } else {
                    media.type = 'document';
                  }
                }
                
                return media;
              });
              $scope.loadingMedia = false;
            })
            .catch(function(error) {
              console.log('Failed to load from', endpoints[index], 'trying next endpoint');
              tryEndpoint(index + 1);
            });
        }
        
        tryEndpoint(0);
      };
      
      // Select media
      $scope.selectMedia = function(media) {
        if ($scope.onSelect) {
          $scope.onSelect({ media: media });
        }
        $scope.closeModal();
        
        // Force digest cycle to ensure parent scope is updated
        setTimeout(function() {
          if ($scope.$parent && !$scope.$parent.$$phase) {
            $scope.$parent.$apply();
          }
        }, 0);
      };
      
      // Close modal
      $scope.closeModal = function() {
        if ($scope.onClose) {
          $scope.onClose();
        }
      };
      
      // Get media icon based on type
      $scope.getMediaIcon = function(media) {
        if (media.type === 'image') return 'fas fa-image';
        if (media.type === 'video') return 'fas fa-video';
        if (media.type === 'document') return 'fas fa-file-pdf';
        return 'fas fa-file';
      };
      
      // Get media display content
      $scope.getMediaDisplayContent = function(media) {
        if (media.type === 'image') {
          return { type: 'image', src: media._trustedUrl };
        } else if (media.type === 'video') {
          return { type: 'video', src: media._trustedUrl };
        } else {
          // Document or other file types
          return { type: 'document', icon: $scope.getMediaIcon(media), name: media.name };
        }
      };
    }
  };
});
