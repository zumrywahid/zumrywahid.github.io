(function () {
  'use strict';

  var STORAGE_KEY = 'theme-preference';

  function getThemePreference() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  // Toggle handler
  var toggle = document.querySelector('.darkmode-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme') || 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }

  // Enable smooth transitions after first paint
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      document.documentElement.setAttribute('data-theme-transition', '');
    });
  });

  // Listen for system preference changes (only if no stored preference)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
})();
