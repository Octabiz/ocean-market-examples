/* Deterministic sample business: 40 customers (half with birthdays near today) and 220 invoices. */
(function (global) {
  'use strict';
  var FIRST = ['Nora', 'Sam', 'Lina', 'Omar', 'Grace', 'Theo', 'Maya', 'Ravi', 'Ella', 'Jonas', 'Aiko', 'Diego', 'Zara', 'Felix', 'Amara', 'Luca', 'Ines', 'Kofi', 'Hana', 'Owen'];
  var LAST = ['Patel', 'Rivera', 'Chen', 'Haddad', 'Kim', 'Novak', 'Singh', 'Okafor', 'Rossi', 'Berg'];
  var DAY = 86400000;
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function iso(d) { return new Date(d).toISOString(); }
  function ymd(d) { var x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  var now = Date.now();

  var customers = [];
  for (var i = 0; i < 40; i++) {
    // Unique, deterministic names (the last one is a formula-injection test for CSV exports).
    var name = i === 39 ? '=HYPERLINK("https://example.com")' : FIRST[i % FIRST.length] + ' ' + LAST[(i * 3 + Math.floor(i / FIRST.length)) % LAST.length];
    var dob = null;
    if (i % 2 === 0) {
      // A spread of birthdays around today: today, tomorrow, this week, this month, later, and a few just gone.
      var OFFSETS = [0, 0, 1, 2, 4, 6, 9, 12, 16, 21, 27, 33, 40, 48, 55, -1, -3, -8, 62, 70];
      var bday = new Date(now + OFFSETS[(i / 2) % OFFSETS.length] * DAY);
      bday.setFullYear(1960 + Math.floor(rnd() * 45));
      dob = ymd(bday);
    }
    if (i === 6) dob = '1992-02-29';
    customers.push({
      id: 'cust-' + (i + 1),
      name: name,
      email: i % 5 === 3 ? null : name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com',
      phone: i % 3 === 0 ? null : '+1 555 01' + String(10 + i),
      date_of_birth: dob,
      created_at: iso(now - (400 - i * 9) * DAY)
    });
  }
  customers.reverse(); // newest first, like Octabiz

  var invoices = [];
  // Real-looking customers get the spending; the formula-injection test customer gets one small invoice.
  var tester = customers.filter(function (x) { return x.name.charAt(0) === '='; })[0];
  var shoppers = customers.filter(function (x) { return x !== tester; });
  for (var n = 0; n < 220; n++) {
    var c = n === 219 ? tester : shoppers[Math.floor(Math.pow(rnd(), 2) * shoppers.length)]; // a few big spenders
    var total = c === tester ? 19.5 : Math.round((20 + rnd() * 900) * 100) / 100;
    var r = rnd();
    var status = r < 0.08 ? 'draft' : r < 0.2 ? 'sent' : r < 0.3 ? 'partial' : 'paid';
    var paid = status === 'paid' ? total : status === 'partial' ? Math.round(total * 0.5 * 100) / 100 : 0;
    var when = now - (c === tester ? 3 : Math.floor(rnd() * 420)) * DAY;
    invoices.push({
      id: 'inv-' + (n + 1), invoice_number: 'INV-' + (1001 + n), customer_id: n % 17 === 0 && c !== tester ? null : c.id,
      customer_name: n % 17 === 0 && c !== tester ? null : c.name, invoice_date: ymd(when), total: total, amount_paid: paid, status: status, created_at: iso(when)
    });
  }
  invoices.sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });

  var products = [
    { id: 'p-1', name: 'Linen shirt', price: 48, sku: 'LS-01', in_stock: true },
    { id: 'p-2', name: 'Canvas tote', price: 22, sku: 'CT-02', in_stock: true },
    { id: 'p-3', name: 'Oak tray', price: 65, sku: 'OT-03', in_stock: false }
  ];
  global.SAMPLE = { customers: customers, invoices: invoices, products: products };
})(window);
