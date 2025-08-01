// Universal Notification Service for Toast Messages and Confirmation Modals
angular.module('autopostWaApp.core')
.service('NotificationService', ['$timeout', function($timeout) {
    var self = this;
    
    // Toast notification method
    self.showToast = function(scope, message, type) {
        type = type || 'success';
        scope.toast = {
            show: true,
            message: message,
            type: type
        };
        
        $timeout(function() {
            scope.toast.show = false;
        }, 3000);
    };
    
    // Initialize toast in scope
    self.initToast = function(scope) {
        scope.toast = { show: false };
    };
    
    // Confirmation modal method
    self.showConfirmation = function(scope, title, message, onConfirm, onCancel, confirmText, cancelText) {
        scope.confirmModal = {
            title: title || 'Confirm Action',
            message: message || 'Are you sure?',
            confirmText: confirmText || 'Confirm',
            cancelText: cancelText || 'Cancel',
            onConfirm: onConfirm,
            onCancel: onCancel
        };
        scope.showConfirmModal = true;
    };
    
    // Initialize confirmation modal in scope
    self.initConfirmModal = function(scope) {
        scope.showConfirmModal = false;
        scope.confirmModal = {
            title: '',
            message: '',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            onConfirm: null,
            onCancel: null
        };
        
        // Handle confirmation
        scope.handleConfirm = function() {
            if (scope.confirmModal.onConfirm) {
                scope.confirmModal.onConfirm();
            }
            scope.showConfirmModal = false;
        };
        
        // Handle cancel
        scope.handleCancel = function() {
            if (scope.confirmModal.onCancel) {
                scope.confirmModal.onCancel();
            }
            scope.showConfirmModal = false;
        };
    };
}]);
