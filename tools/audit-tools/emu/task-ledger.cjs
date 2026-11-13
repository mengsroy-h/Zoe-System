'use strict';

// Tracks the original promise, not just a timeout wrapper. It never cancels work.
function createTaskLedger() {
  let nextId = 0;
  let sealed = false;
  const records = new Map();

  function start(label, operation) {
    if (sealed) throw new Error('task ledger is sealed');
    if (typeof operation !== 'function') throw new TypeError('operation must be a function');
    const id = ++nextId;
    const record = { id, label: String(label), state: 'PENDING', timedOut: false, value: undefined, error: undefined };
    records.set(id, record);
    // Capture a synchronous throw in the same ledger as asynchronous rejections.
    let original;
    try { original = Promise.resolve(operation()); }
    catch (error) { original = Promise.reject(error); }
    // The settlement observer handles both branches and itself always fulfills.
    record.settled = original.then(
      value => { record.state = 'FULFILLED'; record.value = value; return record; },
      error => { record.state = 'REJECTED'; record.error = error; return record; }
    );
    return Object.freeze({ id, wait: ms => wait(record, ms) });
  }

  function validateBudget(ms) {
    if (!Number.isFinite(ms) || ms < 0) throw new RangeError('timeout must be finite and nonnegative');
  }
  async function beforeDeadline(promise, ms) {
    validateBudget(ms);
    let timer;
    try {
      return await Promise.race([
        promise.then(value => ({ expired: false, value })),
        new Promise(resolve => { timer = setTimeout(() => resolve({ expired: true }), ms); })
      ]);
    } finally { clearTimeout(timer); }
  }
  async function wait(record, ms) {
    const result = await beforeDeadline(record.settled, ms);
    if (result.expired) {
      record.timedOut = true;
      const error = new Error('task timed out: ' + record.label);
      error.code = 'TASK_TIMEOUT'; error.taskId = record.id;
      throw error;
    }
    if (record.state === 'REJECTED') throw record.error;
    return record.value;
  }
  function snapshot() {
    return [...records.values()].map(({id,label,state,timedOut,error}) => ({
      id, label, state, timedOut,
      ...(state === 'REJECTED' ? { error: String(error?.message ?? error) } : {})
    }));
  }
  async function drain(ms) {
    validateBudget(ms);
    const deadline = Date.now() + ms;
    for (;;) {
      const pending = [...records.values()].filter(record => record.state === 'PENDING');
      if (pending.length === 0) {
        const tasks = snapshot();
        return { outcome: sealed ? 'DRAINED' : 'EMPTY_SNAPSHOT', tasks, failures: tasks.filter(task => task.state === 'REJECTED') };
      }
      const remaining = Math.max(0, deadline - Date.now());
      const result = await beforeDeadline(Promise.race(pending.map(record => record.settled)), remaining);
      if (result.expired) return { outcome: 'UNKNOWN', tasks: snapshot() };
    }
  }
  return Object.freeze({ start, seal() { sealed = true; }, drain, snapshot });
}

module.exports = { createTaskLedger };
