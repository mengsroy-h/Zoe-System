import type { SyntheticEvent } from 'react';
import { lookupAction, ACTION_NAMES } from '../core/action-registry';

export interface ActOptions {
    /** អាគុយម៉ង់ថេរ (ដូច `data-args` ក្នុង `index.html` ដើម)។ */
    args?: unknown[];
    /** បញ្ជូនព្រឹត្តិការណ៍ជាអាគុយម៉ង់ (ដូច `data-evt`)។ */
    evt?: boolean;
    /** បញ្ជូនធាតុខ្លួនឯងជាអាគុយម៉ង់ (ដូច `data-self`)។ */
    self?: boolean;
}

/**
 * ហៅសកម្មភាពតាមឈ្មោះ។
 * ⛔ ព្រំដែនគឺ `ACTION_REGISTRY` — ឈ្មោះក្រៅបញ្ជី ហៅមិនបាន
 *    (ច្បាប់ដដែលនឹង `ACTION_ALLOWLIST` ដើម តែ **ពិនិត្យបានពេល build**)។
 */
export function act(name: string, ...args: unknown[]): void {
    const fn = lookupAction(name);
    if (!fn) {
        if (import.meta.env.DEV) console.warn('[zoew] សកម្មភាពមិនស្គាល់ ៖', name);
        return;
    }
    fn(...args);
}

export interface ActionHandler {
    (event: SyntheticEvent): void;
    /** ឈ្មោះសកម្មភាព — អានបានដោយឧបករណ៍វាស់ និង devtools។ */
    actionName: string;
    actionOptions: ActOptions | undefined;
}

/** សាង handler របស់ React ដែលហៅសកម្មភាពមួយ។ */
export function onAct(name: string, opts?: ActOptions): ActionHandler {
    const handler = ((event: SyntheticEvent) => {
        const args: unknown[] = [...(opts?.args ?? [])];
        // ⛔ លំដាប់ត្រូវដូច `readActionArgs()` ដើម ៖ [ធាតុ?, ព្រឹត្តិការណ៍?, …args]
        if (opts?.evt) args.unshift(event.nativeEvent);
        if (opts?.self) args.unshift(event.currentTarget);
        act(name, ...args);
    }) as ActionHandler;
    handler.actionName = name;
    handler.actionOptions = opts;
    return handler;
}

export { ACTION_NAMES };
