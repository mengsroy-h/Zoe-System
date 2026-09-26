import { viewState } from '../core/view-state';
import { dataState, uiState } from '../core/state';
import { PICKUP_DATE_KEY_PATTERN, getServerNow } from '../core/clock';
import { STATS_DAILY_VIEW_KEYS } from '../core/text';
import { getFormattedClockTime, getZoneDateKey } from '../core/timezone';
import { ledgerNumber } from '../domain/ledger';
import { countPickedUpCustomers } from '../domain/pickup';
import { updateDailyScheduleStats } from './daily-stats';
import { beginPdfPrint, collectedMoneyText, collectedRielText, collectedValueIsMeasurable, collectedValueOf, exportFailureMessage, forceSheetTextCells, loadScriptOnce, uncollectedValueByDate } from './export';
import { emptyViewMessage } from '../services/db-listeners';
import { renderHistory } from '../ui/history-render';
import { closeModal, openModalHelper } from '../ui/modal';
import { getFilteredDataByDate } from '../ui/more-menu';
import { showToast } from '../ui/toast';
import { saveWorkbook } from '../platform/file-output';

export const MONTHLY_REPORT_MONTH_PATTERN = /^\d{4}-\d{2}$/;

export const MONTHLY_REPORT_HEADERS = ['ថ្ងៃ', 'កញ្ចប់ចូល', 'COD យករួច ($)', 'DOD យករួច ($)',
    'ចំណូលយករួច ($)', 'មិនទាន់យក ($)', 'តម្លៃទាំងអស់ ($)', 'កញ្ចប់យករួច', 'អតិថិជនយក'];

export const MONTHLY_REPORT_UNKNOWN = '—';

export const MONTHLY_REPORT_TEXT_COLUMN_INDEXES = [0];

export const MONTHLY_REPORT_MONEY_TOLERANCE = 0.005;

export function statsMonthOf(dateKey) {
    const key = String(dateKey === undefined || dateKey === null ? '' : dateKey);
    return PICKUP_DATE_KEY_PATTERN.test(key) ? key.substring(0, 7) : '';
}

export function statsPositive(value) {
    const n = ledgerNumber(value);
    return n > 0 ? n : 0;
}

export function statsMoney(value) {
    return Math.round(statsPositive(value) * 100) / 100;
}

export function statsCount(value) {
    return Math.round(statsPositive(value));
}

export function monthlyReportAvailableMonths() {
    const months = {};
    const safeMap = (map) => ((map && typeof map === 'object') ? map : {});
    [safeMap(dataState.dailyRevenueData), safeMap(dataState.dailyPickupData)].forEach((map) => {
        Object.keys(map).forEach((key) => {
            const ym = statsMonthOf(key);
            if (ym) months[ym] = true;
        });
    });
    Object.keys(safeMap(dataState.monthlyRevenueData)).forEach((key) => {
        if (MONTHLY_REPORT_MONTH_PATTERN.test(key)) months[key] = true;
    });
    return Object.keys(months).sort().reverse();
}

