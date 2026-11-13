'use strict';

// Observe, but do not cancel or alter, promises returned by the owned PG pool.
// An empty pending set alone is not quiescence: callers must first close every
// producer and inspect checked-out/queued pool clients and async error events.
function observePg(pool, direct) {
  const pending = new Set(), errors = [], wrapped = new WeakMap();
  let serial = 0;
  function captureEmitter(object, label) {
    object.on('error', error => errors.push({label, message: String(error?.message || error)}));
  }
  function observe(value, label) {
    if (!value || typeof value.then !== 'function') {
      errors.push({label, message: 'operation was invoked but did not return a promise; outcome unknown'});
      throw new Error('PG '+label+' did not return a promise');
    }
    const token = { id: ++serial, label }; pending.add(token);
    value.then(() => pending.delete(token), error => {
      pending.delete(token); errors.push({label, message: String(error?.message || error)});
    });
    return value;
  }
  function invoke(target, fn, args, label) {
    try { return observe(fn.apply(target, args), label); }
    catch (error) { errors.push({label, message: String(error?.message || error)}); throw error; }
  }
  function client(object) {
    if (wrapped.has(object)) return wrapped.get(object);
    captureEmitter(object, 'client');
    const proxy = new Proxy(object, {get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (key === 'query' || key === 'end') return (...args) => {
        if (args.some(arg => typeof arg === 'function')) throw new Error('callback PG operations are not accounted for');
        return invoke(target, value, args, 'client.'+String(key));
      };
      return value.bind(target);
    }});
    wrapped.set(object, proxy); return proxy;
  }
  captureEmitter(pool, 'pool');
  const wrappedPool = new Proxy(pool, {get(target, key) {
    const value = Reflect.get(target, key, target);
    if (typeof value !== 'function') return value;
    if (key === 'connect') return (...args) => {
      if (args.length) throw new Error('callback PG pool.connect is not accounted for');
      return invoke(target, value, args, 'pool.connect').then(client);
    };
    if (key === 'query' || key === 'end') return (...args) => {
      if (args.some(arg => typeof arg === 'function')) throw new Error('callback PG operations are not accounted for');
      return invoke(target, value, args, 'pool.'+String(key));
    };
    return value.bind(target);
  }});
  return {pool: wrappedPool, direct: client(direct), snapshot: () => ({
    pending: [...pending].map(({id,label}) => ({id,label})), errors: [...errors],
    total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount
  })};
}
module.exports = {observePg};
