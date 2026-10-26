import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const guard = readFileSync(resolve('../audit-tools/doc-scope-test.js'), 'utf8');
const start = guard.indexOf('// --- គ. ជួរ');
const end = guard.indexOf('// --- ឃ.', start);
function count(uiApp: string) {
    return runInNewContext(guard.slice(start, end) + '\nhealthRowCount;', { uiApp, require }, { timeout: 2000 });
}
function fixture(mutation = 'rows.push(lookupRow);', wrapper = true) {
    return `${wrapper ? 'function runHealthCheck(force = false) { return runHealthCheckRound({force}).finally(() => {}); }' : ''}
    async function ${wrapper ? 'runHealthCheckRound(task)' : 'runHealthCheck(force = false)'} {
        uiState.healthRows = [healthPendingRow()];
        try {
            const [databaseRow, licenseRow, lookupRow, offlineRow] = await Promise.all([healthDatabaseLiveRow(), healthLicenseRow(), healthLookupRow(), healthServiceWorkerLiveRow()]);
            const rows = [healthNetworkRow(true), healthClockRow(), healthStorageRow(), healthServiceWorkerRow(), healthCustomerTableRow(), healthSheetScriptRow()];
            rows[3] = worker ? offlineRow : healthServiceWorkerRow();
            const currentDatabase = healthDatabaseRow();
            rows.splice(1, 0, healthDatabaseWriteRow() || databaseRow);
            rows.splice(3, 0, licenseRow);
            ${mutation}
            if (stale) return;
            uiState.healthRows = rows;
        } catch (error) { uiState.healthRows = [healthRow('warn', 'failed', error)]; }
    }`;
}

describe('ចំនួនជួរសុខភាពពី checker ពិត', () => {
    it('wrapper និង async entrypoint រាប់ជួរដែលគូរ មិនមែនឈ្មោះ helper', () => {
        expect(count(fixture())).toBe(9);
        expect(count(fixture(undefined, false))).toBe(9);
    });
    it('ចំនួនតាម push និង splice ពិត', () => {
        expect(count(fixture('rows.push(lookupRow, lookupRow);'))).toBe(10);
        expect(count(fixture('rows.splice(0, 2, lookupRow);'))).toBe(7);
        expect(count(fixture(''))).toBe(8);
    });
    it('regular និង arrow entrypoint ហៅ helper មាន arguments', () => {
        const source = 'const runHealthCheck = (force) => round(force); function round(force) { uiState.healthRows = [row(force), row(false), row(true)]; }';
        expect(count(source)).toBe(3);
        expect(count(source.replace('const runHealthCheck = (force) => round(force);', 'function runHealthCheck(force) { return round(force); }'))).toBe(3);
    });
    it('splice ប្រើ index អវិជ្ជមាន និងកាត់តាមចំនួនពិត', () => {
        expect(count(fixture('rows.splice(-1, 50, lookupRow);'))).toBe(8);
        expect(count(fixture('rows.splice(50, 2, lookupRow);'))).toBe(9);
    });
    it('ឈ្មោះ helper ក្នុង scope ផ្សេងមិនប៉ះ inventory', () => {
        expect(count(fixture() + ' function other() { function current() {} } function another() { function current() {} }')).toBe(9);
    });
    it('arguments និង helper ដដែលមិនបន្ថយចំនួនជួរ', () => {
        expect(count(fixture().replace('healthClockRow()', 'healthNetworkRow(false)'))).toBe(9);
    });
    it('អត្ថបទ និងការហៅ helper ដែលមិនមែនជួរមិនបន្ថែមចំនួន', () => {
        expect(count(fixture('healthUnrelatedRow(); const text = "rows.push(fake); healthExtraRow()"; /* rows.push(fake); */ rows.push(lookupRow);'))).toBe(9);
    });
    it('វាស់ source ពិតក្រោយបម្លែង TypeScript', () => {
        const source = readFileSync(resolve('src/features/health-check.ts'), 'utf8');
        expect(count(transformSync(source, { loader: 'ts', format: 'esm' }).code)).toBe(9);
    });
    it.each([
        '', 'function runHealthCheck( {', 'function other() { uiState.healthRows = [row()]; }',
        fixture('rows.push(...dynamicRows);'), fixture('rows.splice(position, amount, lookupRow);'),
        fixture('if (enabled) rows.push(lookupRow);'), fixture('for (const row of dynamicRows) rows.push(row);'),
        fixture('mutate(rows);'), fixture('const alias = rows; alias.push(lookupRow);'), fixture('rows = externalRows;'),
        fixture('rows.pop();'), fixture('rows.splice(0);'), fixture('rows[99] = lookupRow;'),
        fixture().replace('uiState.healthRows = rows;', 'uiState.healthRows = dynamicRows;'),
        fixture().replace('uiState.healthRows = rows;', 'uiState.healthRows = rows; uiState.healthRows = [row()];'), fixture('rows.length = external;'), fixture('rows[index] = lookupRow;'),
        fixture().replace('const rows = [healthNetworkRow(true),', 'const rows = [...dynamicRows, healthNetworkRow(true),'),
    ])('រាងបាត់ ខូច ឬចំនួនមិនច្បាស់ត្រូវបរាជ័យ %#', (source) => {
        expect(count(source)).toBeNull();
    });
});
