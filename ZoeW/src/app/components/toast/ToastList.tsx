import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { TOAST_CLASSES } from '../../../ui/toast';

/**
 * បញ្ជី toast ។
 *
 * ⛔ **ភាពស្មោះត្រង់នៃ class** ៖ `style.css` សម្រេចពណ៌តាម `toast-info` ·
 *    `toast-success` · `toast-warn` · `toast-error` ហើយចលនាលេចតាម `.show`
 *    ➜ ធាតុត្រូវចុះ **គ្មាន `.show`** ជាមុន រួចទទួលវានៅស៊ុមបន្ទាប់
 *    (ដូច `appendChild` + `requestAnimationFrame` របស់ដើមបេះបិទ)។
 *
 * ⛔ `data-live-toast` នៅជា attribute ពិតដដែល ៖ វាជាអ្វីដែល
 *    `dropOldestToast()` ប្រើដើម្បី **មិនបោះ toast ដែលកំពុងរស់**។
 */
export function ToastList() {
    useStore(uiState);
    return (
        <>
            {uiState.toasts.map((t: any) => (
                <div
                    key={t.id}
                    className={'toast ' + (TOAST_CLASSES as any)[t.kind] + (t.show ? ' show' : '')}
                    data-live-toast={t.live === null ? undefined : t.live}
                >{t.msg}</div>
            ))}
        </>
    );
}
