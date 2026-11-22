// Webstitch public site: menu, scroll reveal, before/after slider, enquiry form.
(function () {
  'use strict';

  // Mobile menu
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  // Scroll reveal
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // Before / after slider
  document.querySelectorAll('.compare').forEach(function (compare) {
    var range = compare.querySelector('input[type="range"]');
    var update = function () { compare.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', update);
    update();
  });
  var chips = document.querySelectorAll('.chip[data-before]');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var compare = document.querySelector('.compare');
      compare.querySelector('.compare-before').src = chip.dataset.before;
      compare.querySelector('.compare-after').src = chip.dataset.after;
      compare.querySelector('.compare-before').alt = chip.dataset.name + ' website before the redesign';
      compare.querySelector('.compare-after').alt = chip.dataset.name + ' website after the redesign';
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
    });
  });

  // Enquiry form: send to the Webstitch API in the background.
  // Without JavaScript the form still posts normally and the API redirects to /thanks/.
  var form = document.getElementById('enquiry-form');
  if (form) {
    var status = form.querySelector('.form-status');
    var button = form.querySelector('button[type="submit"]');
    var MAX_FILES = 6;
    var MAX_BYTES = 8 * 1024 * 1024;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      status.className = 'form-status';

      var files = form.querySelector('input[type="file"]').files;
      if (files.length > MAX_FILES) return fail('Please choose up to ' + MAX_FILES + ' files. You can email the rest later.');
      for (var i = 0; i < files.length; i++) {
        if (files[i].size > MAX_BYTES) return fail('"' + files[i].name + '" is larger than 8 MB. Please choose a smaller file or email it to us.');
      }

      button.disabled = true;
      status.textContent = 'Sending your details…';
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; }); })
        .then(function (result) {
          if (!result.ok) throw new Error(result.body.error || 'Something went wrong.');
          var done = document.getElementById('enquiry-done');
          form.hidden = true;
          done.hidden = false;
          done.focus();
        })
        .catch(function (error) {
          var message = error instanceof TypeError ? 'We could not reach our server.' : error.message;
          fail(message + ' Please try again, or email us and we will sort it out.');
        })
        .then(function () { button.disabled = false; });
    });

    function fail(message) {
      status.textContent = message;
      status.className = 'form-status error';
    }
  }
})();
