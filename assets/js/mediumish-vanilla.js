(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {

    // Alert bar show/hide on scroll
    var alertbar = document.querySelector('.alertbar');
    if (alertbar) {
      window.addEventListener('scroll', function() {
        if (window.scrollY > 280) {
          alertbar.style.display = 'block';
          alertbar.style.opacity = '1';
        } else {
          alertbar.style.display = 'none';
          alertbar.style.opacity = '0';
        }
      });
    }

    // Smooth scroll to anchor links
    if (location.hash) {
      setTimeout(function() {
        window.scrollTo(0, 0);
        var target = document.querySelector(location.hash);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }, 1);
    }

    document.querySelectorAll('a[href*="#"]:not([href="#"])').forEach(function(link) {
      link.addEventListener('click', function(e) {
        if (location.pathname.replace(/^\//, '') === this.pathname.replace(/^\//, '') && location.hostname === this.hostname) {
          var target = document.querySelector(this.hash);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });

    // Hide/show navbar on scroll
    var didScroll = false;
    var lastScrollTop = 0;
    var delta = 5;
    var nav = document.querySelector('nav');
    var navbarHeight = nav ? nav.offsetHeight : 0;

    window.addEventListener('scroll', function() {
      didScroll = true;
    });

    setInterval(function() {
      if (didScroll) {
        hasScrolled();
        didScroll = false;
      }
    }, 250);

    function hasScrolled() {
      var st = window.scrollY;
      if (Math.abs(lastScrollTop - st) <= delta) return;

      if (st > lastScrollTop && st > navbarHeight) {
        // Scroll down
        nav.classList.remove('nav-down');
        nav.classList.add('nav-up');
        nav.style.top = -nav.offsetHeight + 'px';
      } else {
        // Scroll up
        if (st + window.innerHeight < document.body.scrollHeight) {
          nav.classList.remove('nav-up');
          nav.classList.add('nav-down');
          nav.style.top = '0px';
        }
      }
      lastScrollTop = st;
    }

    // Spoiler reveal on click
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('spoiler')) {
        e.target.classList.remove('spoiler');
      }
    });

    // Bootstrap navbar toggler (replacing Bootstrap JS dependency for collapse)
    var toggler = document.querySelector('.navbar-toggler');
    var collapseTarget = document.querySelector('#navbarMediumish');
    if (toggler && collapseTarget) {
      toggler.addEventListener('click', function() {
        collapseTarget.classList.toggle('show');
      });
    }

  });

  // Deferred style loading
  var loadDeferredStyles = function() {
    var addStylesNode = document.getElementById('deferred-styles');
    if (addStylesNode) {
      var replacement = document.createElement('div');
      replacement.innerHTML = addStylesNode.textContent;
      document.body.appendChild(replacement);
      addStylesNode.parentElement.removeChild(addStylesNode);
    }
  };

  var raf = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
  if (raf) {
    raf(function() { window.setTimeout(loadDeferredStyles, 0); });
  } else {
    window.addEventListener('load', loadDeferredStyles);
  }

})();
