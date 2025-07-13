angular.module('autopostWaApp.core').factory('ApiService', function($http) {
  var API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://whatspro.robomate.in';
  
  return {
    // Groups
    getGroups: function() { 
      return $http.get(API_BASE + '/groups', { withCredentials: true }); 
    },
    addGroup: function(data) { 
      return $http.post(API_BASE + '/groups', data, { withCredentials: true }); 
    },
    deleteGroup: function(id) { 
      return $http.delete(API_BASE + '/groups/' + id, { withCredentials: true }); 
    },
    syncGroups: function() {
      return $http.post(API_BASE + '/groups/sync', {}, { withCredentials: true });
    },

    // Schedules
    getSchedules: function() { 
      return $http.get(API_BASE + '/schedule', { withCredentials: true }); 
    },
    addSchedule: function(fd) { 
      return $http.post(API_BASE + '/schedule', fd, 
        { headers: { 'Content-Type': undefined }, withCredentials: true }); 
    },
    addScheduleMultipleGroups: function(fd) { 
      return $http.post(API_BASE + '/schedule', fd, 
        { headers: { 'Content-Type': undefined }, withCredentials: true }); 
    },
    editSchedule: function(id, fd) { 
      return $http.put(API_BASE + '/schedule/' + id, fd, 
        { headers: { 'Content-Type': undefined }, withCredentials: true }); 
    },
    deleteSchedule: function(id) { 
      return $http.delete(API_BASE + '/schedule/' + id, { withCredentials: true }); 
    },

    // Media
    getMedia: function() { 
      return $http.get(API_BASE + '/media/list', { withCredentials: true }); 
    },
    uploadMedia: function(formData) {
      return $http.post(API_BASE + '/media/upload', formData, 
        { headers: { 'Content-Type': undefined }, withCredentials: true });
    },
    deleteMedia: function(id) {
      return $http.delete(API_BASE + '/media/' + id, { withCredentials: true });
    },
    updateMediaName: function(id, name) {
      return $http.put(API_BASE + '/media/' + id, { name: name }, { withCredentials: true });
    },
    getMediaDetails: function(id) {
      return $http.get(API_BASE + '/media/' + id, { withCredentials: true });
    },

    // Events
    getEvents: function() { 
      return $http.get(API_BASE + '/events', { withCredentials: true }); 
    },
    getEvent: function(id) { 
      return $http.get(API_BASE + '/events/' + id, { withCredentials: true }); 
    },
    addEvent: function(data) { 
      return $http.post(API_BASE + '/events', data, { withCredentials: true }); 
    },
    updateEvent: function(id, data) { 
      return $http.put(API_BASE + '/events/' + id, data, { withCredentials: true }); 
    },
    deleteEvent: function(id) { 
      return $http.delete(API_BASE + '/events/' + id, { withCredentials: true }); 
    },

    // Event Reminders
    getEventReminders: function(eventId) { 
      return $http.get(API_BASE + `/events/${eventId}/reminders`, { withCredentials: true }); 
    },
    saveEventReminders: function(eventId, reminderConfig) {
      return $http.post(API_BASE + `/events/${eventId}/reminders`, reminderConfig, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      });
    },
    configureReminder: function(eventId, reminderType, enabled, text, file) { 
      var fd = new FormData();
      fd.append('text', text);
      fd.append('enabled', enabled);
      if (file) {
        fd.append('media', file);
      }
      return $http.post(API_BASE + `/events/${eventId}/reminder/${reminderType}`, fd, 
        { headers: { 'Content-Type': undefined }, withCredentials: true }); 
    },
    generateDefaultReminders: function(eventId, defaultImage) {
      return $http.post(API_BASE + `/events/${eventId}/generate-default-reminders`, 
        { defaultImage }, { withCredentials: true });
    },

    // User Management (Admin)
    getUsers: function() {
      return $http.get(API_BASE + '/auth/users', { withCredentials: true });
    },
    approveUser: function(username) {
      return $http.post(API_BASE + '/auth/users/' + encodeURIComponent(username) + '/approve', {}, { withCredentials: true });
    },
    denyUser: function(username) {
      return $http.post(API_BASE + '/auth/users/' + encodeURIComponent(username) + '/deny', {}, { withCredentials: true });
    },
    updateUserExpiration: function(username, expirationDate) {
      return $http.post(API_BASE + '/auth/users/' + encodeURIComponent(username) + '/expire', { expirationDate }, { withCredentials: true });
    },

    // User Settings
    getUserSettings: function() {
      return $http.get(API_BASE + '/users/settings', { withCredentials: true });
    },
    saveUserSettings: function(settings) {
      return $http.post(API_BASE + '/users/settings', settings, { withCredentials: true });
    },

    // Status Scheduler
    getStatuses: function() {
      return $http.get(API_BASE + '/status', { withCredentials: true });
    },
    scheduleStatus: function(data) {
      return $http.post(API_BASE + '/status', data, { withCredentials: true });
    },
    deleteStatus: function(id) {
      return $http.delete(API_BASE + '/status/' + id, { withCredentials: true });
    }
  };
});
