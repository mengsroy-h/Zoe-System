import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { TOAST_CLASSES } from '../../../ui/toast';

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
