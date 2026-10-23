/* A stand-in for window.octabizBooking, the SDK Octabiz gives custom booking pages.
   Same calls and shapes as the real one (octabiz.ai/developers/docs/booking-themes), with fake,
   deterministic open times: weekdays 9am–5pm, a couple of busy hours, every 11th day fully booked.
   Add ?error=taken to the preview URL to see SLOT_TAKEN, ?error=payment for PAYMENT_FAILED.
   The preview host puts the page data in window.__octabizBookingPage before this file runs. */
(function (global) {
  'use strict';
  var params = new URLSearchParams(global.location.search);
  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  var listeners = {};
  var DAY = 86400000;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var page = global.__octabizBookingPage || {};
  var service = page.service || {};
  var kind = service.kind || null;

  function pad(n) { return String(n).padStart(2, '0'); }
  function offsetOf(dateStr) { return Math.round((new Date(dateStr + 'T00:00:00') - today) / DAY); }
  function isOpen(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var off = offsetOf(dateStr);
    return off >= 1 && off <= 60 && d.getDay() > 0 && d.getDay() < 6 && off % 11 !== 4;
  }
  function wait(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 180); }); }
  function fail(code, message, extra) { var e = new Error(message); e.code = code; Object.assign(e, extra || {}); return Promise.reject(e); }
  function emit(name, payload) { (listeners[name] || []).forEach(function (fn) { try { fn(payload); } catch (_) { /* analytics only */ } }); }
  function money(n) {
    var cur = (service.price && service.price.currency) || 'USD';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  }
  function setting(ref) {
    var id = String(ref || '').replace(/^settings\./, '');
    return Number(kind && kind.settings ? kind.settings[id] : 0) || 0;
  }
  /** Units already out at a given hour, so the pool visibly shrinks on some times. */
  function busyUnits(off, h) { return Math.round(((off * 7 + h * 3) % 9) * kind.capacity.total / 12); }

  // ------------------------------------------------------------------ fields
  function fieldError(f, v) {
    var empty = v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length);
    if (empty) return f.required ? (f.type === 'checkbox' ? 'Tick this to continue.' : 'Fill this in to continue.') : null;
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "That doesn't look like an email address.";
    if (f.type === 'url' && !/^https?:\/\/\S+\.\S+/.test(v)) return 'Paste the full link, starting with https://';
    if (f.type === 'phone' && String(v).replace(/\D/g, '').length < 7) return 'Add the full phone number.';
    if (f.type === 'number') {
      var n = Number(v);
      if (!isFinite(n)) return 'Enter a number.';
      if (f.min != null && n < f.min) return 'The lowest is ' + f.min + (f.unit ? ' ' + f.unit : '') + '.';
      if (f.max != null && n > f.max) return 'The highest is ' + f.max + (f.unit ? ' ' + f.unit : '') + '.';
    }
    if (f.maxLength && String(v).length > f.maxLength) return 'Keep it under ' + f.maxLength + ' characters.';
    if (f.type === 'date' && f.dates) {
      var d = new Date(v + 'T00:00:00');
      if (f.dates === 'past' && d > today) return 'Pick a date in the past.';
      if (f.dates === 'future' && d < today) return 'Pick a date from today on.';
    }
    return null;
  }
  function validateAll(answers) {
    var errors = {};
    (page.fields || []).forEach(function (f) {
      var err = fieldError(f, answers[f.id]);
      if (err) errors[f.id] = err;
    });
    return { ok: !Object.keys(errors).length, errors: errors };
  }

  // ------------------------------------------------------------------ pricing
  function quoteFor(selection, answers) {
    selection = selection || {};
    answers = answers || {};
    var lines = [];
    var total = 0;
    if (kind && kind.pricing) {
      var p = kind.pricing;
      var rate = setting(p.rate);
      var qty = selection.quantity || 1;
      var hours = (selection.minutes || 60) / 60;
      var amount = rate;
      var parts = [];
      (p.per || []).forEach(function (per) {
        if (per === 'unit' || per === 'person') { amount *= qty; parts.push(qty + ' ' + (qty === 1 ? kind.capacity.unitLabel : kind.capacity.unitLabelPlural || kind.capacity.unitLabel + 's')); }
        if (per === 'hour') { amount *= hours; parts.push(hours + (hours === 1 ? ' hour' : ' hours')); }
      });
      lines.push({ label: parts.join(' × ') + ' at ' + money(rate), amountText: money(amount) });
      total += amount;
      (p.addOns || []).forEach(function (a) {
        var v = answers[a.field];
        var count = typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) || 0;
        if (!count) return;
        var each = setting(a.each);
        lines.push({ label: a.label + (count > 1 ? ' × ' + count : ''), amountText: money(each * count) });
        total += each * count;
      });
    } else if (service.price) {
      lines.push({ label: service.name, amountText: service.priceText });
      total = service.price.amount || 0;
    }
    return { lines: lines, total: total, totalText: total ? money(total) : 'Free', upfront: !!(service.price && service.price.upfront) };
  }

  // ------------------------------------------------------------------ the SDK
  var sdk = {
    /** The page's data, read-only. */
    page: page,
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
    /** Open times for a day: [{ start, end, remaining? }] as ISO strings (UTC). A selection
        ({ minutes, quantity }) keeps only the starts where that length and quantity fit. */
    getSlots: function (_serviceId, date, _tz, selection) {
      if (!isOpen(date)) return wait([]);
      var off = offsetOf(date);
      var minutes = (selection && selection.minutes) || service.durationMin || 60;
      var qty = (selection && selection.quantity) || 1;
      var units = kind && kind.capacity && kind.capacity.mode !== 'one';
      var out = [];
      for (var h = 9; h < 17; h++) {
        if (h + minutes / 60 > 17) break;
        var slot = { start: new Date(date + 'T' + pad(h) + ':00:00').toISOString() };
        slot.end = new Date(new Date(slot.start).getTime() + minutes * 60000).toISOString();
        if (units) {
          var free = kind.capacity.total;
          for (var k = h; k < h + minutes / 60; k++) free = Math.min(free, kind.capacity.total - busyUnits(off, k));
          if (free < qty) continue;
          slot.remaining = free;
        } else if ((off * 5 + h) % 4 === 0) continue;
        out.push(slot);
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
    /** Every field this booking asks for, in order. */
    getFields: function () { return wait(page.fields || []); },
    /** Reads the data-bk="fields" form: { guest, answers }, or null after marking what's wrong. */
    readFields: function () {
      var form = document.querySelector('[data-bk="fields"]');
      if (!form) return null;
      var answers = {};
      (page.fields || []).forEach(function (f) {
        var nodes = form.querySelectorAll('[name="' + f.id + '"]');
        if (f.type === 'checkbox') answers[f.id] = !!(nodes[0] && nodes[0].checked);
        else if (f.type === 'multiselect') answers[f.id] = [].filter.call(nodes, function (n) { return n.checked; }).map(function (n) { return n.value; });
        else if (f.type === 'select' && f.display === 'chips') { var on = [].filter.call(nodes, function (n) { return n.checked; })[0]; answers[f.id] = on ? on.value : ''; }
        else answers[f.id] = nodes[0] ? nodes[0].value.trim() : '';
      });
      var result = validateAll(answers);
      form.querySelectorAll('[data-field]').forEach(function (wrap) {
        var id = wrap.getAttribute('data-field');
        var err = wrap.querySelector('.bkf-err');
        wrap.toggleAttribute('data-invalid', !!result.errors[id]);
        err.textContent = result.errors[id] || '';
      });
      if (!result.ok) {
        var first = form.querySelector('[data-invalid] input, [data-invalid] textarea, [data-invalid] select');
        if (first) first.focus();
        return null;
      }
      var guest = { name: answers.name, email: answers.email, phone: answers.phone };
      ['name', 'email', 'phone'].forEach(function (k) { delete answers[k]; });
      return { guest: guest, answers: answers };
    },
    /** The same check the server runs: { ok, errors: { fieldId: sentence } }. */
    validate: function (_serviceId, answers) { return wait(validateAll(answers || {})); },
    /** The price for what the customer picked, worked out by Octabiz. */
    quote: function (_serviceId, selection, answers) { return wait(quoteFor(selection, answers)); },
    /** Books it. Paid-upfront services confirm the payment frame first. */
    book: function (input) {
      if (!input || !input.holdId) return fail('HOLD_EXPIRED', 'Your time was held for 10 minutes and it ran out. Pick the time again.');
      var check = validateAll(Object.assign({}, input.answers, input.guest));
      if (!check.ok) return fail('FIELD_INVALID', 'Some answers need another look.', { fields: check.errors });
      if (params.get('error') === 'payment') return fail('PAYMENT_FAILED', 'Your card was declined. Try another card, or pay with PayPal.');
      emit('booked', {});
      return wait({ booked: true }).then(function (r) { sdk.navigate('confirmed'); return r; });
    },
    /** Level 2 name for book(); still works. */
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

  // ------------------------------------------------------------------ what Octabiz fills in
  var CSS = [
    '.bkf{display:flex;flex-direction:column;gap:16px;font-family:var(--bk-body),system-ui,sans-serif;color:var(--bk-ink)}',
    '.bkf-field{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:600}',
    '.bkf-opt{color:var(--bk-muted);font-weight:500}',
    '.bkf-help{color:var(--bk-muted);font-size:13px;font-weight:400;margin:-2px 0 0}',
    '.bkf-input{font:inherit;font-weight:400;font-size:15px;color:var(--bk-ink);background:var(--bk-surface);border:1px solid var(--bk-line);border-radius:var(--bk-r-sm);padding:11px 13px;min-height:44px;box-sizing:border-box;width:100%}',
    '.bkf-input:focus{outline:2px solid var(--bk-primary);outline-offset:1px;border-color:var(--bk-primary)}',
    'textarea.bkf-input{min-height:88px;resize:vertical}',
    '.bkf-unit{display:flex;align-items:center;gap:8px}.bkf-unit span{color:var(--bk-muted);font-weight:500}',
    '.bkf-chips{display:flex;flex-wrap:wrap;gap:8px}',
    '.bkf-chip{position:relative}.bkf-chip input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}',
    '.bkf-chip span{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1px solid var(--bk-line);border-radius:var(--bk-r-btn);background:var(--bk-surface);font-weight:500;box-sizing:border-box}',
    '.bkf-chip input:checked+span{background:var(--bk-primary);color:var(--bk-on-primary);border-color:var(--bk-primary)}',
    '.bkf-chip input:focus-visible+span{outline:2px solid var(--bk-primary);outline-offset:2px}',
    '.bkf-check{display:flex;gap:10px;align-items:flex-start;font-weight:500;line-height:1.45;min-height:44px}',
    '.bkf-check input{width:20px;height:20px;margin:1px 0 0;accent-color:var(--bk-primary);flex:none}',
    '.bkf-err{color:#b42318;font-size:13px;font-weight:500;margin:0}.bkf-err:empty{display:none}',
    '[data-invalid] .bkf-input,[data-invalid] .bkf-chip span{border-color:#b42318}',
    '.bkf-pay{display:flex;flex-direction:column;gap:10px;font-family:var(--bk-body),system-ui,sans-serif}',
    '.bkf-pay-box{border:1px solid var(--bk-line);border-radius:var(--bk-r-sm);background:var(--bk-surface);overflow:hidden}',
    '.bkf-pay-row{display:flex;align-items:center;gap:10px;padding:12px 13px;color:var(--bk-muted);font-size:15px;min-height:44px;box-sizing:border-box}',
    '.bkf-pay-row+.bkf-pay-row{border-top:1px solid var(--bk-line)}.bkf-pay-split{display:grid;grid-template-columns:1fr 1fr}.bkf-pay-split span+span{border-left:1px solid var(--bk-line);padding-left:13px}',
    '.bkf-pay-note{color:var(--bk-muted);font-size:12.5px;margin:0}',
    '.bkf-desc{line-height:1.65}.bkf-desc p{margin:0 0 12px}.bkf-desc ul{margin:0 0 12px;padding-left:20px}.bkf-desc li{margin:4px 0}',
  ].join('');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fieldHtml(f) {
    var id = 'bkf-' + f.id;
    var label = esc(f.label) + (f.required ? '' : ' <span class="bkf-opt">· optional</span>');
    var help = f.help ? '<p class="bkf-help" id="' + id + '-help">' + esc(f.help) + '</p>' : '';
    var desc = ' aria-describedby="' + id + '-err' + (f.help ? ' ' + id + '-help' : '') + '"';
    var err = '<p class="bkf-err" id="' + id + '-err" role="alert"></p>';
    var input;
    if (f.type === 'checkbox') {
      return '<div class="bkf-field" data-field="' + f.id + '"><label class="bkf-check"><input type="checkbox" name="' + f.id + '"' + desc + '><span>' + esc(f.label) + '</span></label>' + help + err + '</div>';
    }
    if ((f.type === 'select' && f.display === 'chips') || f.type === 'multiselect') {
      var type = f.type === 'multiselect' ? 'checkbox' : 'radio';
      input = '<div class="bkf-chips" role="group" aria-labelledby="' + id + '-l">' + (f.options || []).map(function (o) {
        return '<label class="bkf-chip"><input type="' + type + '" name="' + f.id + '" value="' + esc(o) + '"' + desc + '><span>' + esc(o) + '</span></label>';
      }).join('') + '</div>';
      return '<div class="bkf-field" data-field="' + f.id + '"><span id="' + id + '-l">' + label + '</span>' + help + input + err + '</div>';
    }
    if (f.type === 'select') {
      input = '<select class="bkf-input" id="' + id + '" name="' + f.id + '"' + desc + '><option value="">Choose…</option>' + (f.options || []).map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      input = '<textarea class="bkf-input" id="' + id + '" name="' + f.id + '" rows="3"' + (f.maxLength ? ' maxlength="' + f.maxLength + '"' : '') + desc + '></textarea>';
    } else {
      var html = { email: 'email', phone: 'tel', url: 'url', number: 'number', date: 'date' }[f.type] || 'text';
      var auto = { name: ' autocomplete="name"', email: ' autocomplete="email"', phone: ' autocomplete="tel"' }[f.id] || '';
      var extra = (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + (f.step != null ? ' step="' + f.step + '"' : '') + (f.maxLength ? ' maxlength="' + f.maxLength + '"' : '') + (f.type === 'number' ? ' inputmode="decimal"' : '');
      input = '<input class="bkf-input" type="' + html + '" id="' + id + '" name="' + f.id + '"' + auto + extra + desc + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
      if (f.unit) input = '<span class="bkf-unit">' + input + '<span>' + esc(f.unit) + '</span></span>';
    }
    return '<div class="bkf-field" data-field="' + f.id + '"><label for="' + id + '">' + label + '</label>' + help + input + err + '</div>';
  }

  function fill() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
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
    // The business's formatted description. The real one is cleaned by Octabiz; the sample is trusted.
    document.querySelectorAll('[data-bk="description"]').forEach(function (n) {
      n.classList.add('bkf-desc');
      n.innerHTML = service.descriptionHtml || '<p>' + esc(service.description) + '</p>';
    });
    document.querySelectorAll('[data-bk="fields"]').forEach(function (n) {
      n.classList.add('bkf');
      n.innerHTML = (page.fields || []).map(fieldHtml).join('');
    });
    document.querySelectorAll('[data-bk="payment"]').forEach(function (n) {
      if (!(service.price && service.price.upfront)) { n.hidden = true; return; }
      n.classList.add('bkf-pay');
      // As on Octabiz: the amount, and payment on Stripe's page after book(). No card fields on your page.
      n.innerHTML = '<div class="bkf-pay-box"><div class="bkf-pay-row"><b style="color:var(--bk-ink)">' + esc(service.priceText) + '</b>&nbsp;due now</div></div>' +
        '<p class="bkf-pay-note">After you press Book, you pay by card on Stripe’s secure page. Your card details never reach this page.</p>';
    });
    // The built-in Your details page: Book it checks the fields the same way the server does.
    var bookIt = document.getElementById('bkp-book');
    if (bookIt) bookIt.addEventListener('click', function () { if (sdk.readFields()) sdk.navigate('confirmed'); });
  }
  fill();
})(window);
