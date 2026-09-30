/*
 * octabiz-bridge.js — a tiny client for the Ocean Market embedded-app bridge (protocol v1).
 *
 * Your app runs inside Octabiz in a sandboxed iframe. It never gets a login token or a
 * database connection. The ONLY way to read or change a business's data is to ask the
 * Octabiz page through postMessage, and Octabiz checks every request against the
 * permissions (scopes) the business granted when it installed your app.
 *
 * Usage:
 *   OctabizBridge.ready().then(function (ctx) {        // ctx = the handshake
 *     return OctabizBridge.request('invoices.list', { limit: 200, offset: 0 });
 *   });
 *   OctabizBridge.listAll('customers.list', { with_birthday: true })  // pages for you
 *   OctabizBridge.hasScope('customers:read')
 *
 * Copy this file into your app — packages must be self-contained (no CDN scripts).
 */
(function (global) {
  'use strict';

  var CHANNEL = 'ocean-market';
  var VERSION = 1;
  var REQUEST_TIMEOUT_MS = 15000;

  var host = null;        // Octabiz's origin, learned from the handshake
  var context = null;     // the handshake payload
  var pending = {};
  var seq = 0;
  var readyWaiters = [];

  function onMessage(event) {
    // Only the page that embeds us may talk to us.
    if (event.source !== global.parent) return;
    var msg = event.data;
    if (!msg || msg.channel !== CHANNEL || msg.version !== VERSION) return;

    if (msg.type === 'handshake') {
      if (context) return; // first handshake wins
      host = event.origin;
      context = {
        organizationId: msg.organizationId,
        appSlug: msg.appSlug,
        grantedScopes: msg.grantedScopes || [],
        config: msg.config || {},
        currency: msg.currency || 'USD'
      };
      readyWaiters.splice(0).forEach(function (w) { w.resolve(context); });
      return;
    }

    if (msg.type === 'response' && event.origin === host && pending[msg.id]) {
      var p = pending[msg.id];
      delete pending[msg.id];
      clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.data);
      else p.reject(new Error(msg.error || 'The request failed.'));
    }
  }
  global.addEventListener('message', onMessage);

  /**
   * Resolves with the handshake once Octabiz has loaded us. Rejects after `timeoutMs`
   * (default 4000) — that usually means the page was opened outside Octabiz.
   */
  function ready(timeoutMs) {
    if (context) return Promise.resolve(context);
    return new Promise(function (resolve, reject) {
      var waiter = { resolve: resolve };
      readyWaiters.push(waiter);
      setTimeout(function () {
        var i = readyWaiters.indexOf(waiter);
        if (i >= 0) {
          readyWaiters.splice(i, 1);
          reject(new Error('NOT_EMBEDDED'));
        }
      }, timeoutMs || 4000);
    });
  }

  /** Ask Octabiz to run one operation. See docs/embedded-apps.md for the list. */
  function request(operation, params) {
    if (!context) return Promise.reject(new Error('Call OctabizBridge.ready() first.'));
    return new Promise(function (resolve, reject) {
      var id = 'r' + (++seq);
      var timer = setTimeout(function () {
        delete pending[id];
        reject(new Error('Octabiz didn’t answer in time. Please try again.'));
      }, REQUEST_TIMEOUT_MS);
      pending[id] = { resolve: resolve, reject: reject, timer: timer };
      global.parent.postMessage(
        { channel: CHANNEL, version: VERSION, type: 'request', id: id, operation: operation, params: params || {} },
        host
      );
    });
  }

  /**
   * Page through a list operation (200 rows per page) until it runs out or `max` rows.
   * `onProgress(rowsSoFar)` is called after each page.
   */
  function listAll(operation, params, max, onProgress) {
    var PAGE = 200;
    var limit = max || 5000;
    var rows = [];
    function next(offset) {
      var p = {};
      for (var k in params || {}) p[k] = params[k];
      p.limit = PAGE;
      p.offset = offset;
      return request(operation, p).then(function (page) {
        page = page || [];
        rows = rows.concat(page);
        if (onProgress) onProgress(rows.length);
        if (page.length < PAGE || rows.length >= limit) return rows.slice(0, limit);
        return next(offset + PAGE);
      });
    }
    return next(0);
  }

  function hasScope(scope) {
    return !!context && context.grantedScopes.indexOf(scope) >= 0;
  }

  /** Money in the business's own currency. */
  function formatMoney(amount) {
    var currency = (context && context.currency) || 'USD';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency }).format(Number(amount) || 0);
    } catch (e) {
      return (Number(amount) || 0).toFixed(2) + ' ' + currency;
    }
  }

  global.OctabizBridge = { ready: ready, request: request, listAll: listAll, hasScope: hasScope, formatMoney: formatMoney };
})(window);
