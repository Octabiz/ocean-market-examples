// Northline: the whole booking on one page. Open times, the hold, field checks and payment all
// come from window.octabizBooking; this file only draws them and keeps the steps in order.
(function () {
  'use strict';
  var bk = window.octabizBooking;
  var svc = bk.page.service;
  var tz = bk.page.timezone;
  var $ = function (id) { return document.getElementById(id); };
  var pay = $('nl-pay');
  var payLabel = 'Pay ' + svc.priceText + ' and book';

  var start = new Date();
  start.setDate(start.getDate() + 1);
  var first = new Date(start.getFullYear(), start.getMonth(), 1);
  var shown = new Date(first);
  var day = null;     // 'YYYY-MM-DD' the customer is looking at
  var held = null;    // { holdId, expiresAt, start }
  var timer = null;

  // The business may not have a cover photo: the template can't leave the <img> out, so drop it here.
  var cover = document.querySelector('.nl-cover');
  if (cover && !cover.getAttribute('src')) cover.remove();

  function pad(n) { return String(n).padStart(2, '0'); }
  function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function say(id, text) { $(id).textContent = text || ''; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function drawMonth() {
    $('nl-month-label').textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(shown);
    $('nl-prev').disabled = shown <= first;
    var cal = $('nl-cal');
    return bk.getMonth(svc.id, monthKey(shown), tz).then(function (days) {
      var cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(function (w) { return el('span', 'nl-wd', w); });
      var lead = (new Date(shown.getFullYear(), shown.getMonth(), 1).getDay() + 6) % 7;
      for (var i = 0; i < lead; i++) cells.push(el('span'));
      days.forEach(function (d) {
        var n = Number(d.date.slice(8));
        if (!d.open) { cells.push(el('span', 'nl-day', n)); return; }
        var b = el('button', 'nl-day', n);
        b.type = 'button';
        b.dataset.date = d.date;
        b.setAttribute('aria-pressed', String(d.date === day));
        b.setAttribute('aria-label', bk.formatDay(d.date + 'T12:00:00') + ', open');
        b.addEventListener('click', function () { pickDay(d.date); });
        cells.push(b);
      });
      cal.replaceChildren.apply(cal, cells);
      return days;
    });
  }

  function pickDay(date) {
    day = date;
    [].forEach.call($('nl-cal').querySelectorAll('button.nl-day'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.date === date));
    });
    loadTimes();
  }

  function loadTimes() {
    var box = $('nl-times');
    box.replaceChildren(el('p', 'nl-times-note', 'Loading times…'));
    return bk.getSlots(svc.id, day, tz).then(function (slots) {
      if (!slots.length) { box.replaceChildren(el('p', 'nl-times-note', 'Nothing left on this day. Try another.')); return; }
      box.replaceChildren.apply(box, slots.map(function (s) {
        var b = el('button', 'nl-time', bk.formatTime(s.start));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(!!held && held.start === s.start));
        b.addEventListener('click', function () { holdTime(s, b); });
        return b;
      }));
    }, function (e) { box.replaceChildren(el('p', 'nl-times-note', e.message)); });
  }

  // Picking a time holds it straight away, so it can't go while the customer types their details.
  function holdTime(slot, button) {
    say('nl-error');
    var buttons = $('nl-times').querySelectorAll('.nl-time');
    [].forEach.call(buttons, function (b) { b.disabled = true; });
    bk.hold(svc.id, slot.start).then(function (h) {
      held = { holdId: h.holdId, expiresAt: h.expiresAt, start: slot.start };
      [].forEach.call(buttons, function (b) { b.disabled = false; b.setAttribute('aria-pressed', String(b === button)); });
      pay.disabled = false;
      pay.textContent = payLabel;
      tick();
    }, function (e) {
      say('nl-error', e.message);
      release();
      loadTimes();
    });
  }

  function release() {
    held = null;
    clearInterval(timer);
    say('nl-held');
    pay.disabled = true;
    pay.textContent = 'Pick a time first';
  }

  function tick() {
    clearInterval(timer);
    var when = bk.formatDay(held.start) + ' at ' + bk.formatTime(held.start);
    function update() {
      var left = Math.max(0, Math.round((new Date(held.expiresAt) - Date.now()) / 1000));
      if (!left) {
        release();
        say('nl-error', 'We held ' + when + ' for 10 minutes and it ran out. Pick the time again.');
        loadTimes();
        return;
      }
      say('nl-held', when + ' is yours for ' + Math.floor(left / 60) + ':' + pad(left % 60) + ' while you finish.');
    }
    update();
    timer = setInterval(update, 1000);
  }

  pay.addEventListener('click', function () {
    if (!held) return;
    say('nl-error');
    var filled = bk.readFields();
    if (!filled) return;
    pay.setAttribute('aria-busy', 'true');
    pay.textContent = 'Booking…';
    bk.book({ holdId: held.holdId, guest: filled.guest, answers: filled.answers }).then(function () {
      clearInterval(timer);
      pay.removeAttribute('aria-busy');
      pay.textContent = 'Booked';
      pay.disabled = true;
    }, function (e) {
      pay.removeAttribute('aria-busy');
      pay.textContent = payLabel;
      say('nl-error', e.message);
      if (e.code === 'SLOT_TAKEN' || e.code === 'HOLD_EXPIRED') { release(); loadTimes(); }
    });
  });

  $('nl-prev').addEventListener('click', function () { shown.setMonth(shown.getMonth() - 1); drawMonth(); });
  $('nl-next').addEventListener('click', function () { shown.setMonth(shown.getMonth() + 1); drawMonth(); });
  $('nl-tz').addEventListener('change', function (e) {
    tz = e.target.value;
    bk.setTimezone(tz);
    if (day) loadTimes();
  });

  // On a phone the "Book a time" bar steps aside once the booking panel is on screen.
  var jump = $('nl-jump');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { jump.hidden = entries[0].isIntersecting; }).observe($('nl-book'));
  }

  // Start on the first open day, so times are on screen without a click (next month if this one is full).
  drawMonth().then(function (days) {
    var open = days.filter(function (d) { return d.open && d.date >= monthKey(start) + '-' + pad(start.getDate()); })[0];
    if (open) return pickDay(open.date);
    shown.setMonth(shown.getMonth() + 1);
    return drawMonth().then(function (next) {
      var later = next.filter(function (d) { return d.open; })[0];
      if (later) pickDay(later.date);
    });
  });
})();
