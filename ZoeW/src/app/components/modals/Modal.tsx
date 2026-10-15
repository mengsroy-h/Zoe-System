import { useCallback, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { modalStackZ, registerModalMeta, unregisterModalMeta, type ModalId } from '../../../core/modals';
import { uiState } from '../../../core/state';
import { useStoreValue } from '../../hooks/useStore';

const elements = new Map<string, HTMLElement>();

export function modalElement(id: string): HTMLElement | null {
    return elements.get(id) ?? null;
}

interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'style' | 'children'> {
    id: ModalId;
    close?: string;
    noDismiss?: boolean;
    style?: CSSProperties;
    children: ReactNode;
}

export function Modal({ id, close, noDismiss, style, className, children, ...rest }: ModalProps) {
    const display = useStoreValue(uiState, (s) => s.modalDisplay[id]);
    const zIndex = useStoreValue(uiState, (s) => modalStackZ(s, id));
    const fit = useStoreValue(uiState, (s) => (s.modalKeyboardFit && s.modalKeyboardFit.id === id ? s.modalKeyboardFit : null));
    const ref = useCallback((el: HTMLDivElement | null) => {
        if (el) {
            elements.set(id, el);
            registerModalMeta(id, { close, noDismiss });
        } else {
            elements.delete(id);
            unregisterModalMeta(id);
        }
    }, [id, close, noDismiss]);
    const layered = zIndex === null ? style : Object.assign({}, style, { zIndex });
    const shown = display ? Object.assign({}, layered, { display }) : layered;
    const finalStyle = fit ? Object.assign({}, shown, { '--modal-kb-shift': fit.shift + 'px', '--modal-kb-max': fit.max + 'px' }) as CSSProperties : shown;
    const classes = (className ? 'modal ' + className : 'modal') + (fit ? (fit.hold ? ' modal-kb modal-kb-hold' : ' modal-kb') : '');
    return (
        <div
            id={id}
            className={classes}
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