export function buildMonthlyReport(ym) {
    const month = MONTHLY_REPORT_MONTH_PATTERN.test(String(ym === undefined || ym === null ? '' : ym)) ? String(ym) : '';
    const report = {
        month: month,
        days: [],
        totals: {
            count: 0, cod: 0, dod: 0, total: 0,
            collectedCod: 0, collectedDod: 0, collectedTotal: 0, pendingTotal: 0,
            picked: 0, customers: 0, activeDays: 0, pickupRate: null, collectedMeasurable: false
        },
        ledger: null,
        mismatch: false
    };
    if (!month) return report;
    const revenueMap = (dataState.dailyRevenueData && typeof dataState.dailyRevenueData === 'object') ? dataState.dailyRevenueData : {};
    const pickupMap = (dataState.dailyPickupData && typeof dataState.dailyPickupData === 'object') ? dataState.dailyPickupData : {};
    const uncollectedMap = uncollectedValueByDate();
    report.totals.collectedMeasurable = collectedValueIsMeasurable();
    const dates = {};
    [revenueMap, pickupMap].forEach((map) => {
        Object.keys(map).forEach((key) => {
            if (statsMonthOf(key) === month) dates[key] = true;
        });
    });
    Object.keys(dates).sort().forEach((date) => {
        const revenue = revenueMap[date] || {};
        const pickup = pickupMap[date] || {};
        const cod = statsMoney(revenue.codDollar);
        const dod = statsMoney(revenue.dodDollar);
        const count = statsCount(revenue.totalCount);
        const picked = statsCount(pickup.packagesPickedUp);
        const customers = countPickedUpCustomers(pickup);
        const total = Math.round((cod + dod) * 100) / 100;
        const collected = collectedValueOf(cod, dod, uncollectedMap[date]);
        const pending = Math.round(Math.max(0, total - collected.total) * 100) / 100;
        report.days.push({
            date: date,
            count: count,
            cod: cod,
            dod: dod,
            total: total,
            collectedCod: collected.cod,
            collectedDod: collected.dod,
            collectedTotal: collected.total,
            pendingTotal: pending,
            picked: picked,
            customers: customers
        });
        report.totals.count += count;
        report.totals.cod += cod;
        report.totals.dod += dod;
        report.totals.collectedCod += collected.cod;
        report.totals.collectedDod += collected.dod;
        report.totals.collectedTotal += collected.total;
        report.totals.pendingTotal += pending;
        report.totals.picked += picked;
        report.totals.customers += customers;
    });
    report.totals.cod = Math.round(report.totals.cod * 100) / 100;
    report.totals.dod = Math.round(report.totals.dod * 100) / 100;
    report.totals.total = Math.round((report.totals.cod + report.totals.dod) * 100) / 100;
    report.totals.collectedCod = Math.round(report.totals.collectedCod * 100) / 100;
    report.totals.collectedDod = Math.round(report.totals.collectedDod * 100) / 100;
    report.totals.collectedTotal = Math.round(report.totals.collectedTotal * 100) / 100;
    report.totals.pendingTotal = Math.round(report.totals.pendingTotal * 100) / 100;
    report.totals.activeDays = report.days.length;
    report.totals.pickupRate = report.totals.count > 0
        ? Math.round((report.totals.picked / report.totals.count) * 1000) / 10
        : null;
    const stored = (dataState.monthlyRevenueData && typeof dataState.monthlyRevenueData === 'object') ? dataState.monthlyRevenueData[month] : null;
    if (stored && typeof stored === 'object') {
        report.ledger = {
            cod: statsMoney(stored.codDollar),
            dod: statsMoney(stored.dodDollar),
            count: statsCount(stored.totalCount)
        };
        report.mismatch = Math.abs(report.ledger.cod - report.totals.cod) > MONTHLY_REPORT_MONEY_TOLERANCE
            || Math.abs(report.ledger.dod - report.totals.dod) > MONTHLY_REPORT_MONEY_TOLERANCE
            || report.ledger.count !== report.totals.count;
    }
    return report;
}

export function monthlyReportRiel(dollar) {
    return Math.round((Number(dollar) || 0) * dataState.exchangeRateRiel);
}

export function monthlyReportFilenameBase() {
    return ('ZoeW_report_' + (uiState.monthlyReportMonth || 'month')).replace(/[^a-zA-Z0-9_\-]/g, '');
}

export function monthlyReportRows(report) {
    const measurable = !!(report && report.totals && report.totals.collectedMeasurable);
    const cell = (value) => (measurable ? value : MONTHLY_REPORT_UNKNOWN);
    const rows = report.days.map((d) => [d.date, d.count, cell(d.collectedCod), cell(d.collectedDod),
        cell(d.collectedTotal), cell(d.pendingTotal), d.total, d.picked, d.customers]);
    const t = report.totals;
    rows.push(['សរុប', t.count, cell(t.collectedCod), cell(t.collectedDod), cell(t.collectedTotal),
        cell(t.pendingTotal), t.total, t.picked, t.customers]);
    return rows;
}

