/*
 * The mock Octabiz side of the bridge. It behaves like the real host
 * (EmbeddedAppFrame in the Octabiz app): origin + source checks, a handshake on load,
 * scope checks per operation, 200-row pages, and the same response shapes.
 */
(function () {
  'use strict';
  var CHANNEL = 'ocean-market';
  var VERSION = 1;
  var OPERATION_SCOPE = { me: null, 'customers.list': 'customers:read', 'customers.create': 'customers:write', 'invoices.list': 'invoices:read', 'products.list': 'products:read' };
  var ALL_SCOPES = ['customers:read', 'customers:write', 'invoices:read', 'products:read', 'ui:embed'];

  var frame = document.getElementById('frame');
  var meta = null;
  var appOrigin = null;
  var created = [];

  function $(id) { return document.getElementById(id); }
  function log(text, kind) {
    var li = document.createElement('li');
    li.className = kind || '';
    li.textContent = new Date().toLocaleTimeString() + '  ' + text;
    $('log').insertBefore(li, $('log').firstChild);
  }
  function granted() {
    return Array.prototype.filter.call(document.querySelectorAll('#scopes input'), function (i) { return i.checked; }).map(function (i) { return i.value; });
  }
  function page(list, params) {
    var limit = Math.max(1, Math.min(Number(params.limit) || 50, 200));
    var offset = Math.max(0, Math.floor(Number(params.offset) || 0));
    return list.slice(offset, offset + limit);
  }

  function execute(op, params) {
    var empty = $('empty').checked;
    var need = OPERATION_SCOPE[op];
    if (need === undefined) throw new Error('Unknown operation: ' + op);
    if (need && granted().indexOf(need) < 0) throw new Error('Operation "' + op + '" requires scope "' + need + '"');
    switch (op) {
      case 'me': return { organizationId: 'org-demo', appSlug: meta.slug || 'my-app', grantedScopes: granted() };
      case 'customers.list': {
        var all = empty ? [] : created.concat(SAMPLE.customers);
        if (params.with_birthday === true) all = all.filter(function (c) { return c.date_of_birth; });
        return page(all, params);
      }
      case 'invoices.list': return page(empty ? [] : SAMPLE.invoices, params);
      case 'products.list': return page(empty ? [] : SAMPLE.products, params).map(function (p) { var x = Object.assign({}, p); x.currency = $('currency').value; return x; });
      case 'customers.create': {
        var name = String(params.name || '').trim();
        if (!name) throw new Error('name is required');
        var row = { id: 'cust-new-' + (created.length + 1), name: name, email: params.email || null, phone: params.phone || null, date_of_birth: null, created_at: new Date().toISOString() };
        created.unshift(row);
        return row;
      }
    }
  }

  window.addEventListener('message', function (event) {
    // Same rules as production: right origin, right window, right protocol version.
    if (event.origin !== appOrigin || event.source !== frame.contentWindow) return;
    var msg = event.data;
    if (!msg || msg.channel !== CHANNEL || msg.type !== 'request' || msg.version !== VERSION) return;
    log('→ ' + msg.operation + ' ' + JSON.stringify(msg.params || {}), 'in');
    var respond = function (payload) {
      var out = Object.assign({ channel: CHANNEL, version: VERSION, type: 'response', id: msg.id }, payload);
      frame.contentWindow.postMessage(out, appOrigin);
    };
    setTimeout(function () {
      try {
        var data = execute(msg.operation, msg.params || {});
        log('← ' + msg.operation + ' ok' + (Array.isArray(data) ? ' (' + data.length + ' rows)' : ''), 'out');
        respond({ ok: true, data: data });
      } catch (e) {
        log('← ' + msg.operation + ' error: ' + e.message, 'err');
        respond({ ok: false, error: e.message });
      }
    }, $('slow').checked ? 1500 : 60);
  });

  function load() {
    created = [];
    $('log').textContent = '';
    frame.src = meta.appUrl + '?t=' + Date.now();
  }
  frame.addEventListener('load', function () {
    var handshake = { channel: CHANNEL, version: VERSION, type: 'handshake', organizationId: 'org-demo', appSlug: meta.slug || 'my-app', grantedScopes: granted(), config: {}, currency: $('currency').value };
    frame.contentWindow.postMessage(handshake, appOrigin);
    log('handshake sent · scopes: ' + (granted().join(', ') || 'none'), 'out');
  });

  fetch('/app.json').then(function (r) { return r.json(); }).then(function (m) {
    meta = m;
    appOrigin = new URL(m.appUrl).origin;
    $('app-name').textContent = m.name + (m.version ? ' v' + m.version : '');
    $('frame-title').textContent = m.name;
    $('frame-url').textContent = m.appUrl;
    document.title = m.name + ' — mock Octabiz';
    ALL_SCOPES.forEach(function (s) {
      var l = document.createElement('label');
      var i = document.createElement('input');
      i.type = 'checkbox';
      i.value = s;
      i.checked = (m.scopes || []).indexOf(s) >= 0;
      l.appendChild(i);
      l.appendChild(document.createTextNode(' ' + s + ((m.scopes || []).indexOf(s) >= 0 ? '' : '  (not requested)')));
      $('scopes').appendChild(l);
    });
    ['currency', 'empty', 'slow'].forEach(function (id) { $(id).addEventListener('change', load); });
    $('scopes').addEventListener('change', load);
    $('reload').addEventListener('click', load);
    load();
  });
})();
