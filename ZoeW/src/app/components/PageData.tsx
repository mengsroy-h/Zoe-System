import type { FormEvent } from 'react';
import { uiState, ztoState } from '../../core/state';
import { viewState } from '../../core/view-state';
import { onAct } from '../actions';
import { useStoreFields, useStoreValue } from '../hooks/useStore';
import { refTo } from '../refs';
import { phoneSearchBlurred, phoneSearchFocused, phoneSearchKeyDown } from '../behaviors/phone-search';
import { togglePanelFromHandle } from '../behaviors/panel-motion';
import { showPhoneSuggestions } from '../../features/phone-suggest';
import { ZtoSyncBanner } from './zto/ZtoSyncBanner';
import { HistoryTableBody } from './history/HistoryTableBody';
import { panelSectionClass, pageClass } from './shell/panel-classes';

const FILTERS = [
    { mode: 'today', id: 'btnFilterToday', label: 'ថ្ងៃនេះ' },
    { mode: 'yesterday', id: 'btnFilterYesterday', label: 'ម្សិលមិញ' },
    { mode: 'dayBefore', id: 'btnFilterDayBefore', label: 'ម្សិលម្ងៃ' },
    { mode: 'all', id: 'btnFilterAll', label: 'ទាំងអស់' }
] as const;

const debouncedPhoneSearch = onAct("debouncedSearchByPhone");

function onPhoneSearchInput(e: FormEvent<HTMLInputElement>) {
    showPhoneSuggestions();
    debouncedPhoneSearch(e);
}

function DateFilterButtons() {
    const mode = useStoreValue(uiState, (s) => s.currentFilterMode);
    return (
        <div className="date-filter-grid">
            {FILTERS.map((f) => (
                <button
                    key={f.id}
                    className={mode === f.mode ? 'date-filter-btn active' : 'date-filter-btn'}
                    id={f.id}
                    onClick={onAct("filterDataByDate", { args: [f.mode] })}
                >
                    {f.label}
                </button>
            ))}
        </div>
    );
}

function DataSummary() {
    const d = useStoreValue(viewState, (s) => s.dataSummary);
    const small = { fontSize: "calc(10 * var(--fs-unit))", color: "var(--text-muted)", margin: "0 2px" };
    const riel = { fontSize: "calc(10 * var(--fs-unit))" };
    return (
        <>
            <div className="stats-grid">
                <div className="stat-card total-pkg">
                    <span className="label">កញ្ចប់សរុប (នៅសល់)</span>
                    <span className="value" id="grandTotalCount">{d.grandTotalCount}</span>
                </div>
                <div className="stat-card">
                    <span className="label">ស្កេនតាមថ្ងៃ</span>
                    <span className="value" id="todayTotalCount">{d.todayTotalCount}</span>
                </div>
                <div className="stat-card picked-up">
                    <span className="label">អតិថិជនយក</span>
                    <span className="value" id="todayClosedCount">{d.todayClosedCount}</span>
                    <span className="sub-value">
                        📦{' '}
                        <span id="todayPackagesPickedUpCount">{d.todayPackagesPickedUpCount}</span>
                    </span>
                </div>
            </div>
            <div className="financial-summary-box">
                <div className="financial-row">
                    <span className="lbl">ទឹកប្រាក់ COD សរុប (នៅសល់)៖</span>
                    <div>
                        <span id="summaryCodDollar" className="val-pending">{d.summaryCodDollar}</span>
                        <span style={small}>/</span>
                        <span id="summaryCodRiel" className="val-pending" style={riel}>{d.summaryCodRiel}</span>
                    </div>
                </div>
                <div className="financial-row">
                    <span className="lbl">ទឹកប្រាក់ DOD សរុប (នៅសល់)៖</span>
                    <div>
                        <span id="summaryDodDollar" className="val-pending">{d.summaryDodDollar}</span>
                        <span style={small}>/</span>
                        <span id="summaryDodRiel" className="val-pending" style={riel}>{d.summaryDodRiel}</span>
                    </div>
                </div>
                <div
                    className="financial-row"
                    style={{ borderTop: "1px dashed var(--border-color)", paddingTop: "4px", marginTop: "2px" }}
                >
                    <span className="lbl">ទឹកប្រាក់សរុបរួម (COD+DOD នៅសល់)៖</span>
                    <div>
                        <span id="summaryTotalDollar" className="val-pending">{d.summaryTotalDollar}</span>
                        <span style={small}>/</span>
                        <span id="summaryTotalRiel" className="val-pending" style={riel}>{d.summaryTotalRiel}</span>
                    </div>
                </div>
            </div>
        </>
    );
}

