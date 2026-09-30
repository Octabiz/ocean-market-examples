/*
 * Birthday Reminders — an Ocean Market embedded app.
 * Permission: customers:read. Shows only the day and month of each birthday, never
 * the birth year or age: staff need no more to send a note, so the app keeps no more.
 */
(function () {
  'use strict';
  var B = window.OctabizBridge;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MAX_CUSTOMERS = 5000;

  var people = [];      // { name, email, phone, month, day } — year dropped on load
  var missing = 0;      // customers with no birthday on file
  var shown = [];

  var $ = function (id) { return document.getElementById(id); };
  function status(text, kind) {
    var el = $('status');
    el.textContent = text || '';
    el.className = 'status' + (kind === 'error' ? ' error' : '');
    el.hidden = !text;
  }

  B.ready()
    .then(function () {
      if (!B.hasScope('customers:read')) {
        status('Birthday Reminders needs permission to see your customers. Uninstall and reinstall it, and allow customer access.', 'error');
        return;
      }
      return load();
    })
    .catch(function (e) {
      if (e && e.message === 'NOT_EMBEDDED') status('Open Birthday Reminders from Ocean Market inside Octabiz to see your customers’ birthdays.');
      else status('Something went wrong: ' + (e && e.message), 'error');
    });

  function load() {
    status('Loading birthdays…');
    return Promise.all([
      B.listAll('customers.list', { with_birthday: true }, MAX_CUSTOMERS),
      B.listAll('customers.list', {}, MAX_CUSTOMERS),
    ])
      .then(function (res) {
        people = res[0].map(function (c) {
          var m = /^\d{4}-(\d{2})-(\d{2})/.exec(c.date_of_birth || '');
          return m ? { name: c.name || 'Unnamed customer', email: c.email || '', phone: c.phone || '', month: Number(m[1]) - 1, day: Number(m[2]) } : null;
        }).filter(Boolean);
        missing = Math.max(0, res[1].length - people.length);
        render();
      })
      .catch(function (e) { status('Couldn’t load your customers: ' + e.message, 'error'); });
  }

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  /** The birthday in year y. Feb 29 birthdays are celebrated on Feb 28 in other years. */
  function onYear(p, y) { return new Date(y, p.month, p.month === 1 && p.day === 29 && !isLeap(y) ? 28 : p.day); }
  function nextBirthday(p, today) {
    var d = onYear(p, today.getFullYear());
    return d < today ? onYear(p, today.getFullYear() + 1) : d;
  }

  function inWindow(date, days, choice, today) {
    if (choice === 'today') return days === 0;
    if (choice === 'this-month') return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    if (choice === 'next-month') {
      var nm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return date.getMonth() === nm.getMonth() && date.getFullYear() === nm.getFullYear();
    }
    return days <= Number(choice);
  }

  function render() {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var choice = $('window').value;
    var q = $('search').value.trim().toLowerCase();

    shown = people.map(function (p) {
      var date = nextBirthday(p, today);
      return { p: p, date: date, days: Math.round((date - today) / 86400000) };
    }).filter(function (r) {
      if (!inWindow(r.date, r.days, choice, today)) return false;
      return !q || (r.p.name + ' ' + r.p.email).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.days - b.days || a.p.name.localeCompare(b.p.name); });

    var groups = [
      { title: 'Today', rows: shown.filter(function (r) { return r.days === 0; }) },
      { title: 'This week', rows: shown.filter(function (r) { return r.days > 0 && r.days <= 7; }) },
      { title: 'Later', rows: shown.filter(function (r) { return r.days > 7; }) },
    ];
    var box = $('groups');
    box.textContent = '';
    groups.forEach(function (g) {
      if (!g.rows.length) return;
      var h = document.createElement('h2');
      h.textContent = g.title + ' · ' + g.rows.length;
      var ul = document.createElement('ul');
      ul.className = 'list';
      g.rows.forEach(function (r) { ul.appendChild(item(r)); });
      box.appendChild(h);
      box.appendChild(ul);
    });

    $('export').disabled = shown.length === 0;
    $('subtitle').textContent = people.length
      ? shown.length + ' of ' + people.length + ' customers with a birthday on file.'
      : 'Customers with a birthday coming up.';
    var m = $('missing');
    m.hidden = missing === 0;
    m.textContent = missing + ' customer' + (missing === 1 ? ' has' : 's have') + ' no birthday on file. Add one on the customer’s profile in Octabiz.';
    if (people.length === 0) status('No customers have a birthday on file yet. Add one on a customer’s profile in Octabiz.');
    else if (shown.length === 0) status(q ? 'No customer matches “' + $('search').value.trim() + '”.' : 'No birthdays in this period.');
    else status('');
  }

  function item(r) {
    var li = document.createElement('li');
    li.className = 'item';
    var date = document.createElement('div');
    date.className = 'date';
    var d = document.createElement('b');
    d.textContent = String(r.date.getDate());
    var mo = document.createElement('span');
    mo.textContent = MONTHS[r.date.getMonth()];
    date.appendChild(d);
    date.appendChild(mo);
    var who = document.createElement('div');
    who.className = 'who';
    var n = document.createElement('strong');
    n.textContent = r.p.name;
    var s = document.createElement('small');
    s.textContent = [r.p.email, r.p.phone].filter(Boolean).join(' · ') || 'No contact details on file';
    who.appendChild(n);
    who.appendChild(s);
    var when = document.createElement('div');
    when.className = 'when' + (r.days === 0 ? ' today' : '');
    when.textContent = r.days === 0 ? 'Today' : r.days === 1 ? 'Tomorrow' : 'In ' + r.days + ' days';
    li.appendChild(date);
    li.appendChild(who);
    li.appendChild(when);
    return li;
  }

  $('window').addEventListener('change', render);
  $('search').addEventListener('input', render);
  $('export').addEventListener('click', function () {
    downloadCsv('birthdays.csv', [['Customer', 'Birthday', 'In days', 'Email', 'Phone']].concat(
      shown.map(function (r) { return [r.p.name, MONTHS[r.date.getMonth()] + ' ' + r.date.getDate(), r.days, r.p.email, r.p.phone]; })
    ));
  });

  /** CSV export with the formula-injection guard (see Top Customers for the explanation). */
  function downloadCsv(filename, table) {
    function esc(v) {
      v = String(v);
      if (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) v = "'" + v;
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    var csv = table.map(function (r) { return r.map(esc).join(','); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
})();
