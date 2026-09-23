import { onAct } from '../actions';
import { EntryListTableBody } from './entry/EntryListTableBody';
import { LockerListFilterSelect } from './entry/LockerListFilterSelect';
import { LockerListTableBody } from './entry/LockerListTableBody';

/** ទំព័រ ២ — ស្កេន */
export function PageEntry() {
    return (
        <section className="app-page" id="pageEntry">
            <div className="page-side" id="entrySideSection">
                <div className="scan-mode-row">
                    <button
                        type="button"
                        className="mode-btn active"
                        id="modeParcelBtn"
                        aria-pressed="true"
                        onClick={onAct("setEntryScanMode", { args: ["parcel"] })}
                    >
                        📦 បញ្ចូលកញ្ចប់
                    </button>
                    <button
                        type="button"
                        className="mode-btn"
                        id="modeLockerBtn"
                        aria-pressed="false"
                        onClick={onAct("setEntryScanMode", { args: ["locker"] })}
                    >
                        📍 កំណត់ទីតាំង Locker
                    </button>
                    <button
                        type="button"
                        className="mode-btn mode-remove-btn"
                        id="modeRemoveBtn"
                        aria-pressed="false"
                        onClick={onAct("setEntryScanMode", { args: ["remove"] })}
                    >
                        🗑️ ស្កេនដកកញ្ចប់
                    </button>
                </div>
                <div
                    className="remove-scan-banner hidden"
                    id="removeScanBanner"
                    role="status"
                    aria-live="polite"
                >
                    <span className="remove-scan-icon" aria-hidden="true">🗑️</span>
                    <span className="remove-scan-copy">
                        <strong>របៀបស្កេនដកកញ្ចប់</strong>
                        <span id="removeScanBannerDetail">ស្កេន Barcode ហើយផ្ទៀងផ្ទាត់ព័ត៌មានមុនដក។</span>
                    </span>
                </div>
                <div className="app-card scanner-section">
                    <div id="permission-box">
                        <p>🔒 កម្មវិធីទាមទារការអនុញ្ញាតប្រើប្រាស់កាមេរ៉ា</p>
                        <button onClick={onAct("requestCameraPermission")}>🔓 បើកកាមេរ៉ា</button>
                    </div>
                    <div id="video-container">
                        <div className="scan-line"></div>
                        <video
                            id="video"
                            playsInline
                            autoPlay
                            muted
                            ref={(el) => { if (el) { el.muted = true; el.setAttribute('muted', ''); } }}
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
                        <div className="video-controls-overlay" id="videoControlsOverlay">
                            <div className="zoom-slider-wrap" id="zoomSliderWrap">
                                <span>🔍</span>
                                <input type="range" id="zoomSlider" min={1} max={1} step={0.1} value="1" />
                            </div>
                            <button
                                type="button"
                                className="torch-toggle-btn"
                                id="torchToggleBtn"
                                onClick={onAct("toggleTorch")}
                            >
                                💡
                            </button>
                        </div>
                    </div>
                </div>
                <div className="hardware-scanner-box" id="hardwareScannerBox">
                    <label htmlFor="hwScannerInput" id="hardwareScannerLabel">ស្កេន Barcode (Bluetooth/USB) ឬវាយបញ្ចូលដោយដៃ</label>
                    <div className="scanner-input-wrapper">
                        <span className="icon">⚡</span>
                        <input type="text" id="hwScannerInput" placeholder="ស្កេន Barcode..." autoComplete="off" />
                        <button type="button" className="btn-submit-barcode" onClick={onAct("submitManualBarcode")}>បញ្ជូន</button>
                    </div>
                    <div className="upload-fallback-row">
                        <label className="file-upload-btn" htmlFor="fileInput">📁 យក Barcode ពីរូបភាព</label>
                        <input
                            type="file"
                            id="fileInput"
                            accept="image/*"
                            onChange={onAct("decodeImageFile", { evt: true })}
                        />
                    </div>
                </div>
            </div>
            <div className="page-main" id="entryMainSection">
                <div
                    className="drag-handle-bar"
                    id="entryDragHandle"
                    title="អូសឡើង/ចុះ ដើម្បីបង្រួម ឬពង្រីកបញ្ជី"
                ></div>
                <div id="parcelPanel">
                    <div className="app-card panel-section">
                        <div className="card-header">
                            <div className="card-title">
                                📦 កញ្ចប់ដែលបានបញ្ចូលថ្ងៃនេះ (
                                <span id="entryListCount">0</span>
                                )
                            </div>
                        </div>
                        <div className="filter-bar">
                            <input
                                type="text"
                                id="entryListSearchInput"
                                placeholder="ស្វែងរកលេខទូរស័ព្ទ ឬ Barcode..."
                                autoComplete="off"
                                onInput={onAct("renderEntryList")}
                            />
                        </div>
                        <div className="table-responsive" id="entryTableResponsive">
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
                                    <EntryListTableBody />
                                </tbody>
                            </table>
                        </div>
                        <div id="entryListEmptyState" className="empty-state hidden">
                            <span className="emoji">📭</span>
                            មិនទាន់មានកញ្ចប់បញ្ចូលថ្ងៃនេះទេ
                        </div>
                    </div>
                </div>
                <div id="lockerPanel" className="hidden">
                    <div className="active-locker-bar">
                        <span>
                            ទីតាំងបច្ចុប្បន្ន:{' '}
                            <span className="loc-val" id="activeLockerLabel">-</span>
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
                                placeholder="ស្វែងរកលេខទូរស័ព្ទ..."
                                autoComplete="off"
                                onInput={onAct("renderLockerList")}
                            />
                            <LockerListFilterSelect />
                        </div>
                        <div className="table-responsive" id="lockerTableResponsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: "14%", textAlign: "center" }}>ល.រ</th>
                                        <th style={{ width: "46%" }}>លេខទូរស័ព្ទ</th>
                                        <th style={{ width: "40%" }}>ទីតាំង Locker</th>
                                    </tr>
                                </thead>
                                <tbody id="lockerListTableBody">
                                    <LockerListTableBody />
                                </tbody>
                            </table>
                        </div>
                        <div id="lockerListEmptyState" className="empty-state hidden">
                            <span className="emoji">📭</span>
                            មិនទាន់មានទិន្នន័យកំណត់ទីតាំងនៅឡើយទេ
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
