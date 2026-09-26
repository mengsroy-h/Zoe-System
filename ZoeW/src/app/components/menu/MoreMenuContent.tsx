import { uiState } from '../../../core/state';
import { onAct } from '../../actions';
import { useStoreValue } from '../../hooks/useStore';

export interface MoreMenuItem { label: string; action: string; args?: string[]; cls?: string }

export function MoreMenuContent() {
    const items = useStoreValue(uiState, (s) => s.moreMenuItems) as MoreMenuItem[] | null;
    if (!items) return null;
    return (
        <>
            {items.map((it) => (
                <button key={it.action + (it.args ? it.args.join(',') : '')}
                    className={it.cls || undefined}
                    data-act={it.action}
                    data-a1={it.args && it.args.length > 0 ? it.args[0] : undefined}
                    data-a2={it.args && it.args.length > 1 ? it.args[1] : undefined}
                    onClick={onAct(it.action, { args: it.args })}>{it.label}</button>
            ))}
        </>
    );
}
