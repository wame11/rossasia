// Webstitch client-site behaviour: mobile menu, today's opening hours, scroll reveal, contact form.
(function () {
  document.documentElement.classList.add('js');

  // Mobile menu
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Opening hours: highlight today and fill the "Today" line in the hero
  var keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var today = new Date().getDay();
  document.querySelectorAll('.hours tr[data-day="' + today + '"]').forEach(function (row) { row.classList.add('today'); });
  var hours = window.SITE_HOURS;
  document.querySelectorAll('[data-today-hours]').forEach(function (el) {
    if (!hours) return;
    var value = hours[keys[today]];
    el.textContent = !value || /closed/i.test(value) ? 'Closed today' : 'Open ' + value.replace(/\s*-\s*/, ' – ');
  });

  // Scroll reveal
  var targets = document.querySelectorAll('.section .wrap > *, .cta .wrap');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  // Contact form: send in the background and show a message (falls back to a normal form post)
  document.querySelectorAll('form[data-ajax]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = form.querySelector('.form-status');
      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      status.textContent = 'Sending…';
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('Bad response');
          form.reset();
          status.textContent = 'Thanks, your message has been sent. We’ll be in touch soon.';
        })
        .catch(function () {
          status.textContent = 'Sorry, that didn’t send. Please call or email us instead.';
        })
        .then(function () { button.disabled = false; });
    });
  });
})();
