import { uiState } from '../../../core/state';
import { onAct } from '../../actions';
import { useStoreValue } from '../../hooks/useStore';

export interface MoreMenuItem { label: string; action: string; args?: string[]; cls?: string }

/**
 * មាតិកាម៉ឺនុយ (...) ។
 *
 * ⛔ ការចុចឆ្លងកាត់ `onClick` របស់ React (ព្រំដែន `ACTION_REGISTRY` ដូចប៊ូតុង
 *    ដទៃ) ➜ **គ្មាន** listener ទី ២ នៅកម្រិត `document` ទៀតទេ (ច្បាប់ ៤ នៃ
 *    «CSP និង `data-act`» ៖ សកម្មភាពមិនត្រូវរត់ពីរដង)។
 * ⛔ `data-act` / `data-a1` / `data-a2` នៅជា attribute **ពណ៌នា** សុទ្ធ ៖ DOM ដូច
 *    ម៉ឺនុយដើមបេះបិទ (ឧបករណ៍វាស់ `wiring` · `csp-enforced` អានវា) តែគ្មានអ្វី
 *    ស្តាប់វាទេ។
 */
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