export function PageData() {
    const active = useStoreValue(uiState, (s) => s.currentAppPage === 'data');
    const panel = useStoreFields(uiState, ['dataPanelCollapsed', 'dataPanelSearchFocus']);
    const v = useStoreFields(viewState, ['selectedFilterTitle', 'historyCountText', 'ztoListSyncBtnVisible']);
    const bannerShown = useStoreValue(ztoState, (s) => s.ztoBannerView !== null);
    return (
        <section className={pageClass(active)} id="pageData" ref={refTo('pageData')}>
            <div className={panelSectionClass('page-side', panel.dataPanelCollapsed, panel.dataPanelSearchFocus)} id="dataSideSection" ref={refTo('dataSideSection')}>
                <div className="app-card">
                    <div className="card-header">
                        <div className="card-title">
                            📦 គ្រប់គ្រងប្រចាំថ្ងៃ (
                            <span id="selectedFilterTitle">{v.selectedFilterTitle}</span>
                            )
                        </div>
                    </div>
                    <DataSummary />
                    <DateFilterButtons />
                    <div className="custom-date-row">
                        <label htmlFor="customDateInput">📅 រើសថ្ងៃផ្សេងទៀត៖</label>
                        <input type="date" id="customDateInput" ref={refTo('customDateInput')} onChange={onAct("filterDataByCustomDate")} />
                    </div>
                </div>
                <div className="app-card">
                    <div className="card-header">
                        <div className="card-title">🔍 ស្វែងរកលេខទូរស័ព្ទអតិថិជន</div>
                    </div>
                    <div className="search-and-actions">
                        <div className="search-box">
                            <input
                                type="tel"
                                id="searchPhoneInput"
                                ref={refTo('searchPhoneInput')}
                                placeholder="ស្វែងរកលេខទូរស័ព្ទ..."
                                autoComplete="off"
                                onInput={onPhoneSearchInput}
                                onFocus={phoneSearchFocused}
                                onBlur={phoneSearchBlurred}
                                onKeyDown={phoneSearchKeyDown}
                            />
                            <button onClick={onAct("searchByPhone")}>🔍</button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="page-main" id="dataMainSection" ref={refTo('dataMainSection')}>
                <div className="drag-handle-bar" id="dragHandle" title="អូសឡើង/ចុះ ដើម្បីបង្រួម ឬពង្រីកប្រវត្តិ" onClick={() => togglePanelFromHandle('data')}></div>
                <div className="app-card history-section">
                    <button
                        className="header-more-btn"
                        title="ម៉ុនុយបន្ថែម"
                        onClick={onAct("toggleHeaderMoreDropdown", { evt: true, self: true })}
                    >
                        ...
                    </button>
                    <div className="card-header">
                        <div className="card-title">
                            📋 ប្រវត្តិ (
                            <span id="count">{v.historyCountText}</span>
                            {' '}នាក់)
                        </div>
                        <div className="header-actions">
                            <button
                                type="button"
                                className={v.ztoListSyncBtnVisible ? 'zto-list-btn' : 'zto-list-btn hidden'}
                                id="ztoListSyncBtn"
                                title="ទាញបញ្ជីកញ្ចប់ពី ZTO Argus"
                                onClick={onAct("openZtoListSyncModal")}
                            >
                                📥 បញ្ជី ZTO
                            </button>
                            <button className="daily-stats-btn" onClick={onAct("openDailyStatsModal")}>📅 កញ្ចប់ប្រចាំថ្ងៃ</button>
                            <button className="monthly-stats-btn" onClick={onAct("openCollectedStatsModal")}>💵 ចំណូលប្រចាំថ្ងៃ</button>
                        </div>
                    </div>
                    <div className="call-mark-legend">
                        <span className="row-num-no-answer">🔕 ខល អត់លើក</span>
                        <span className="row-num-no-connect">📵 ខល អត់ចូល</span>
                        <span className="row-num-wrong-number">❗ ខុសលេខ</span>
                    </div>
                    <div className={bannerShown ? 'zto-sync-banner' : 'zto-sync-banner hidden'} id="ztoSyncBanner" role="status" aria-live="polite" onClick={onAct("openZtoSyncModal")}>
                        <ZtoSyncBanner />
                    </div>
                    <div className="table-responsive" id="tableResponsive" ref={refTo('tableResponsive')}>
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th className="col-num">ល.រ</th>
                                    <th className="col-cust">អតិថិជន</th>
                                    <th className="col-price">តម្លៃ/ទីតាំង</th>
                                    <th className="col-act">សកម្មភាព</th>
                                </tr>
                            </thead>
                            <tbody id="historyTableBody">
                                <HistoryTableBody />
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
}
