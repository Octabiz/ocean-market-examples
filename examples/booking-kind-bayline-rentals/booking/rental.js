// Bayline: the page for the "Equipment rental" service kind. The customer picks a day, how long and
// how many; Octabiz answers with the start times where that many are free (getSlots with a selection)
// and the price (quote). This file never counts stock or adds up money itself.
(function () {
  'use strict';
  var bk = window.octabizBooking;
  var svc = bk.page.service;
  var kind = svc.kind;
  var cap = kind.capacity;
  var range = kind.time;
  var tz = bk.page.timezone;
  var $ = function (id) { return document.getElementById(id); };
  var book = $('by-book');

  var minutes = Math.min(range.maxMinutes, Math.max(range.minMinutes, 180));
  var qty = 1;
  var day = null;
  var held = null;   // { holdId, expiresAt, start, end }
  var timer = null;
  var quoted = null;

  var cover = document.querySelector('.by-cover');
  if (cover && !cover.getAttribute('src')) cover.remove();

  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function units(n) { return n + ' ' + (n === 1 ? cap.unitLabel : cap.unitLabelPlural || cap.unitLabel + 's'); }
  function hours(m) { var h = m / 60; return h + (h === 1 ? ' hour' : ' hours'); }
  function say(id, text) { $(id).textContent = text || ''; }

  // ---------------------------------------------------------------- length and quantity
  function drawSteppers() {
    $('by-hours').textContent = hours(minutes);
    $('by-qty').textContent = units(qty);
    $('by-hours-less').disabled = minutes <= range.minMinutes;
    $('by-hours-more').disabled = minutes >= range.maxMinutes;
    $('by-qty-less').disabled = qty <= 1;
    $('by-qty-more').disabled = qty >= cap.maxPerBooking;
    say('by-hours-hint', range.minMinutes / 60 + ' to ' + range.maxMinutes / 60 + ' hours');
    say('by-qty-hint', 'Up to ' + cap.maxPerBooking + ' per booking');
  }
  function change(dm, dq) {
    minutes = Math.min(range.maxMinutes, Math.max(range.minMinutes, minutes + dm));
    qty = Math.min(cap.maxPerBooking, Math.max(1, qty + dq));
    drawSteppers();
    // A hold is for one length and one quantity, so changing either lets the old one go.
    if (held) { release(); say('by-held', 'You changed your rental, so pick a start time again.'); }
    loadTimes();
    requote();
  }
  $('by-hours-less').addEventListener('click', function () { change(-range.stepMinutes, 0); });
  $('by-hours-more').addEventListener('click', function () { change(range.stepMinutes, 0); });
  $('by-qty-less').addEventListener('click', function () { change(0, -1); });
  $('by-qty-more').addEventListener('click', function () { change(0, 1); });

  // ---------------------------------------------------------------- days
  function drawDays() {
    var from = new Date();
    from.setDate(from.getDate() + 1);
    var months = [ymd(from).slice(0, 7), ymd(new Date(from.getFullYear(), from.getMonth() + 1, 1)).slice(0, 7)];
    return Promise.all(months.map(function (m) { return bk.getMonth(svc.id, m, tz); })).then(function (lists) {
      var open = {};
      lists.forEach(function (l) { l.forEach(function (d) { open[d.date] = d.open; }); });
      var box = $('by-days');
      var buttons = [];
      for (var i = 0; i < 14; i++) {
        var d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
        var key = ymd(d);
        var b = el('button', 'by-day');
        b.type = 'button';
        b.dataset.date = key;
        b.append(el('small', null, new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d)), el('b', null, d.getDate()));
        b.setAttribute('aria-label', bk.formatDay(key + 'T12:00:00') + (open[key] ? '' : ', closed'));
        b.disabled = !open[key];
        b.addEventListener('click', pickDay.bind(null, key));
        buttons.push(b);
      }
      box.replaceChildren.apply(box, buttons);
      return buttons.filter(function (b) { return !b.disabled; }).map(function (b) { return b.dataset.date; });
    });
  }
  function pickDay(key) {
    day = key;
    [].forEach.call($('by-days').children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.date === key)); });
    if (held) release();
    loadTimes();
  }

  // ---------------------------------------------------------------- start times
  function loadTimes() {
    if (!day) return;
    var box = $('by-times');
    box.replaceChildren(el('p', 'by-note', 'Checking what’s free…'));
    bk.getSlots(svc.id, day, tz, { minutes: minutes, quantity: qty }).then(function (slots) {
      if (!slots.length) {
        box.replaceChildren(el('p', 'by-note', 'Not enough free for ' + hours(minutes) + ' that day. Try fewer ' + (cap.unitLabelPlural || cap.unitLabel + 's') + ', a shorter rental or another day.'));
        return;
      }
      box.replaceChildren.apply(box, slots.map(function (s) {
        var b = el('button', 'by-time');
        b.type = 'button';
        b.append(el('b', null, bk.formatTime(s.start)), el('small', null, 'back by ' + bk.formatTime(s.end)), el('small', 'by-left', s.remaining + ' left'));
        b.setAttribute('aria-pressed', String(!!held && held.start === s.start));
        b.addEventListener('click', function () { holdTime(s, b); });
        return b;
      }));
    }, function (e) { box.replaceChildren(el('p', 'by-note', e.message)); });
  }

  function holdTime(slot, button) {
    say('by-error');
    var all = $('by-times').querySelectorAll('.by-time');
    [].forEach.call(all, function (b) { b.disabled = true; });
    bk.hold(svc.id, slot.start, { minutes: minutes, quantity: qty }).then(function (h) {
      held = { holdId: h.holdId, expiresAt: h.expiresAt, start: slot.start, end: slot.end };
      [].forEach.call(all, function (b) { b.disabled = false; b.setAttribute('aria-pressed', String(b === button)); });
      say('by-when', bk.formatDay(slot.start) + ', ' + bk.formatTime(slot.start) + ' to ' + bk.formatTime(slot.end) + ' · ' + units(qty));
      book.disabled = false;
      setBookLabel();
      tick();
    }, function (e) {
      [].forEach.call(all, function (b) { b.disabled = false; });
      say('by-error', e.message);
      loadTimes();
    });
  }
  function release() {
    held = null;
    clearInterval(timer);
    say('by-held');
    say('by-when', 'Pick a day and a start time.');
    book.disabled = true;
    book.textContent = 'Pick a start time';
  }
  function tick() {
    clearInterval(timer);
    function update() {
      var left = Math.max(0, Math.round((new Date(held.expiresAt) - Date.now()) / 1000));
      if (!left) { release(); say('by-error', 'We held your ' + cap.unitLabelPlural + ' for 10 minutes and the time ran out. Pick a start time again.'); loadTimes(); return; }
      say('by-held', 'Held for you for ' + Math.floor(left / 60) + ':' + pad(left % 60) + '.');
    }
    update();
    timer = setInterval(update, 1000);
  }

  // ---------------------------------------------------------------- price
  function answersNow() {
    var bags = document.querySelector('[data-bk="fields"] [name="dry_bags"]');
    return { dry_bags: bags ? Number(bags.value) || 0 : 0 };
  }
  function requote() {
    bk.quote(svc.id, { minutes: minutes, quantity: qty }, answersNow()).then(function (q) {
      quoted = q;
      var dl = $('by-lines');
      var rows = [];
      q.lines.forEach(function (l) { rows.push(el('dt', null, l.label), el('dd', null, l.amountText)); });
      dl.replaceChildren.apply(dl, rows);
      say('by-total', q.totalText);
      setBookLabel();
    });
  }
  function setBookLabel() {
    if (held && quoted) book.textContent = (quoted.upfront ? 'Pay ' + quoted.totalText + ' and book' : 'Book it');
  }
  document.querySelector('[data-bk="fields"]').addEventListener('input', function (e) {
    if (e.target.name === 'dry_bags') requote();
  });

  // ---------------------------------------------------------------- book
  book.addEventListener('click', function () {
    if (!held) return;
    say('by-error');
    var filled = bk.readFields();
    if (!filled) return;
    book.setAttribute('aria-busy', 'true');
    book.textContent = 'Booking…';
    bk.book({ holdId: held.holdId, guest: filled.guest, answers: filled.answers }).then(function () {
      clearInterval(timer);
      book.removeAttribute('aria-busy');
      book.textContent = 'Booked';
      book.disabled = true;
    }, function (e) {
      book.removeAttribute('aria-busy');
      setBookLabel();
      say('by-error', e.message);
      if (e.code === 'SLOT_TAKEN' || e.code === 'HOLD_EXPIRED') { release(); loadTimes(); }
    });
  });

  $('by-tz').addEventListener('change', function (e) { tz = e.target.value; bk.setTimezone(tz); loadTimes(); });

  drawSteppers();
  requote();
  drawDays().then(function (open) { if (open.length) pickDay(open[0]); });
})();
