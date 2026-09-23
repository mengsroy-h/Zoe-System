import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';

/**
 * របាដាស់តឿន «មានកំណែថ្មី» ។
 *
 * ⛔ ច្រកទ្វារភាព idempotent នៃដើមគឺ `byId('zoeUpdateBanner')` — ទង់
 *    `uiState.updateBannerOpen` ជំនួសវា **ទិសទាំង ២** ៖ ហៅ ២ ដង ➜ របា ១;
 *    ចុច ✕ ➜ លុបចេញ ➜ ការហៅបន្ទាប់បង្ហាញវិញ (ដូចដើមបេះបិទ)។
 */
export function UpdateBanner() {
    useStore(uiState);
    if (!uiState.updateBannerOpen) return null;
    return (
        <div id="zoeUpdateBanner" className="app-update-banner">
            <span>🔄 មានកំណែថ្មីរបស់កម្មវិធី — សូម Refresh នៅពេលងាយស្រួល</span>
            <button type="button" className="app-update-refresh" onClick={() => window.location.reload()}>Refresh ឥឡូវនេះ</button>
            <button type="button" className="app-update-dismiss" aria-label="បិទ" onClick={() => { uiState.updateBannerOpen = false; }}>✕</button>
        </div>
    );
}
