import { uiState } from '../../../core/state';
import { useStoreValue } from '../../hooks/useStore';

export function UpdateBanner() {
    const open = useStoreValue(uiState, (s) => s.updateBannerOpen);
    if (!open) return null;
    return (
        <div id="zoeUpdateBanner" className="app-update-banner">
            <span>🔄 មានកំណែថ្មីរបស់កម្មវិធី — សូម Refresh នៅពេលងាយស្រួល</span>
            <button type="button" className="app-update-refresh" onClick={() => window.location.reload()}>Refresh ឥឡូវនេះ</button>
            <button type="button" className="app-update-dismiss" aria-label="បិទ" onClick={() => { uiState.updateBannerOpen = false; }}>✕</button>
        </div>
    );
}
