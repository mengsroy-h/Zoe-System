/**
 * ⛔ **oracle របស់តេស្ត parity តែប៉ុណ្ណោះ** — builder HTML ដើមនៃជួរដេកប្រវត្តិ (រត់លើផលិតកម្មជាង ២០០ ជុំ audit)។
 *    App គូរជួរដោយ `HistoryRow` (JSX) ពី `buildHistoryRowModel()` ➜ function នេះ **មិនចូលផលិតកម្ម** ទៀតទេ
 *    ហើយរស់នៅទីនេះដើម្បីឲ្យ `history-row-parity.test.tsx` វាស់ JSX ធៀបនឹងវាលើទិន្នន័យចៃដន្យ។
 */
import { dataState } from '../../src/core/state';
import { formatScanStamp } from '../../src/core/timezone';
import { sanitizeInput } from '../../src/domain/barcode';

export function buildHistoryRowHtml(item, rowNum, isOld, needsRecall) {
        let phoneDisplay = item.phone === "គ្មានលេខ" ? `<span style="color:#ef4444; font-style:italic;">គ្មានលេខ</span>` : `<span class="phone-clickable" data-act="openCallMarkModal" data-a1="${sanitizeInput(item.id)}" title="ចុចដើម្បីសម្គាល់ការខល">${sanitizeInput(item.phone)}</span>`;

        let rowNumClass = '';
        let rowNumLabel = '';
        if (item.callMark === 'no-answer') { rowNumClass = 'row-num-no-answer'; rowNumLabel = 'ខល អត់លើក'; }
        else if (item.callMark === 'no-connect') { rowNumClass = 'row-num-no-connect'; rowNumLabel = 'ខល អត់ចូល'; }
        else if (item.callMark === 'wrong-number') { rowNumClass = 'row-num-wrong-number'; rowNumLabel = 'ខុសលេខ'; }

        let lockerLoc: any = "N/A";
        if (item.barcodes && Array.isArray(item.barcodes) && item.barcodes.length > 0) {
            let allLockers = item.barcodes.map(b => b.locker || "N/A").filter(l => l && l !== "N/A");
            let uniqueLockers = [...new Set(allLockers)];

            if (uniqueLockers.length > 1) {
                lockerLoc = `${uniqueLockers.join(', ')} (${uniqueLockers.length} កន្លែង)`;
            } else if (uniqueLockers.length === 1) {
                lockerLoc = uniqueLockers[0];
            } else {
                lockerLoc = item.locker || "N/A";
            }
        } else {
            lockerLoc = item.locker || "N/A";
        }

        let callAction = '';
        if (item.phone !== "គ្មានលេខ") {
            if (item.callMark === 'wrong-number') {
                callAction = `<button class="btn-sm fix-phone-btn btn-primary-action" data-act="openEditModal" data-a1="${sanitizeInput(item.id)}" title="លេខខុស — សូមកែលេខថ្មី">✏️ កែលេខ</button>`;
            } else if (item.isCalled && !needsRecall) {
                callAction = `<a href="tel:${sanitizeInput(item.phone)}" data-act="handleCallAction" data-a1="${sanitizeInput(item.id)}" class="btn-sm called-btn btn-primary-action">✔️ ខល</a>`;
            } else {
                let recallClass = needsRecall ? ' call-btn-recall' : '';
                callAction = `<a href="tel:${sanitizeInput(item.phone)}" data-act="handleCallAction" data-a1="${sanitizeInput(item.id)}" class="btn-sm call-btn btn-primary-action${recallClass}" title="${needsRecall ? 'សូមខលម្ដងទៀត' : ''}">📞 ខល</a>`;
            }
        }

        let closeBtnText = item.isClosed ? "❌ បើក" : "✅ បិទ";
        let closeBtnClass = item.isClosed ? 'is-reopen-action' : 'is-close-action';
        let closeAction = `<button class="btn-sm close-btn btn-primary-action ${closeBtnClass}" data-act="toggleCloseStatus" data-a1="${sanitizeInput(item.id)}">${closeBtnText}</button>`;

        let moreDropdown = `
                <div class="more-dropdown row-more-corner">
                    <button class="more-btn" data-act="toggleMoreDropdown" data-self="1" data-evt="1" data-a1="${sanitizeInput(item.id)}" title="ជម្រើសបន្ថែម">⋮</button>
                </div>
            `;

        let ageBadge = isOld
            ? `<span style="background:#fef3c7; color:#b45309; padding:2px 5px; border-radius:4px; font-size:calc(9 * var(--fs-unit)); font-weight:600;">ចាស់</span>`
            : `<span style="background:var(--success-light); color:var(--success); padding:2px 5px; border-radius:4px; font-size:calc(9 * var(--fs-unit)); font-weight:600;">ថ្មី</span>`;

        let statusBadge = item.isClosed ? `<span class="closed-badge">យកហើយ</span>` : ageBadge;
        let calledBadge = item.isCalled ? `<span class="called-badge">ខល</span>` : "";
        let scanTimeDisplay = item.time ? `<span class="scan-time-tag">${sanitizeInput(formatScanStamp(item.time))}</span>` : "";

        let totalPackageCount = item.barcodes && Array.isArray(item.barcodes) ? item.barcodes.length : (parseFloat(item.count) || 1);
        let viewListBtn = `<button class="btn-view-list" data-act="openViewListModal" data-a1="${sanitizeInput(item.id)}">📦 បញ្ជី (${totalPackageCount})</button>`;

        let activeCod = 0;
        let activeDod = 0;
        let activeCount = parseFloat(item.count) || 1;

        if (item.barcodes && Array.isArray(item.barcodes)) {
            activeCod = item.barcodes.filter(b => !b.isClosed).reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0);
            activeDod = item.barcodes.filter(b => !b.isClosed).reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0);
            activeCount = item.barcodes.filter(b => !b.isClosed).length;
        } else {
            activeCod = !item.isClosed ? (parseFloat(item.cod) || 0) : 0;
            activeDod = !item.isClosed ? (parseFloat(item.dod) || 0) : 0;
            activeCount = !item.isClosed ? (parseFloat(item.count) || 1) : 0;
        }

        activeCod = Math.round(activeCod * 100) / 100;
        activeDod = Math.round(activeDod * 100) / 100;

        let priceDisplayHtml = '';
        let hasCod = activeCod > 0;
        let hasDod = activeDod > 0;

        if (hasCod && hasDod) {
            let codRiel = Math.round(activeCod * dataState.exchangeRateRiel);
            let dodRiel = Math.round(activeDod * dataState.exchangeRateRiel);
            let bothTotal = Math.round((activeCod + activeDod) * 100) / 100;
            let bothRiel = codRiel + dodRiel;
            priceDisplayHtml = `
                    <div class="money-pending" style="font-size: calc(10 * var(--fs-unit));">COD: <strong>$${activeCod.toFixed(2)}</strong> (${codRiel.toLocaleString()} ៛)</div>
                    <div class="money-pending kind-dod" style="font-size: calc(10 * var(--fs-unit)); margin-top:2px;">DOD: <strong>$${activeDod.toFixed(2)}</strong> (${dodRiel.toLocaleString()} ៛)</div>
                    <div class="price-sum-line money-pending">សរុប: <strong>$${bothTotal.toFixed(2)}</strong> (${bothRiel.toLocaleString()} ៛)</div>
                `;
        } else if (hasCod) {
            let codRiel = Math.round(activeCod * dataState.exchangeRateRiel);
            priceDisplayHtml = `
                    <div class="money-pending" style="font-size: calc(10.5 * var(--fs-unit));">COD: <strong>$${activeCod.toFixed(2)}</strong></div>
                    <div class="money-pending" style="font-size: calc(9.5 * var(--fs-unit));">${codRiel.toLocaleString()} ៛</div>
                `;
        } else if (hasDod) {
            let dodRiel = Math.round(activeDod * dataState.exchangeRateRiel);
            priceDisplayHtml = `
                    <div class="money-pending kind-dod" style="font-size: calc(10.5 * var(--fs-unit));">DOD: <strong>$${activeDod.toFixed(2)}</strong></div>
                    <div class="money-pending" style="font-size: calc(9.5 * var(--fs-unit));">${dodRiel.toLocaleString()} ៛</div>
                `;
        } else {
            priceDisplayHtml = `
                    <div style="font-size: calc(10.5 * var(--fs-unit)); color: var(--text-muted);">0.00 $ (0 ៛)</div>
                `;
        }

        const html = `
                <td style="text-align: center;">${rowNumClass ? `<span class="row-num-mark ${rowNumClass}" title="${rowNumLabel}">${rowNum}</span>` : rowNum}</td>
                <td>
                    <div class="customer-info-stack">
                        <div class="cust-badge-line">
                            ${calledBadge}${statusBadge}
                        </div>
                        <div class="phone-title">
                            ${phoneDisplay}
                        </div>
                        <div>
                            ${viewListBtn}
                        </div>
                        ${scanTimeDisplay}
                    </div>
                </td>
                <td class="col-price">
                    <div class="price-stack">
                        <span class="locker-badge">ទីតាំង: ${sanitizeInput(lockerLoc)}</span>
                        <div class="price-figures">${priceDisplayHtml}</div>
                        <span class="count-badge">កញ្ចប់សរុប: ${activeCount}</span>
                    </div>
                </td>
                <td class="action-cell">
                    ${moreDropdown}
                    <div class="action-group">
                        ${callAction}${closeAction}
                    </div>
                </td>
            `;
        return { isClosedRow: !!item.isClosed, html: html };
}
