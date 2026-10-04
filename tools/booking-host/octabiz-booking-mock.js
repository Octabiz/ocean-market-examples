/* A stand-in for window.octabizBooking, the SDK Octabiz gives custom booking pages.
   Same calls and shapes as the real one (octabiz.ai/developers/docs/booking-themes), with fake,
   deterministic open times: weekdays 9am–5pm, a couple of busy hours, every 11th day fully booked.
   Add ?error=taken to the preview URL to see what SLOT_TAKEN looks like. */
(function (global) {
  'use strict';
  var params = new URLSearchParams(global.location.search);
  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  var listeners = {};
  var DAY = 86400000;
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function offsetOf(dateStr) { return Math.round((new Date(dateStr + 'T00:00:00') - today) / DAY); }
  function isOpen(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var off = offsetOf(dateStr);
    return off >= 1 && off <= 60 && d.getDay() > 0 && d.getDay() < 6 && off % 11 !== 4;
  }
  function wait(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 180); }); }
  function fail(code, message) { var e = new Error(message); e.code = code; return Promise.reject(e); }
  function emit(name, payload) { (listeners[name] || []).forEach(function (fn) { try { fn(payload); } catch (_) { /* analytics only */ } }); }

  var sdk = {
    /** Days in a month with open times: [{ date: 'YYYY-MM-DD', open: boolean }]. */
    getMonth: function (_serviceId, month) {
      var parts = month.split('-').map(Number);
      var days = new Date(parts[0], parts[1], 0).getDate();
      var out = [];
      for (var i = 1; i <= days; i++) {
        var key = parts[0] + '-' + pad(parts[1]) + '-' + pad(i);
        out.push({ date: key, open: isOpen(key) });
      }
      return wait(out);
    },
    /** Open times for a day: [{ start, end }] as ISO strings (UTC). */
    getSlots: function (_serviceId, date) {
      if (!isOpen(date)) return wait([]);
      var off = offsetOf(date);
      var out = [];
      for (var h = 9; h < 17; h++) {
        if ((off * 5 + h) % 4 === 0) continue;
        var s = new Date(date + 'T' + pad(h) + ':00:00');
        out.push({ start: s.toISOString(), end: new Date(s.getTime() + 60 * 60000).toISOString() });
      }
      return wait(out);
    },
    /** Holds a time for 10 minutes: { holdId, expiresAt }. Errors are BookingError { code, message }. */
    hold: function (_serviceId, start) {
      if (params.get('error') === 'taken') {
        return fail('SLOT_TAKEN', sdk.formatTime(start) + ' on ' + sdk.formatDay(start) + ' was just booked by someone else. Pick another time.');
      }
      emit('slot:selected', { start: start });
      return wait({ holdId: 'hold_' + Math.random().toString(36).slice(2, 8), expiresAt: new Date(Date.now() + 600000).toISOString() });
    },
    create: function () { emit('booked', {}); return wait({ appointment: { id: 'appt_sample' } }); },
    reschedule: function () { emit('rescheduled', {}); return wait({ ok: true }); },
    cancel: function () { emit('cancelled', {}); return wait({ ok: true }); },
    setTimezone: function (next) { tz = next; },
    formatTime: function (iso) {
      return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso)).replace(' AM', 'am').replace(' PM', 'pm');
    },
    formatDay: function (iso) {
      return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
    },
    /** Moves between steps. In this preview it just says where it would go. */
    navigate: function (step, query) {
      var bar = document.getElementById('bk-mock-nav') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'bk-mock-nav' }));
      bar.setAttribute('role', 'status');
      bar.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#111827;color:#fff;padding:12px 18px;border-radius:12px;font:14px system-ui;z-index:9;box-shadow:0 10px 30px rgba(0,0,0,.3)';
      bar.textContent = 'Octabiz would now open the "' + step + '" page' + (query && query.hold ? ' with hold ' + query.hold : '') + '.';
    },
    /** Analytics only: 'slot:selected' | 'booked' | 'rescheduled' | 'cancelled'. Can't block the flow. */
    on: function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
  };
  global.octabizBooking = sdk;

  // The parts Octabiz fills in for every custom page.
  function fill() {
    document.querySelectorAll('select[data-bk="timezone"]').forEach(function (sel) {
      var zones = [tz, 'America/Toronto', 'America/Los_Angeles', 'Europe/London', 'Asia/Dubai', 'Asia/Tokyo'].filter(function (z, i, a) { return a.indexOf(z) === i; });
      sel.replaceChildren.apply(sel, zones.map(function (z) {
        return Object.assign(document.createElement('option'), { value: z, textContent: z.split('/').pop().replace(/_/g, ' ') });
      }));
      sel.value = tz;
    });
    document.querySelectorAll('[data-bk="powered-by"]').forEach(function (n) { n.innerHTML = 'Powered by <b>Octabiz</b>'; });
    document.querySelectorAll('[data-bk="terms"]').forEach(function (n) {
      n.innerHTML = 'By booking, you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.';
    });
  }
  fill();
})(window);
