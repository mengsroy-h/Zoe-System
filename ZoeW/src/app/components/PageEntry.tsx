import type { CSSProperties } from 'react';
import { scanState, uiState } from '../../core/state';
import { viewState, type EntryMode } from '../../core/view-state';
import { applyCameraZoomFromSlider } from '../../services/camera';
import { onAct } from '../actions';
import { useStoreFields, useStoreValue } from '../hooks/useStore';
import { refTo } from '../refs';
import { hardwareScannerKeyPress } from '../behaviors/scanner-input';
import { togglePanelFromHandle } from '../behaviors/panel-motion';
import { entrySearchBlurred, entrySearchFocused } from '../behaviors/entry-search';
import { MemoEntryListTableBody } from './entry/EntryListTableBody';
import { LockerListFilterSelect } from './entry/LockerListFilterSelect';
import { MemoLockerListTableBody } from './entry/LockerListTableBody';
import { panelSectionClass } from './shell/panel-classes';

const MODES: ReadonlyArray<{ mode: EntryMode; id: string; label: string; extra?: string }> = [
    { mode: 'parcel', id: 'modeParcelBtn', label: '📦 បញ្ចូលកញ្ចប់' },
    { mode: 'locker', id: 'modeLockerBtn', label: '📍 កំណត់ទីតាំង Locker' },
    { mode: 'remove', id: 'modeRemoveBtn', label: '🗑️ ស្កេនដកកញ្ចប់', extra: 'mode-remove-btn' }
];

function displayStyle(display: string): CSSProperties | undefined {
    return display ? { display } : undefined;
}

const videoRef = refTo('video');

function bindVideo(el: HTMLElement | null) {
    if (el) { (el as HTMLVideoElement).muted = true; el.setAttribute('muted', ''); }
    videoRef(el);
}

function CameraBox() {
    const v = useStoreFields(viewState, ['cameraView', 'cameraZoomDisplay', 'cameraTorchDisplay', 'cameraOverlayDisplay', 'cameraZoomRange', 'cameraWebkitInline']);
    const torchOn = useStoreValue(scanState, (s) => s.torchOn);
    const closedOnce = v.cameraView === 'closed';
    const range = v.cameraZoomRange;
    return (
        <div className="app-card scanner-section">
            <div id="permission-box" style={v.cameraView === 'live' ? { display: 'none' } : (closedOnce ? { display: 'block' } : undefined)}>
                <p>{closedOnce ? '📷 កាមេរ៉ាបានបិទ' : '🔒 កម្មវិធីទាមទារការអនុញ្ញាតប្រើប្រាស់កាមេរ៉ា'}</p>
                <button onClick={onAct("requestCameraPermission")}>{closedOnce ? '🔓 បើកកាមេរ៉ាម្តងទៀត' : '🔓 បើកកាមេរ៉ា'}</button>
            </div>
            <div id="video-container" ref={refTo('videoContainer')} style={v.cameraView === 'live' ? { display: 'block' } : (closedOnce ? { display: 'none' } : undefined)}>
                <div className="scan-line"></div>
                <video
                    id="video"
                    playsInline
                    autoPlay
                    muted
                    webkit-playsinline={v.cameraWebkitInline ? 'true' : undefined}
                    ref={bindVideo}
                ></video>
                <button
                    type="button"
                    className="camera-close-btn"
                    id="cameraCloseBtn"
                    title="បិទកាមេរ៉ា"
                    onClick={onAct("closeCameraManually")}
                >
                    ✖
                </button>
                <div className="video-controls-overlay" id="videoControlsOverlay" style={displayStyle(v.cameraOverlayDisplay)}>
                    <div className="zoom-slider-wrap" id="zoomSliderWrap" style={displayStyle(v.cameraZoomDisplay)}>
                        <span>🔍</span>
                        <input
                            type="range"
                            id="zoomSlider"
                            ref={refTo('zoomSlider')}
                            min={range ? range.min : 1}
                            max={range ? range.max : 1}
                            step={range ? range.step : 0.1}
                            defaultValue="1"
                            onInput={(e) => applyCameraZoomFromSlider((e.currentTarget as HTMLInputElement).value)}
                        />
                    </div>
                    <button
                        type="button"
                        className={torchOn ? 'torch-toggle-btn active' : 'torch-toggle-btn'}
                        id="torchToggleBtn"
                        style={displayStyle(v.cameraTorchDisplay)}
                        onClick={onAct("toggleTorch")}
                    >
                        💡
                    </button>
                </div>
            </div>
        </div>
    );
}

