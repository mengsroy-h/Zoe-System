import { fieldValue, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { dataState, uiState } from '../core/state';
import { STATS_COLLECTED_VIEW_KEYS, STATS_DAILY_VIEW_KEYS } from '../core/text';
import { getFormattedDate } from '../core/timezone';
import { sanitizeInput } from '../domain/barcode';
import { DAILY_COLLECTED_DAY_PATTERN, DAILY_COLLECTED_KEEP_DAYS, collectedTotalsOfDay } from '../domain/collected';
import { addRevenueToDailyAndMonthlyRecord, correctRevenueLedgerToActual } from '../domain/ledger';
import { collectedMoneyText, collectedRielText, collectedValueIsMeasurable, collectedValueOf, uncollectedValueByDate } from './export';
import { statsCount, statsMoney } from './monthly-report';
import { emptyViewMessage } from '../services/db-listeners';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { buildCollectedCardItem, buildStatCardItem } from '../ui/modal-stack';
import { showToast } from '../ui/toast';

export function isMonthKeyRetained(ymKey) {
    const keys = new Set(Object.keys(dataState.monthlyRevenueData));
    keys.add(ymKey);
    const latestThreeKeys = Array.from(keys).sort().reverse().slice(0, 3);
    return latestThreeKeys.includes(ymKey);
}

export function openManualAdjustModal() {
    setFieldValue('manualDateInput', getFormattedDate());
    setFieldValue('manualCodChangeInput', '');
    setFieldValue('manualDodChangeInput', '');
    setFieldValue('manualCountChangeInput', '');
    viewState.manualAdjustBusy = false;
    openModalHelper('manualAdjustModal');
}

export function submitManualAdjustment() {
    if (viewState.manualAdjustBusy) return;


    let dateVal = sanitizeInput(fieldValue('manualDateInput').trim());
    let codChange = parseFloat(fieldValue('manualCodChangeInput')) || 0;
    let dodChange = parseFloat(fieldValue('manualDodChangeInput')) || 0;
    let countChange = parseInt(fieldValue('manualCountChangeInput')) || 0;

    if (!codChange && !dodChange && !countChange) {
        alert("សូមបញ្ចូលយ៉ាងហោចណាស់ការកែប្រែ COD, DOD ឬចំនួនកញ្ចប់មួយ!");
        return;
    }

    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!dateVal || !dateRegex.test(dateVal)) {
        alert("សូមបញ្ចូលកាលបរិច្ឆេទឱ្យបានត្រឹមត្រូវតាមទម្រង់ YYYY-MM-DD (ឧ. 2026-06-05)!");
        return;
    }
    const [adjYear, adjMonth, adjDay] = dateVal.split('-').map(Number);
    const adjParsedDate = new Date(adjYear, adjMonth - 1, adjDay);
    if (adjParsedDate.getFullYear() !== adjYear || adjParsedDate.getMonth() !== adjMonth - 1 || adjParsedDate.getDate() !== adjDay) {
        alert("កាលបរិច្ឆេទមិនត្រឹមត្រូវទេ! សូមពិនិត្យខែ/ថ្ងៃម្តងទៀត (ឧ. ខែកុម្ភៈគ្មានថ្ងៃទី 30 ទេ)។");
        return;
    }

    const adjYmKey = dateVal.substring(0, 7);
    if (!isMonthKeyRetained(adjYmKey)) {
        if (!confirm("⚠️ ខែនេះលើសពីរយៈពេលរក្សាទុក ៣ខែ ការកែប្រែនឹងមិនត្រូវបានរក្សាទុកទេ! (ប្រព័ន្ធរក្សាទុកតែ ៣ ខែចុងក្រោយប៉ុណ្ណោះ) តើអ្នកចង់បន្តទេ?")) {
            return;
        }
    }

    viewState.manualAdjustBusy = true;
    const manualRevenueApplied = addRevenueToDailyAndMonthlyRecord(dateVal, codChange, dodChange, countChange);
    correctRevenueLedgerToActual(dateVal, manualRevenueApplied, codChange, dodChange, countChange).then((status) => {
        if (status && status.ok) {
            showToast("✅ កែប្រែស្ថិតិ COD, DOD និងកញ្ចប់ដោយដៃបានជោគជ័យ!");
            return;
        }
        const ledgerErr = new Error('Manual revenue reconciliation did not commit');
        if (window.ZoeErrors) ZoeErrors.capture(ledgerErr, { zone: 'money', context: 'submitManualAdjustment ledger reconciliation' });
        showToast("⚠️ ការកែប្រែមិនទាន់រក្សាទុកពេញលេញទេ! សូមពិនិត្យបណ្តាញ ហើយសាកល្បងម្ដងទៀត។");
    }, (ledgerErr) => {
        if (window.ZoeErrors) ZoeErrors.capture(ledgerErr, { zone: 'money', context: 'submitManualAdjustment ledger reconciliation' });
        showToast("⚠️ ការកែប្រែមិនទាន់រក្សាទុកពេញលេញទេ! សូមពិនិត្យបណ្តាញ ហើយសាកល្បងម្ដងទៀត។");
    });

    closeModal('manualAdjustModal');
    showToast("⏳ កំពុងផ្ទៀងផ្ទាត់ការកែប្រែស្ថិតិជាមួយ Firebase…");
    refreshCurrentHistoryView();
}

export function openDailyStatsModal() {

    let sortedKeys = Object.keys(dataState.dailyRevenueData).sort().reverse();
    const uncollectedMap = uncollectedValueByDate();
    const measurable = collectedValueIsMeasurable();

    if (sortedKeys.length === 0) {
        uiState.dailyStatsView = { empty: emptyViewMessage(STATS_DAILY_VIEW_KEYS, 'គ្មានទិន្នន័យប្រចាំថ្ងៃទេ'), cards: [] };
    } else {
        uiState.dailyStatsView = {
            empty: null,
            // ⛔ `collectedValueOf()` ត្រូវហៅ **ក្នុងមួយថ្ងៃ** — កម្រិតបូក
            //   ជាការសម្រេចរបស់កន្លែងហៅ (មើលច្បាប់ «ជាន់ទី ៣ ៖ កម្រិតបូក»)។
            cards: sortedKeys.map((dateStr) => {
                const data = dataState.dailyRevenueData[dateStr] || {};
                return buildStatCardItem('ថ្ងៃទី', dateStr,
                    statsMoney(data.codDollar), statsMoney(data.dodDollar), statsCount(data.totalCount),
                    collectedValueOf(data.codDollar, data.dodDollar, uncollectedMap[dateStr]), measurable);
            })
        };
    }
    uiState.touch();

    openModalHelper('dailyStatsModal');
}

export function openCollectedStatsModal() {

    const days = Object.keys(dataState.dailyCollectedData || {})
        .filter((day) => DAILY_COLLECTED_DAY_PATTERN.test(day))
        .sort().reverse()
        .slice(0, DAILY_COLLECTED_KEEP_DAYS);

    if (!days.length) {
        uiState.collectedStatsView = { empty: emptyViewMessage(STATS_COLLECTED_VIEW_KEYS, 'មិនទាន់មានកញ្ចប់ណាបិទ «យក» ក្នុង ៧ ថ្ងៃចុងក្រោយទេ'), cards: [] };
    } else {
        uiState.collectedStatsView = {
            empty: null,
            cards: days.map((day) => buildCollectedCardItem(day, collectedTotalsOfDay(dataState.dailyCollectedData[day])))
        };
    }
    uiState.touch();

    openModalHelper('collectedStatsModal');
}
