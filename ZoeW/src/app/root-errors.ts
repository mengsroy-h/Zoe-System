export function reportRenderError(error: unknown): void {
    if (typeof window.reportError === 'function') window.reportError(error);
    else setTimeout(() => { throw error; }, 0);
}

export const ROOT_ERROR_OPTIONS = { onCaughtError: reportRenderError, onUncaughtError: reportRenderError };
