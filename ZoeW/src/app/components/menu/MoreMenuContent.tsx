import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';

export interface MoreMenuItem { label: string; action: string; args?: string[]; cls?: string }

/**
 * មាតិកាម៉ឺនុយ (...) ។
 *
 * ⛔ ប៊ូតុងទាំងនេះកាន់ `data-act` / `data-a1` ហើយ **គ្មាន `onClick`** ៖
 *    `setupActionDelegation()` នៅតែស្តាប់នៅកម្រិត `document` (ការគូរ
 *    ដែលជាខ្សែអក្សរ HTML ដូច `history-row.ts` នៅពឹងលើវា) ➜ ការចង
 *    handler ទី ២ លើធាតុដដែល នឹងធ្វើឲ្យសកម្មភាព **រត់ពីរដង**
 *    (ច្បាប់ ៤ នៃ «CSP និង `data-act`» — ធ្ងន់បំផុតលើការលុប)។
 *
 * ⛔ វាក៏ជាភាពស្មោះត្រង់នៃ DOM ដែរ ៖ ម៉ឺនុយដើមមាន attribute ទាំងនោះ ➜
 *    ការដកវាចេញ ធ្វើឲ្យអ្វីដែលពឹងលើវា (ឧបករណ៍វាស់ · តេស្ត) ខូច។
 */
export function MoreMenuContent() {
    useStore(uiState);
    const items = uiState.moreMenuItems as MoreMenuItem[] | null;
    if (!items) return null;
    return (
        <>
            {items.map((it) => (
                <button key={it.action + (it.args ? it.args.join(',') : '')}
                    className={it.cls || undefined}
                    data-act={it.action}
                    data-a1={it.args && it.args.length > 0 ? it.args[0] : undefined}
                    data-a2={it.args && it.args.length > 1 ? it.args[1] : undefined}>{it.label}</button>
            ))}
        </>
    );
}
