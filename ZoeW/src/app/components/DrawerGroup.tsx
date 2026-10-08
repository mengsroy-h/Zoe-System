import type { ReactNode } from 'react';
import { viewState } from '../../core/view-state';
import { onAct } from '../actions';
import { useStoreFields } from '../hooks/useStore';

export interface DrawerGroupProps {
    id: string;
    headId: string;
    bodyId: string;
    icon: string;
    label: string;
    children: ReactNode;
    extra?: ReactNode;
    className?: string;
    action?: string;
    lazy?: boolean;
}

export function DrawerGroup({ id, headId, bodyId, icon, label, children, extra, className: extraClass, action = 'toggleDrawerGroup', lazy = false }: DrawerGroupProps) {
    const v = useStoreFields(viewState, ['drawerGroupsOpen', 'drawerGroupsHidden']);
    const hidden = v.drawerGroupsHidden.indexOf(id) !== -1;
    const open = v.drawerGroupsOpen.indexOf(id) !== -1;
    let className = 'drawer-group';
    if (extraClass) className += ' ' + extraClass;
    if (hidden) className += ' hidden';
    if (open) className += ' is-open';
    return (
        <section className={className} id={id}>
            <button
                type="button"
                className="drawer-group-head"
                id={headId}
                aria-expanded={open ? 'true' : 'false'}
                aria-controls={bodyId}
                onClick={onAct(action, { args: [id] })}
            >
                <span className="ico">{icon}</span>
                <span className="drawer-group-label">{label}</span>
                {extra}
                <span className="drawer-group-arrow" aria-hidden="true">↓</span>
            </button>
            <div
                className="drawer-group-body"
                id={bodyId}
                role="group"
                aria-labelledby={headId}
            >
                {lazy && !open ? null : children}
            </div>
        </section>
    );
}
