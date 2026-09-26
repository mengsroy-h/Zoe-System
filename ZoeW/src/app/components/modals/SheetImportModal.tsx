import { Modal } from './Modal';
import { viewState } from '../../../core/view-state';
import { act, onAct } from '../../actions';
import { useStoreFields } from '../../hooks/useStore';
import { refTo, refWithNative } from '../../refs';
import { sheetDropEnter, sheetDropFile, sheetDropLeave } from '../../behaviors/sheet-drop';
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

const headerRowRef = refWithNative('siHeaderRowInput', 'change', () => act('applySheetImportHeaderRow'));

export function SheetImportModal() {
    const v = useStoreFields(viewState, ['siParts', 'siStatusFoot', 'siConfigSaving', 'siImportBtnDisabled', 'siImportBtnText',
        'siClearBtnBusy', 'siDropHot']);
    const part = (base: string, id: string) => (v.siParts[id] ? base : (base ? base + ' hidden' : 'hidden'));
    return (
        <Modal id="sheetImportModal" close="closeSheetImportModal">
            <div className="modal-content si-modal-content">
                <h3>📥 នាំចូល Excel ទៅ Sheet</h3>
                <p>អាន .xlsx · .xls · .csv ពីឧបករណ៍ រួចសរសេរចូល Google Sheet ដដែលដែល «API ស្វែងរកអតិថិជន» ទាញយក។</p>
                <div className="si-scroll">
                    <section className="si-card" id="siConfigCard">
                        <h4 className="si-card-title">
                            <span className="si-step">1</span>
                            {' '}ការតភ្ជាប់
                        </h4>
                        <div id="siConfigSummary" className={part('si-summary', 'siConfigSummary')}>
                            <SiConfigSummary />
                        </div>
                        <div id="siConfigForm" className={v.siParts.siConfigForm ? undefined : 'hidden'}>
                            <label className="si-label" htmlFor="siApiUrlInput">Web app URL របស់ Apps Script</label>
                            <input
                                type="url"
                                id="siApiUrlInput"
                                ref={refTo('siApiUrlInput')}
                                placeholder="https://script.google.com/macros/s/.../exec"
                                autoComplete="off"
                                spellCheck="false"
                            />
                            <label className="si-label" htmlFor="siApiPasswordInput">ពាក្យសម្ងាត់នាំចូល (IMPORT_PASSWORD)</label>
                            <input type="password" id="siApiPasswordInput" ref={refTo('siApiPasswordInput')} autoComplete="off" />
                            <div className="modal-btns">
                                <button
                                    type="button"
                                    className="btn-confirm"
                                    id="siConfigSaveBtn"
                                    disabled={v.siConfigSaving}
                                    onClick={onAct("saveSheetImportConfig")}
                                >
                                    សាកល្បង និងរក្សាទុក
                                </button>
                            </div>
                        </div>
                        <div className={part('modal-btns', 'siConfigEditRow')} id="siConfigEditRow">
                            <button type="button" className="btn-cancel" onClick={onAct("editSheetImportConfig")}>កែការតភ្ជាប់</button>
                        </div>
                        <div id="siConfigMsg" className="si-msg-host">
                            <SiConfigMsg />
                        </div>
                    </section>
                    <section className={part('si-card', 'siFileCard')} id="siFileCard">
                        <h4 className="si-card-title">
                            <span className="si-step">2</span>
                            {' '}ជ្រើសឯកសារ
                        </h4>
                        <button type="button" className={v.siDropHot ? 'si-drop si-drop-hot' : 'si-drop'} id="siDrop" onClick={onAct("pickSheetImportFile")}
                            onDragEnter={sheetDropEnter} onDragOver={sheetDropEnter} onDragLeave={sheetDropLeave} onDrop={sheetDropFile}>
                            <strong>ចុចដើម្បីជ្រើសឯកសារ</strong>
                            <span>ឬទម្លាក់ឯកសារនៅទីនេះ — .xlsx · .xls · .csv</span>
                        </button>
                        <input
                            type="file"
                            id="siFileInput"
                            ref={refTo('siFileInput')}
                            className="hidden"
                            accept=".xlsx,.xls,.csv,.tsv"
                            onChange={onAct("handleSheetImportFileInput", { self: true })}
                        />
                        <div id="siFileMsg" className="si-msg-host">
                            <SiFileMsg />
                        </div>
                    </section>
                    <section className={part('si-card', 'siMapCard')} id="siMapCard">
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
                                    ref={headerRowRef}
                                    min={1}
                                    defaultValue="1"
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
                        <div className={part('table-responsive si-preview', 'siPreviewWrap')} id="siPreviewWrap">
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
                    <section className={part('si-card', 'siActionCard')} id="siActionCard">
                        <h4 className="si-card-title">
                            <span className="si-step">4</span>
                            {' '}នាំចូល
                        </h4>
                        <label className="si-label" htmlFor="siModeSel">របៀបនាំចូល</label>
                        <select id="siModeSel" ref={refTo('siModeSel')}>
                            <option value="replace">សម្អាតទិន្នន័យចាស់ រួចដាក់ថ្មីជំនួស (សម្រាប់ប្រើប្រចាំថ្ងៃ)</option>
                            <option value="upsert">បន្ថែមថ្មី + កែអ្វីដែលប្រែ</option>
                            <option value="newOnly">បន្ថែមតែ Barcode ថ្មី — មិនប៉ះជួរចាស់</option>
                        </select>
                        <div className="modal-btns">
                            <div className="modal-btns-row">
                                <button type="button" className="btn-confirm" id="siImportBtn" disabled={v.siImportBtnDisabled} onClick={onAct("runSheetImport")}>{v.siImportBtnText}</button>
                                <button type="button" className="btn-cancel" onClick={onAct("resetSheetImportFileSelection")}>ជ្រើសឯកសារផ្សេង</button>
                            </div>
                        </div>
                        <div id="siActionMsg" className="si-msg-host">
                            <SiActionMsg />
                        </div>
                    </section>
                    <section className={part('si-card si-card-danger', 'siClearCard')} id="siClearCard">
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
                                disabled={v.siClearBtnBusy}
                                onClick={onAct("runSheetImportClear")}
                            >
                                {v.siClearBtnBusy ? 'កំពុងសម្អាត...' : 'សម្អាតទិន្នន័យក្នុង Sheet'}
                            </button>
                        </div>
                        <div id="siClearMsg" className="si-msg-host">
                            <SiClearMsg />
                        </div>
                    </section>
                    <p className="si-foot" id="siStatusFoot">{v.siStatusFoot}</p>
                </div>
                <div className="modal-btns">
                    <button type="button" className="btn-cancel" onClick={onAct("closeSheetImportModal")}>បិទ</button>
                </div>
            </div>
        </Modal>
    );
}