export function PageEntry() {
    const active = useStoreValue(uiState, (s) => s.currentAppPage === 'entry');
    const collapsed = useStoreValue(uiState, (s) => s.entryPanelCollapsed);
    const searching = useStoreValue(uiState, (s) => s.entryPanelCollapsed && s.entrySearchActive);
    const v = useStoreFields(viewState, ['entryModeShown', 'removeScanDetail', 'entryListCountText', 'entryListEmpty',
        'lockerListEmpty', 'activeLockerLabel']);
    const mode = v.entryModeShown;
    let pageCls = active ? 'app-page active' : 'app-page';
    if (mode === 'remove') pageCls += ' remove-scan-active';
    return (
        <section className={pageCls} id="pageEntry" ref={refTo('pageEntry')}>
            <div className={panelSectionClass('page-side', collapsed, false)} id="entrySideSection" ref={refTo('entrySideSection')}>
                <div className="scan-mode-row">
                    {MODES.map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            className={'mode-btn' + (m.extra ? ' ' + m.extra : '') + (mode === m.mode ? ' active' : '')}
                            id={m.id}
                            aria-pressed={mode === m.mode ? 'true' : 'false'}
                            onClick={onAct("setEntryScanMode", { args: [m.mode] })}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
                <div
                    className={mode === 'remove' ? 'remove-scan-banner' : 'remove-scan-banner hidden'}
                    id="removeScanBanner"
                    role="status"
                    aria-live="polite"
                >
                    <span className="remove-scan-icon" aria-hidden="true">🗑️</span>
                    <span className="remove-scan-copy">
                        <strong>របៀបស្កេនដកកញ្ចប់</strong>
                        <span id="removeScanBannerDetail">{v.removeScanDetail}</span>
                    </span>
                </div>
                <CameraBox />
                <div className="hardware-scanner-box" id="hardwareScannerBox">
                    <label htmlFor="hwScannerInput" id="hardwareScannerLabel">{mode === 'remove'
                        ? 'ស្កេន Barcode ដែលត្រូវដក (កាមេរ៉ា/Bluetooth/USB/វាយដោយដៃ)'
                        : 'ស្កេន Barcode (Bluetooth/USB) ឬវាយបញ្ចូលដោយដៃ'}</label>
                    <div className="scanner-input-wrapper">
                        <span className="icon">⚡</span>
                        <input
                            type="text"
                            id="hwScannerInput"
                            ref={refTo('hwScannerInput')}
                            placeholder={mode === 'locker'
                                ? 'ស្កេន Barcode ដើម្បីកំណត់ទីតាំង...'
                                : (mode === 'remove' ? 'ស្កេន Barcode ដែលត្រូវដក...' : 'ស្កេន Barcode...')}
                            autoComplete="off"
                            onKeyPress={hardwareScannerKeyPress}
                        />
                        <button type="button" className="btn-submit-barcode" onClick={onAct("submitManualBarcode")}>បញ្ជូន</button>
                    </div>
                    <div className="upload-fallback-row">
                        <label className="file-upload-btn" htmlFor="fileInput">📁 យក Barcode ពីរូបភាព</label>
                        <input
                            type="file"
                            id="fileInput"
                            ref={refTo('fileInput')}
                            accept="image/*"
                            onChange={onAct("decodeImageFile", { evt: true })}
                        />
                    </div>
                </div>
            </div>
            <div className={searching ? 'page-main entry-search-open' : 'page-main'} id="entryMainSection" ref={refTo('entryMainSection')}>
                <div
                    className="drag-handle-bar"
                    id="entryDragHandle"
                    title="អូសឡើង/ចុះ ដើម្បីបង្រួម ឬពង្រីកបញ្ជី"
                    onClick={() => togglePanelFromHandle('entry')}
                ></div>
                <div id="parcelPanel" className={mode === 'locker' ? 'hidden' : undefined}>
                    <div className="app-card panel-section">
                        <div className="card-header">
                            <div className="card-title">
                                📦 កញ្ចប់ដែលបានបញ្ចូលថ្ងៃនេះ (
                                <span id="entryListCount">{v.entryListCountText}</span>
                                )
                            </div>
                        </div>
                        <div className="filter-bar">
                            <input
                                type="text"
                                id="entryListSearchInput"
                                ref={refTo('entryListSearchInput')}
                                placeholder="ស្វែងរកលេខទូរស័ព្ទ ឬ Barcode..."
                                autoComplete="off"
                                onInput={onAct("renderEntryList")}
                                onFocus={entrySearchFocused}
                                onBlur={entrySearchBlurred}
                            />
                        </div>
                        <div className="table-responsive" id="entryTableResponsive" ref={refTo('entryTableResponsive')}>
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: "12%", textAlign: "center" }}>ល.រ</th>
                                        <th style={{ width: "34%" }}>អតិថិជន</th>
                                        <th style={{ width: "32%" }}>Barcode</th>
                                        <th style={{ width: "22%", textAlign: "right" }}>តម្លៃ</th>
                                    </tr>
                                </thead>
                                <tbody id="entryListTableBody">
                                    <MemoEntryListTableBody />
                                </tbody>
                            </table>
                        </div>
                        <div id="entryListEmptyState" className={v.entryListEmpty ? 'empty-state' : 'empty-state hidden'}>
                            <span className="emoji">📭</span>
                            មិនទាន់មានកញ្ចប់បញ្ចូលថ្ងៃនេះទេ
                        </div>
                    </div>
                </div>
                <div id="lockerPanel" className={mode === 'locker' ? undefined : 'hidden'}>
                    <div className="active-locker-bar">
                        <span>
                            ទីតាំងបច្ចុប្បន្ន:{' '}
                            <span className="loc-val" id="activeLockerLabel">{v.activeLockerLabel}</span>
                        </span>
                        <button type="button" onClick={onAct("openLockerPicker")}>🔁 ប្តូរទូ</button>
                    </div>
                    <div className="app-card panel-section">
                        <div className="card-header">
                            <div className="card-title">📍 បញ្ជីទីតាំង Locker</div>
                        </div>
                        <div className="filter-bar">
                            <input
                                type="text"
                                id="lockerListSearchInput"
                                ref={refTo('lockerListSearchInput')}
                                placeholder="ស្វែងរកលេខទូរស័ព្ទ..."
                                autoComplete="off"
                                onInput={onAct("renderLockerList")}
                                onFocus={entrySearchFocused}
                                onBlur={entrySearchBlurred}
                            />
                            <LockerListFilterSelect />
                        </div>
                        <div className="table-responsive" id="lockerTableResponsive" ref={refTo('lockerTableResponsive')}>
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: "14%", textAlign: "center" }}>ល.រ</th>
                                        <th style={{ width: "46%" }}>លេខទូរស័ព្ទ</th>
                                        <th style={{ width: "40%" }}>ទីតាំង Locker</th>
                                    </tr>
                                </thead>
                                <tbody id="lockerListTableBody">
                                    <MemoLockerListTableBody />
                                </tbody>
                            </table>
                        </div>
                        <div id="lockerListEmptyState" className={v.lockerListEmpty ? 'empty-state' : 'empty-state hidden'}>
                            <span className="emoji">📭</span>
                            មិនទាន់មានទិន្នន័យកំណត់ទីតាំងនៅឡើយទេ
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
