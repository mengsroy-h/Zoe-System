import { useCallback, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { registerModalMeta, unregisterModalMeta, type ModalId } from '../../../core/modals';
import { uiState } from '../../../core/state';
import { useStoreValue } from '../../hooks/useStore';

const elements = new Map<string, HTMLElement>();

/** ធាតុ root របស់ប្រអប់ (សម្រាប់ `lifecycle/layers.ts` វាស់ z-index) */
export function modalElement(id: string): HTMLElement | null {
    return elements.get(id) ?? null;
}

interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'style' | 'children'> {
    id: ModalId;
    /** សកម្មភាពពេលបិទដោយចុចខាងក្រៅ · Escape · Back (`data-close`) */
    close?: string;
    /** មិនបិទពេលចុចខាងក្រៅ (`data-nodismiss`) */
    noDismiss?: boolean;
    style?: CSSProperties;
    children: ReactNode;
}

/**
 * សំបកប្រអប់ ៖ `display` គូរពី `uiState.modalDisplay[id]` (មើល `core/modals.ts`)។
 *
 * ⛔ DOM ដូច App ដើមបេះបិទ ៖ `<div id class="modal" style data-close
 *    data-nodismiss>` ហើយ `display` ត្រូវ **បន្ថែមលើ** style ដើម (ឧ. `z-index`)។
 */
export function Modal({ id, close, noDismiss, style, className, children, ...rest }: ModalProps) {
    const display = useStoreValue(uiState, (s) => s.modalDisplay[id]);
    const ref = useCallback((el: HTMLDivElement | null) => {
        if (el) {
            elements.set(id, el);
            registerModalMeta(id, { close, noDismiss });
        } else {
            elements.delete(id);
            unregisterModalMeta(id);
        }
    }, [id, close, noDismiss]);
    const finalStyle = display ? Object.assign({}, style, { display }) : style;
    return (
        <div
            id={id}
            className={className ? 'modal ' + className : 'modal'}
            style={finalStyle}
            data-close={close}
            data-nodismiss={noDismiss ? 'true' : undefined}
            ref={ref}
            {...rest}
        >
            {children}
        </div>
    );
}
