import { uiState } from '../../../core/state';
import { useStoreValue } from '../../hooks/useStore';

export function DeviceInfoLine({ id }: { id: string }) {
    const info = useStoreValue(uiState, (st) => st.deviceInfo);
    if (!info || info.state !== 'ready' || (!info.model && !info.platform && !info.serial)) return null;
    const name = [info.model, info.platform].filter(Boolean).join(' · ');
    const serialLabel = info.serialKind === 'android-id' ? 'Serial (Android ID)' : 'Serial (ID App)';
    return (
        <div className="device-info-line" id={id}>
            {name ? <span className="device-info-name">📱 {name}</span> : null}
            {info.serial ? <span className="device-info-serial">🔖 {serialLabel} ៖ <span className="device-info-serial-value">{info.serial}</span></span> : null}
        </div>
    );
}
