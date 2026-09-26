import type { SyntheticEvent } from 'react';
import { lookupAction, ACTION_NAMES } from '../core/action-registry';

export interface ActOptions {
    args?: unknown[];
    evt?: boolean;
    self?: boolean;
}

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
    actionName: string;
    actionOptions: ActOptions | undefined;
}

export function onAct(name: string, opts?: ActOptions): ActionHandler {
    const handler = ((event: SyntheticEvent) => {
        const args: unknown[] = [...(opts?.args ?? [])];
        if (opts?.evt) args.unshift(event.nativeEvent);
        if (opts?.self) args.unshift(event.currentTarget);
        act(name, ...args);
    }) as ActionHandler;
    handler.actionName = name;
    handler.actionOptions = opts;
    return handler;
}

export { ACTION_NAMES };
