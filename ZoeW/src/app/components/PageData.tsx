import { onAct } from '../actions';
import { ZtoSyncBanner } from './zto/ZtoSyncBanner';
import { HistoryTableBody } from './history/HistoryTableBody';

/** ទំព័រ ១ — ទិន្នន័យ */
export function PageData() {
    return (
        <section className="app-page active" id="pageData">
            <div className="page-side" id="dataSideSection">
                <div className="app-card">
                    <div className="card-header">
                        <div className="card-title">
                            📦 គ្រប់គ្រងប្រចាំថ្ងៃ (
                            <span id="selectedFilterTitle">ថ្ងៃនេះ</span>
                            )
                        </div>
                    </div>
                    <div className="stats-grid">
                        <div className="stat-card total-pkg">
                            <span className="label">កញ្ចប់សរុប (នៅសល់)</span>
                            <span className="value" id="grandTotalCount">0</span>
                        </div>
                        <div className="stat-card">
                            <span className="label">ស្កេនតាមថ្ងៃ</span>
                            <span className="value" id="todayTotalCount">0</span>
                        </div>
                        <div className="stat-card picked-up">
                            <span className="label">អតិថិជនយក</span>
                            <span className="value" id="todayClosedCount">0</span>
                            <span className="sub-value">
                                📦{' '}
                                <span id="todayPackagesPickedUpCount">0</span>
                            </span>
                        </div>
                    </div>
                    <div className="financial-summary-box">
                        <div className="financial-row">
                            <span className="lbl">ទឹកប្រាក់ COD សរុប (នៅសល់)៖</span>
                            <div>
                                <span id="summaryCodDollar" className="val-pending">$0.00</span>
                                <span
                                    style={{ fontSize: "calc(10 * var(--fs-unit))", color: "var(--text-muted)", margin: "0 2px" }}
                                >
                                    /
                                </span>
                                <span
                                    id="summaryCodRiel"
                                    className="val-pending"
                                    style={{ fontSize: "calc(10 * var(--fs-unit))" }}
                                >
                                    0 ៛
                                </span>
                            </div>
                        </div>
                        <div className="financial-row">
                            <span className="lbl">ទឹកប្រាក់ DOD សរុប (នៅសល់)៖</span>
                            <div>
                                <span id="summaryDodDollar" className="val-pending">$0.00</span>
                                <span
                                    style={{ fontSize: "calc(10 * var(--fs-unit))", color: "var(--text-muted)", margin: "0 2px" }}
                                >
                                    /
                                </span>
                                <span
                                    id="summaryDodRiel"
                                    className="val-pending"
                                    style={{ fontSize: "calc(10 * var(--fs-unit))" }}
                                >
                                    0 ៛
                                </span>
                            </div>
                        </div>
                        <div
                            className="financial-row"
                            style={{ borderTop: "1px dashed var(--border-color)", paddingTop: "4px", marginTop: "2px" }}
                        >
                            <span className="lbl">ទឹកប្រាក់សរុបរួម (COD+DOD នៅសល់)៖</span>
                            <div>
                                <span id="summaryTotalDollar" className="val-pending">$0.00</span>
                                <span
                                    style={{ fontSize: "calc(10 * var(--fs-unit))", color: "var(--text-muted)", margin: "0 2px" }}
                                >
                                    /
                                </span>
                                <span
                                    id="summaryTotalRiel"
                                    className="val-pending"
                                    style={{ fontSize: "calc(10 * var(--fs-unit))" }}
                                >
                                    0 ៛
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="date-filter-grid">
                        <button
                            className="date-filter-btn active"
                            id="btnFilterToday"
                            onClick={onAct("filterDataByDate", { args: ["today"] })}
                        >
                            ថ្ងៃនេះ
                        </button>
                        <button
                            className="date-filter-btn"
                            id="btnFilterYesterday"
                            onClick={onAct("filterDataByDate", { args: ["yesterday"] })}
                        >
                            ម្សិលមិញ
                        </button>
                        <button
                            className="date-filter-btn"
                            id="btnFilterDayBefore"
                            onClick={onAct("filterDataByDate", { args: ["dayBefore"] })}
                        >
                            ម្សិលម្ងៃ
                        </button>
                        <button
                            className="date-filter-btn"
                            id="btnFilterAll"
                            onClick={onAct("filterDataByDate", { args: ["all"] })}
                        >
                            ទាំងអស់
                        </button>
                    </div>
                    <div className="custom-date-row">
                        <label htmlFor="customDateInput">📅 រើសថ្ងៃផ្សេងទៀត៖</label>
                        <input type="date" id="customDateInput" onChange={onAct("filterDataByCustomDate")} />
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
                                placeholder="ស្វែងរកលេខទូរស័ព្ទ..."
                                autoComplete="off"
                                onInput={onAct("debouncedSearchByPhone")}
                            />
                            <button onClick={onAct("searchByPhone")}>🔍</button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="page-main" id="dataMainSection">
                <div className="drag-handle-bar" id="dragHandle" title="អូសឡើង/ចុះ ដើម្បីបង្រួម ឬពង្រីកប្រវត្តិ"></div>
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
                            <span id="count">0</span>
                            {' '}នាក់)
                        </div>
                        <div className="header-actions">
                            <button
                                type="button"
                                className="zto-list-btn hidden"
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
                    <div className="zto-sync-banner hidden" id="ztoSyncBanner" role="status" aria-live="polite" onClick={onAct("openZtoSyncModal")}>
                        <ZtoSyncBanner />
                    </div>
                    <div className="table-responsive" id="tableResponsive">
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
