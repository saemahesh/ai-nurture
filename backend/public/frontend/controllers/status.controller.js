angular.module('autopostWaApp.status').controller('StatusController', function($scope, ApiService) {
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

    var selectedTime = new Date();
    selectedTime.setHours(hour, minute, 0, 0);

    var localTime = new Date(selectedTime.getFullYear(), selectedTime.getMonth(), selectedTime.getDate(), selectedTime.getHours(), selectedTime.getMinutes(), selectedTime.getSeconds());
    data.time = localTime.toISOString();

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
    ApiService.deleteStatus(id).then(loadStatuses);
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
    var time = new Date(status.time);
    var hour = time.getHours();
    var minute = time.getMinutes();
    var ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; // the hour '0' should be '12'
    $scope.status = {
      caption: status.caption,
      textColor: status.textColor,
      bgColor: status.bgColor,
      hour: hour.toString().padStart(2, '0'),
      minute: minute.toString().padStart(2, '0'),
      ampm: ampm,
      repeat: status.repeat,
      days: angular.copy(status.days),
      mediaUrl: status.media
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