export function renderMonthlyReport() {
    const report = buildMonthlyReport(uiState.monthlyReportMonth);
    if (!report.month || !report.days.length) {
        uiState.monthlyReportView = { empty: emptyViewMessage(STATS_DAILY_VIEW_KEYS, 'គ្មានទិន្នន័យសម្រាប់ខែនេះទេ'), tiles: [], mismatch: null, headers: [], rows: [] };
        uiState.touch();
        return;
    }
    const totals = report.totals;
    const measurable = totals.collectedMeasurable;
    const tiles = [
        { tone: 'money-collected', label: '💵 ចំណូលសរុប (យករួច)', value: collectedMoneyText(totals.collectedTotal, measurable), sub: collectedRielText(totals.collectedTotal, measurable) },
        { tone: 'money-collected', label: 'COD (យករួច)', value: collectedMoneyText(totals.collectedCod, measurable), sub: collectedRielText(totals.collectedCod, measurable) },
        { tone: 'money-collected', label: 'DOD (យករួច)', value: collectedMoneyText(totals.collectedDod, measurable), sub: collectedRielText(totals.collectedDod, measurable) },
        { tone: '', label: 'កញ្ចប់ចូល', value: totals.count.toLocaleString(), sub: 'ថ្ងៃមានប្រតិបត្តិការ ' + totals.activeDays.toLocaleString() },
        { tone: '', label: 'កញ្ចប់យករួច', value: totals.picked.toLocaleString(), sub: totals.pickupRate === null ? 'អត្រាយក —' : 'អត្រាយក ' + totals.pickupRate.toFixed(1) + '%' },
        { tone: '', label: 'អតិថិជនយក', value: totals.customers.toLocaleString(), sub: 'បូកតាមថ្ងៃ' },
        {
            tone: 'money-total',
            label: '📦 តម្លៃកញ្ចប់ទាំងអស់',
            value: '$' + totals.total.toFixed(2),
            sub: monthlyReportRiel(totals.total).toLocaleString() + ' ៛',
            pending: 'មិនទាន់យក ' + collectedMoneyText(totals.pendingTotal, measurable)
        }
    ];
    uiState.monthlyReportView = {
        empty: null,
        tiles: tiles,
        mismatch: (report.mismatch && report.ledger)
            ? { cod: report.ledger.cod.toFixed(2), dod: report.ledger.dod.toFixed(2), count: report.ledger.count.toLocaleString() }
            : null,
        headers: MONTHLY_REPORT_HEADERS,
        rows: report.days.map((d) => ({
            date: d.date,
            count: d.count.toLocaleString(),
            collectedCod: collectedMoneyText(d.collectedCod, measurable),
            collectedDod: collectedMoneyText(d.collectedDod, measurable),
            collectedTotal: collectedMoneyText(d.collectedTotal, measurable),
            pendingTotal: collectedMoneyText(d.pendingTotal, measurable),
            total: d.total.toFixed(2),
            picked: d.picked.toLocaleString(),
            customers: d.customers.toLocaleString()
        }))
    };
    uiState.touch();
}

export function openMonthlyReportModal() {
    const months = monthlyReportAvailableMonths();
    const currentMonth = getZoneDateKey(getServerNow(), 0).substring(0, 7);
    if (months.indexOf(currentMonth) === -1) months.unshift(currentMonth);
    if (months.indexOf(uiState.monthlyReportMonth) === -1) uiState.monthlyReportMonth = months[0] || currentMonth;
    uiState.monthlyReportMonths = months;
    uiState.touch();
    openModalHelper('monthlyReportModal');
    renderMonthlyReport();
}

