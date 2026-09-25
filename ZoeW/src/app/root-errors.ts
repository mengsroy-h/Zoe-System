/**
 * ⛔ កំហុសក្នុង render ៖ `AppErrorBoundary` ជំនួសអេក្រង់សដោយសារ + ប៊ូតុងផ្ទុកឡើងវិញ។ React ចាត់កំហុសនោះជា «caught»
 *    ➜ លំនាំដើមត្រឹម `console.error` (Sentry មិនឃើញ) ➜ បញ្ជូនវាទៅ `reportError()` ដូចកំហុស uncaught ៖
 *    `error` event របស់ window ➜ GlobalHandlers របស់ Sentry (`error-reporting.js`) ចាប់វា ដូចកំហុស JS ផ្សេងៗ។
 */
export function reportRenderError(error: unknown): void {
    if (typeof window.reportError === 'function') window.reportError(error);
    else setTimeout(() => { throw error; }, 0);
}

export const ROOT_ERROR_OPTIONS = { onCaughtError: reportRenderError, onUncaughtError: reportRenderError };
