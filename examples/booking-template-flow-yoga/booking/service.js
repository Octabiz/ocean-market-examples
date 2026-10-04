// Flow Yoga service page behaviour. Everything about availability comes from window.octabizBooking:
// open days and times are worked out on Octabiz's servers (notice, hours, other calendars, holds),
// never in the browser. This file only draws them and moves the customer on.
(function () {
  'use strict';
  const bk = window.octabizBooking;
  const root = document.querySelector('.fy');
  if (!bk || !root) return;

  const serviceId = root.dataset.serviceId;
  const $ = (name) => root.querySelector(`[data-fy="${name}"]`);
  const tzSelect = root.querySelector('[data-bk="timezone"]');
  const state = { tz: tzSelect && tzSelect.value ? tzSelect.value : Intl.DateTimeFormat().resolvedOptions().timeZone, day: null, slot: null };

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const el = (tag, props, children) => {
    const node = Object.assign(document.createElement(tag), props || {});
    (children || []).forEach((c) => node.append(c));
    return node;
  };

  function showError(message) {
    const box = $('error');
    box.textContent = message || '';
    box.hidden = !message;
  }

  // Two months of days, so the strip always has something to show near a month's end.
  async function loadDays() {
    const days = $('days');
    days.replaceChildren(el('span', { className: 'fy-loading', textContent: 'Finding open days…' }));
    try {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const [a, b] = await Promise.all([bk.getMonth(serviceId, ym(now), state.tz), bk.getMonth(serviceId, ym(next), state.tz)]);
      const open = a.concat(b).filter((d) => d.open && d.date >= ymd(now)).slice(0, 14);
      if (!open.length) {
        days.replaceChildren(el('span', { className: 'fy-empty', textContent: 'No open times in the next two months.' }));
        return;
      }
      days.replaceChildren(
        ...open.map((d) => {
          const date = new Date(`${d.date}T12:00:00`);
          const btn = el('button', { type: 'button', className: 'fy-day' }, [
            el('small', { textContent: date.toLocaleDateString(undefined, { weekday: 'short' }) }),
            el('b', { textContent: String(date.getDate()) }),
            el('small', { textContent: date.toLocaleDateString(undefined, { month: 'short' }) }),
          ]);
          btn.dataset.date = d.date;
          btn.setAttribute('role', 'option');
          btn.setAttribute('aria-selected', String(d.date === state.day));
          btn.setAttribute('aria-label', bk.formatDay(`${d.date}T12:00:00`));
          btn.addEventListener('click', () => pickDay(d.date));
          return btn;
        }),
      );
      if (!state.day || !open.some((d) => d.date === state.day)) pickDay(open[0].date);
    } catch (e) {
      days.replaceChildren();
      showError(e && e.message ? e.message : 'Something went wrong. Try again.');
    }
  }

  async function pickDay(date) {
    state.day = date;
    state.slot = null;
    $('continue').hidden = true;
    showError('');
    root.querySelectorAll('.fy-day').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.date === date)));
    const slots = $('slots');
    slots.replaceChildren(el('span', { className: 'fy-loading', textContent: 'Loading times…' }));
    try {
      const list = await bk.getSlots(serviceId, date, state.tz);
      if (!list.length) {
        slots.replaceChildren(el('span', { className: 'fy-empty', textContent: 'Fully booked. Try another day.' }));
        return;
      }
      slots.replaceChildren(
        ...list.map((s) => {
          const btn = el('button', { type: 'button', className: 'fy-slot', textContent: bk.formatTime(s.start) });
          btn.setAttribute('aria-pressed', 'false');
          btn.addEventListener('click', () => pickSlot(s, btn));
          return btn;
        }),
      );
    } catch (e) {
      slots.replaceChildren();
      showError(e && e.message ? e.message : 'Something went wrong. Try again.');
    }
  }

  function pickSlot(slot, btn) {
    state.slot = slot;
    root.querySelectorAll('.fy-slot').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    $('picked').textContent = `${bk.formatDay(slot.start)} at ${bk.formatTime(slot.start)}`;
    $('continue').hidden = false;
    $('next').focus();
  }

  $('next').addEventListener('click', async () => {
    if (!state.slot) return;
    const next = $('next');
    next.disabled = true;
    try {
      // Holds the time for 10 minutes while the customer fills in their details.
      const hold = await bk.hold(serviceId, state.slot.start);
      bk.navigate('details', { hold: hold.holdId });
    } catch (e) {
      // Refresh the day's times (that one's gone), then show the reason. SLOT_TAKEN and
      // friends come back as plain sentences: show them as they are.
      if (state.day) pickDay(state.day);
      showError(e && e.message ? e.message : 'Something went wrong. Try again.');
    } finally {
      next.disabled = false;
    }
  });

  if (tzSelect) {
    tzSelect.addEventListener('change', () => {
      state.tz = tzSelect.value;
      bk.setTimezone(state.tz);
      loadDays();
    });
  }

  loadDays();
})();
