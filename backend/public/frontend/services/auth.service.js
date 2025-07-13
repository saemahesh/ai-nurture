angular.module('autopostWaApp.core').factory('AuthService', function($http) {
  var API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://whatspro.robomate.in';
  var service = {};
  
  service.login = function(username, password) {
    return $http.post(API_BASE + '/auth/login', { username, password }, { withCredentials: true });
  };
  
  service.register = function(username, password) {
    return $http.post(API_BASE + '/auth/register', { username, password }, { withCredentials: true });
  };
  
  service.logout = function() {
    return $http.post(API_BASE + '/auth/logout', {}, { withCredentials: true });
  };
  
  service.me = function() {
    return $http.get(API_BASE + '/auth/me', { withCredentials: true });
  };
  
  return service;
});
