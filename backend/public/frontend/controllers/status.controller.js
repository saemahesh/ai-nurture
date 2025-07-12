angular.module('autopostWaApp.status').controller('StatusController', function($scope, ApiService) {
  $scope.status = {
    caption: '',
    textColor: '#000000',
    bgColor: '#ffffff',
    time: '',
    repeat: 'once',
    days: {}
  };
  $scope.days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  $scope.scheduledStatuses = [];
  $scope.saving = false;
  $scope.saveSuccess = false;
  $scope.saveError = '';
  $scope.mediaLibrary = [];
  $scope.createStatusModalVisible = false;

  function loadStatuses() {
    ApiService.getStatuses().then(function(res) {
      $scope.scheduledStatuses = res.data;
    });
  }

  ApiService.getMedia().then(function(res) {
    $scope.mediaLibrary = res.data;
  });

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
      mediaUrl: $scope.status.mediaUrl
    };
    if ($scope.status.repeat === 'custom') {
      data.days = $scope.status.days;
    }
    // Fix: If repeat is 'once', use dateTime for time
    if ($scope.status.repeat === 'once') {
      if ($scope.status.dateTime) {
        var date = new Date($scope.status.dateTime);
        data.time = !isNaN(date.getTime()) ? date.toISOString() : '';
      } else {
        data.time = '';
      }
    } else if ($scope.status.time) {
      var now = new Date();
      var timeStr = String($scope.status.time);
      if (timeStr.includes(':')) {
        var parts = timeStr.split(':');
        if (parts.length >= 2) {
          var hours = parseInt(parts[0], 10);
          var minutes = parseInt(parts[1], 10);
          var date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
          data.time = date.toISOString();
        }
      } else {
        var parsed = new Date(timeStr);
        if (!isNaN(parsed.getTime())) {
          data.time = parsed.toISOString();
        }
      }
    }
    ApiService.scheduleStatus(data).then(function() {
      $scope.saving = false;
      $scope.saveSuccess = true;
      loadStatuses();
    }).catch(function(err) {
      $scope.saving = false;
      $scope.saveError = err.data?.error || 'Failed to schedule status';
    });
  };

  $scope.deleteStatus = function(id) {
    ApiService.deleteStatus(id).then(loadStatuses);
  };

  $scope.getSelectedDays = function(daysObj) {
    return Object.keys(daysObj).filter(function(day) { return daysObj[day]; }).join(', ');
  };

  $scope.showCreateStatusModal = function() {
    $scope.createStatusModalVisible = true;
    $scope.status = {
      caption: '',
      textColor: '#000000',
      bgColor: '#ffffff',
      time: '',
      repeat: 'once',
      days: {},
      mediaUrl: ''
    };
    $scope.saveSuccess = false;
    $scope.saveError = '';
  };
  $scope.hideCreateStatusModal = function() {
    $scope.createStatusModalVisible = false;
    $scope.saveSuccess = false;
    $scope.saveError = '';
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
