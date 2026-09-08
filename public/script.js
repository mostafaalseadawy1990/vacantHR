document.addEventListener('DOMContentLoaded', function () {
  // Mobile nav toggle
  var burger = document.querySelector('.burger');
  var links = document.querySelector('.nav-links');
  if (burger && links) {
    burger.setAttribute('aria-expanded', 'false');
    burger.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Scroll reveal
  var revealables = document.querySelectorAll(
    'section .section-head, .service-item, .feature-row, .stat, .plan, .doc-card, .step, .quote, .faq details'
  );
  revealables.forEach(function (el) { el.classList.add('reveal'); });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });
    // Safety net: never leave content hidden if observer callbacks don't fire.
    setTimeout(function () {
      revealables.forEach(function (el) { el.classList.add('in'); });
    }, 2500);
  } else {
    revealables.forEach(function (el) { el.classList.add('in'); });
  }

  // Animated counters for stats
  var nums = document.querySelectorAll('.stat .num[data-count]');
  if (nums.length && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseFloat(el.getAttribute('data-count'));
        var prefix = el.getAttribute('data-prefix') || '';
        var suffix = el.getAttribute('data-suffix') || '';
        var dur = 1200, start = performance.now();
        function tick(now) {
          var p = Math.min((now - start) / dur, 1);
          var val = Math.floor(p * target);
          el.textContent = prefix + val.toLocaleString('en-US') + suffix;
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = prefix + target.toLocaleString('en-US') + suffix;
        }
        requestAnimationFrame(tick);
        cio.unobserve(el);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (el) { cio.observe(el); });
  }
});
