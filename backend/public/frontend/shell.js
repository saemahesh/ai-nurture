document.addEventListener('DOMContentLoaded', function () {
  const hamburgerMenu = document.querySelector('.hamburger-menu');
  const sidebarContainer = document.querySelector('.sidebar-container');
  const mainContent = document.querySelector('.main-content');

  if (hamburgerMenu && sidebarContainer && mainContent) {
    hamburgerMenu.addEventListener('click', function () {
      sidebarContainer.classList.toggle('open');
      mainContent.classList.toggle('sidebar-open');
    });
  }
});