export async function exportMonthlyReportAsExcel() {
    const report = buildMonthlyReport(uiState.monthlyReportMonth);
    if (!report.days.length) { showToast(emptyViewMessage(STATS_DAILY_VIEW_KEYS, "⚠️ គ្មានទិន្នន័យសម្រាប់ខែនេះទេ!")); return; }
    closeModal('monthlyReportModal');
    showToast("⏳ កំពុងរៀបចំ Excel...");
    try {
        await loadScriptOnce('xlsx');
        const rows = monthlyReportRows(report);
        const aoa = [MONTHLY_REPORT_HEADERS].concat(rows);
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        forceSheetTextCells(ws, rows.length, MONTHLY_REPORT_TEXT_COLUMN_INDEXES);
        ws['!cols'] = [{ wch: 12 }, { wch: 11 }, { wch: 14 }, { wch: 14 }, { wch: 15 },
            { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'របាយការណ៍ខែ');
        await saveWorkbook(wb, monthlyReportFilenameBase() + '.xlsx');
        showToast("✅ បាន Export របាយការណ៍ប្រចាំខែជា Excel ជោគជ័យ!");
    } catch (e) {
        console.error("Monthly report Excel export failed:", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Monthly report Excel export failed:" });
        showToast(exportFailureMessage(e));
    }
}

export function exportMonthlyReportAsPDF() {
    const report = buildMonthlyReport(uiState.monthlyReportMonth);
    if (!report.days.length) { showToast(emptyViewMessage(STATS_DAILY_VIEW_KEYS, "⚠️ គ្មានទិន្នន័យសម្រាប់ខែនេះទេ!")); return; }
    closeModal('monthlyReportModal');
    const totals = report.totals;
    const measurable = totals.collectedMeasurable;
    uiState.pdfExportView = {
        title: 'ZoeW — របាយការណ៍អាជីវកម្មប្រចាំខែ ' + report.month,
        headers: MONTHLY_REPORT_HEADERS,
        rows: report.days.map((d) => [d.date, d.count.toLocaleString(),
            collectedMoneyText(d.collectedCod, measurable), collectedMoneyText(d.collectedDod, measurable),
            collectedMoneyText(d.collectedTotal, measurable), collectedMoneyText(d.pendingTotal, measurable),
            d.total.toFixed(2), d.picked.toLocaleString(), d.customers.toLocaleString()]),
        totalRow: {
            cells: ['សរុប', totals.count.toLocaleString(),
                collectedMoneyText(totals.collectedCod, measurable), collectedMoneyText(totals.collectedDod, measurable),
                collectedMoneyText(totals.collectedTotal, measurable), collectedMoneyText(totals.pendingTotal, measurable),
                totals.total.toFixed(2), totals.picked.toLocaleString(), totals.customers.toLocaleString()]
        },
        footer: `ចំណូលសរុប (យករួច) ${collectedMoneyText(totals.collectedTotal, measurable)}
                / ${collectedRielText(totals.collectedTotal, measurable)} (អត្រា ${dataState.exchangeRateRiel.toLocaleString()} ៛)
                · តម្លៃកញ្ចប់ទាំងអស់ $${totals.total.toFixed(2)}
                · ថ្ងៃមានប្រតិបត្តិការ ${totals.activeDays.toLocaleString()}
                · នាំចេញនៅ ${getZoneDateKey(getServerNow(), 0) + ' ' + getFormattedClockTime(getServerNow())}`
    };
    beginPdfPrint(monthlyReportFilenameBase());
}

export function applyCurrentFilter() {
    let titleText = "ថ្ងៃនេះ";
    if (uiState.currentFilterMode === 'yesterday') titleText = "ម្សិលមិញ";
    if (uiState.currentFilterMode === 'dayBefore') titleText = "ម្សិលម្ងៃ";
    if (uiState.currentFilterMode === 'custom') titleText = uiState.customFilterDate;
    if (uiState.currentFilterMode === 'all') titleText = "ទាំងអស់";

    let filteredData = getFilteredDataByDate();

    viewState.selectedFilterTitle = titleText;
    renderHistory(filteredData);
    updateDailyScheduleStats(filteredData);
}
