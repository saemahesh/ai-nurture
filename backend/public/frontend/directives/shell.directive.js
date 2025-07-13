angular.module('autopostWaApp.core').directive('shell', function() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      const hamburgerMenu = element[0].querySelector('.hamburger-menu');
      const sidebarContainer = element[0].querySelector('.sidebar-container');
      const mainContent = element[0].querySelector('.main-content');

      if (hamburgerMenu && sidebarContainer && mainContent) {
        hamburgerMenu.addEventListener('click', function () {
          sidebarContainer.classList.toggle('open');
          mainContent.classList.toggle('sidebar-open');
          document.body.classList.toggle('sidebar-open');
        });
      }
    }
  };
});
