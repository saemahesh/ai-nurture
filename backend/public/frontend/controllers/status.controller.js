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
      $scope.scheduledStatuses = res.data.map(function(s) {
        s.timeDisplay = $scope.formatIST(s.time, s.repeat !== 'once');
        return s;
      });
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

    var selectedTime;
    if ($scope.status.repeat === 'once') {
      if (!$scope.status.dateTime) {
        $scope.saving = false;
        $scope.saveError = 'Date and time are required for one-time status.';
        return;
      }
      selectedTime = new Date($scope.status.dateTime);
    } else { // daily or custom
      if (!$scope.status.time) {
        $scope.saving = false;
        $scope.saveError = 'Time is required for recurring status.';
        return;
      }
      var timeParts = $scope.status.time.split(':');
      selectedTime = new Date();
      selectedTime.setHours(timeParts[0], timeParts[1], 0, 0);
    }

    // Convert to user's local time, assuming input is local. Then convert to UTC.
    var localTime = new Date(selectedTime.getFullYear(), selectedTime.getMonth(), selectedTime.getDate(), selectedTime.getHours(), selectedTime.getMinutes(), selectedTime.getSeconds());
    data.time = localTime.toISOString();


    ApiService.scheduleStatus(data).then(function() {
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
    // Prefill time for recurring schedules
    var now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    $scope.status.time = now.toISOString().slice(11,16);

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
