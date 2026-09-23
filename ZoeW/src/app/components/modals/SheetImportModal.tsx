import { onAct } from '../../actions';
import { SiConfigSummary } from '../sheet/SheetImportParts';
import { SiConfigMsg } from '../sheet/SheetImportParts';
import { SiFileMsg } from '../sheet/SheetImportParts';
import { SiSheetSelect } from '../sheet/SheetImportSelects';
import { SiMapBarcode } from '../sheet/SheetImportSelects';
import { SiMapDod } from '../sheet/SheetImportSelects';
import { SiMapCod } from '../sheet/SheetImportSelects';
import { SiMapPhone } from '../sheet/SheetImportSelects';
import { SiMapMsg } from '../sheet/SheetImportParts';
import { SiChips } from '../sheet/SheetImportParts';
import { SiPreviewBody } from '../sheet/SheetImportParts';
import { SiActionMsg } from '../sheet/SheetImportParts';
import { SiClearMsg } from '../sheet/SheetImportParts';

export function SheetImportModal() {
    return (
        <div id="sheetImportModal" className="modal" data-close="closeSheetImportModal">
            <div className="modal-content si-modal-content">
                <h3>📥 នាំចូល Excel ទៅ Sheet</h3>
                <p>អាន .xlsx · .xls · .csv ពីឧបករណ៍ រួចសរសេរចូល Google Sheet ដដែលដែល «API ស្វែងរកអតិថិជន» ទាញយក។</p>
                <div className="si-scroll">
                    <section className="si-card" id="siConfigCard">
                        <h4 className="si-card-title">
                            <span className="si-step">1</span>
                            {' '}ការតភ្ជាប់
                        </h4>
                        <div id="siConfigSummary" className="si-summary hidden">
                            <SiConfigSummary />
                        </div>
                        <div id="siConfigForm">
                            <label className="si-label" htmlFor="siApiUrlInput">Web app URL របស់ Apps Script</label>
                            <input
                                type="url"
                                id="siApiUrlInput"
                                placeholder="https://script.google.com/macros/s/.../exec"
                                autoComplete="off"
                                spellCheck="false"
                            />
                            <label className="si-label" htmlFor="siApiPasswordInput">ពាក្យសម្ងាត់នាំចូល (IMPORT_PASSWORD)</label>
                            <input type="password" id="siApiPasswordInput" autoComplete="off" />
                            <div className="modal-btns">
                                <button
                                    type="button"
                                    className="btn-confirm"
                                    id="siConfigSaveBtn"
                                    onClick={onAct("saveSheetImportConfig")}
                                >
                                    សាកល្បង និងរក្សាទុក
                                </button>
                            </div>
                        </div>
                        <div className="modal-btns hidden" id="siConfigEditRow">
                            <button type="button" className="btn-cancel" onClick={onAct("editSheetImportConfig")}>កែការតភ្ជាប់</button>
                        </div>
                        <div id="siConfigMsg" className="si-msg-host">
                            <SiConfigMsg />
                        </div>
                    </section>
                    <section className="si-card hidden" id="siFileCard">
                        <h4 className="si-card-title">
                            <span className="si-step">2</span>
                            {' '}ជ្រើសឯកសារ
                        </h4>
                        <button type="button" className="si-drop" id="siDrop" onClick={onAct("pickSheetImportFile")}>
                            <strong>ចុចដើម្បីជ្រើសឯកសារ</strong>
                            <span>ឬទម្លាក់ឯកសារនៅទីនេះ — .xlsx · .xls · .csv</span>
                        </button>
                        <input
                            type="file"
                            id="siFileInput"
                            className="hidden"
                            accept=".xlsx,.xls,.csv,.tsv"
                            onChange={onAct("handleSheetImportFileInput", { self: true })}
                        />
                        <div id="siFileMsg" className="si-msg-host">
                            <SiFileMsg />
                        </div>
                    </section>
                    <section className="si-card hidden" id="siMapCard">
                        <h4 className="si-card-title">
                            <span className="si-step">3</span>
                            {' '}ការផ្គូផ្គង Column
                        </h4>
                        <div className="si-grid">
                            <div className="si-field">
                                <label className="si-label" htmlFor="siSheetSel">Tab ក្នុងឯកសារ</label>
                                <SiSheetSelect />
                            </div>
                            <div className="si-field">
                                <label className="si-label" htmlFor="siHeaderRowInput">ជួរដេក header</label>
                                <input
                                    type="number"
                                    id="siHeaderRowInput"
                                    min={1}
                                    value="1"
                                    onChange={onAct("applySheetImportHeaderRow")}
                                />
                            </div>
                            <div className="si-field">
                                <label className="si-label" htmlFor="siMapBarcode">A · Barcode</label>
                                <SiMapBarcode />
                            </div>
                            <div className="si-field">
                                <label className="si-label" htmlFor="siMapDod">B · DOD($)</label>
                                <SiMapDod />
                            </div>
                            <div className="si-field">
                                <label className="si-label" htmlFor="siMapCod">C · COD($)</label>
                                <SiMapCod />
                            </div>
                            <div className="si-field">
                                <label className="si-label" htmlFor="siMapPhone">D · Phone</label>
                                <SiMapPhone />
                            </div>
                        </div>
                        <div id="siMapMsg" className="si-msg-host">
                            <SiMapMsg />
                        </div>
                        <div className="si-chips" id="siChips">
                            <SiChips />
                        </div>
                        <div className="table-responsive si-preview hidden" id="siPreviewWrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Barcode</th>
                                        <th>DOD($)</th>
                                        <th>COD($)</th>
                                        <th>Phone</th>
                                    </tr>
                                </thead>
                                <tbody id="siPreviewBody">
                                    <SiPreviewBody />
                                </tbody>
                            </table>
                        </div>
                    </section>
                    <section className="si-card hidden" id="siActionCard">
                        <h4 className="si-card-title">
                            <span className="si-step">4</span>
                            {' '}នាំចូល
                        </h4>
                        <label className="si-label" htmlFor="siModeSel">របៀបនាំចូល</label>
                        <select id="siModeSel">
                            <option value="replace">សម្អាតទិន្នន័យចាស់ រួចដាក់ថ្មីជំនួស (សម្រាប់ប្រើប្រចាំថ្ងៃ)</option>
                            <option value="upsert">បន្ថែមថ្មី + កែអ្វីដែលប្រែ</option>
                            <option value="newOnly">បន្ថែមតែ Barcode ថ្មី — មិនប៉ះជួរចាស់</option>
                        </select>
                        <div className="modal-btns">
                            <div className="modal-btns-row">
                                <button type="button" className="btn-confirm" id="siImportBtn" onClick={onAct("runSheetImport")}>នាំចូលទៅ Sheet</button>
                                <button type="button" className="btn-cancel" onClick={onAct("resetSheetImportFileSelection")}>ជ្រើសឯកសារផ្សេង</button>
                            </div>
                        </div>
                        <div id="siActionMsg" className="si-msg-host">
                            <SiActionMsg />
                        </div>
                    </section>
                    <section className="si-card si-card-danger hidden" id="siClearCard">
                        <h4 className="si-card-title">
                            <span className="si-step si-step-warn">🗑️</span>
                            {' '}សម្អាតទិន្នន័យចាស់
                        </h4>
                        <p className="si-hint">
                            លុប{' '}
                            <strong>គ្រប់ជួរដេក</strong>
                            {' '}ក្នុង Sheet ដោយទុកតែជួរ header។ ប្រើពេលចង់ចាប់ផ្តើមថ្ងៃថ្មីពីទទេ ដោយមិនទាន់នាំចូលឯកសារភ្លាម។
                        </p>
                        <div className="modal-btns">
                            <button
                                type="button"
                                className="si-btn-danger"
                                id="siClearBtn"
                                onClick={onAct("runSheetImportClear")}
                            >
                                សម្អាតទិន្នន័យក្នុង Sheet
                            </button>
                        </div>
                        <div id="siClearMsg" className="si-msg-host">
                            <SiClearMsg />
                        </div>
                    </section>
                    <p className="si-foot" id="siStatusFoot"></p>
                </div>
                <div className="modal-btns">
                    <button type="button" className="btn-cancel" onClick={onAct("closeSheetImportModal")}>បិទ</button>
                </div>
            </div>
        </div>
    );
}
