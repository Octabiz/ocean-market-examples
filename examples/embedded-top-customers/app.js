/*
 * Top Customers — an Ocean Market embedded app.
 * Permission: invoices:read. Everything is computed in the browser from the
 * business's invoices; nothing is stored or sent anywhere.
 */
(function () {
  'use strict';
  var B = window.OctabizBridge;
  var MAX_INVOICES = 5000;

  var invoices = [];
  var rows = [];
  var sort = { key: 'total', dir: -1 };

  var $ = function (id) { return document.getElementById(id); };
  function status(text, kind) {
    var el = $('status');
    el.textContent = text || '';
    el.className = 'status' + (kind === 'error' ? ' error' : '');
    el.hidden = !text;
  }

  B.ready()
    .then(function () {
      if (!B.hasScope('invoices:read')) {
        status('Top Customers needs permission to see your invoices. Uninstall and reinstall it, and allow invoice access.', 'error');
        return;
      }
      return load();
    })
    .catch(function (e) {
      if (e && e.message === 'NOT_EMBEDDED') status('Open Top Customers from Ocean Market inside Octabiz to see your customers.');
      else status('Something went wrong: ' + (e && e.message), 'error');
    });

  function load() {
    status('Loading your invoices…');
    return B.listAll('invoices.list', {}, MAX_INVOICES, function (n) { status('Loading your invoices… ' + n); })
      .then(function (list) {
        invoices = list;
        render();
      })
      .catch(function (e) { status('Couldn’t load your invoices: ' + e.message, 'error'); });
  }

  /** Group invoices by customer for the chosen period. Drafts and invoices without a customer don't count. */
  function aggregate(period) {
    var since = period === 'all' ? null : Date.now() - Number(period) * 86400000;
    var byId = {};
    invoices.forEach(function (inv) {
      if (!inv.customer_id || inv.status === 'draft') return;
      var when = new Date(inv.invoice_date || inv.created_at).getTime();
      if (since && when < since) return;
      var c = byId[inv.customer_id] || (byId[inv.customer_id] = { id: inv.customer_id, name: inv.customer_name || 'Unnamed customer', count: 0, total: 0, paid: 0, last: 0 });
      c.count += 1;
      c.total += Number(inv.total) || 0;
      c.paid += Number(inv.amount_paid) || 0;
      if (when > c.last) c.last = when;
    });
    return Object.keys(byId).map(function (k) { return byId[k]; });
  }

  function render() {
    var all = aggregate($('period').value);
    var q = $('search').value.trim().toLowerCase();
    var ranked = all.slice().sort(function (a, b) { return b.total - a.total; });
    var rankOf = {};
    ranked.forEach(function (c, i) { rankOf[c.id] = i + 1; });

    rows = all
      .filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) {
        var x = a[sort.key], y = b[sort.key];
        if (typeof x === 'string') return x.localeCompare(y) * sort.dir;
        return (x - y) * sort.dir;
      });

    // Summary cards (whole period, not just the search results).
    var sales = all.reduce(function (s, c) { return s + c.total; }, 0);
    var paid = all.reduce(function (s, c) { return s + c.paid; }, 0);
    var top10 = ranked.slice(0, 10).reduce(function (s, c) { return s + c.total; }, 0);
    $('sum-sales').textContent = B.formatMoney(sales);
    $('sum-paid').textContent = B.formatMoney(paid);
    $('sum-customers').textContent = String(all.length);
    $('sum-share').textContent = sales > 0 ? Math.round((top10 / sales) * 100) + '%' : '–';

    var tbody = $('rows');
    tbody.textContent = '';
    rows.forEach(function (c) {
      var tr = document.createElement('tr');
      tr.appendChild(cell(String(rankOf[c.id]), 'rank'));
      var name = cell('', '');
      var strong = document.createElement('div');
      strong.className = 'name';
      strong.textContent = c.name;
      var bar = document.createElement('span');
      bar.className = 'paidbar';
      bar.title = 'Paid ' + (c.total > 0 ? Math.round((c.paid / c.total) * 100) : 0) + '%';
      var fill = document.createElement('i');
      fill.style.width = (c.total > 0 ? Math.min(100, (c.paid / c.total) * 100) : 0) + '%';
      bar.appendChild(fill);
      name.appendChild(strong);
      name.appendChild(bar);
      tr.appendChild(name);
      tr.appendChild(cell(String(c.count), 'num hide-xs'));
      tr.appendChild(cell(B.formatMoney(c.total), 'num'));
      tr.appendChild(cell(B.formatMoney(c.paid), 'num hide-sm'));
      tr.appendChild(cell(new Date(c.last).toLocaleDateString(), 'hide-sm'));
      tbody.appendChild(tr);
    });

    $('table-wrap').hidden = rows.length === 0;
    $('export').disabled = rows.length === 0;
    var counted = invoices.filter(function (i) { return i.customer_id && i.status !== 'draft'; }).length;
    $('subtitle').textContent = invoices.length >= MAX_INVOICES
      ? 'Your best customers by sales, from your latest ' + MAX_INVOICES + ' invoices.'
      : 'Your best customers by sales, from ' + counted + ' invoice' + (counted === 1 ? '' : 's') + '.';
    if (all.length === 0) status('No invoices with a customer in this period yet.');
    else if (rows.length === 0) status('No customer matches “' + $('search').value.trim() + '”.');
    else status('');
  }

  function cell(text, cls) {
    var td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text;
    return td;
  }

  // Sorting: click a column header; click again to flip the direction.
  Array.prototype.forEach.call(document.querySelectorAll('.sort'), function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-sort');
      sort = { key: key, dir: sort.key === key ? -sort.dir : (key === 'name' ? 1 : -1) };
      Array.prototype.forEach.call(document.querySelectorAll('.sort'), function (b) { b.removeAttribute('aria-sort'); });
      btn.setAttribute('aria-sort', sort.dir === 1 ? 'ascending' : 'descending');
      render();
    });
  });

  $('period').addEventListener('change', render);
  $('search').addEventListener('input', render);
  $('export').addEventListener('click', function () {
    downloadCsv('top-customers.csv', [['Rank', 'Customer', 'Invoices', 'Sales', 'Paid', 'Last invoice']].concat(
      rows.map(function (c, i) { return [i + 1, c.name, c.count, c.total.toFixed(2), c.paid.toFixed(2), new Date(c.last).toISOString().slice(0, 10)]; })
    ));
  });

  /**
   * CSV export. Cells starting with = + - @ (or tab / carriage return) would run as
   * formulas in Excel or Google Sheets ("CSV injection"), so they get a leading '.
   * Plain numbers (including negative ones like -20.00) are left as numbers.
   */
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
