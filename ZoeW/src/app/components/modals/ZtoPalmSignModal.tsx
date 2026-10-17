import { startPalmSignCamera } from '../../../services/palm-sign-camera';
import { useEffect, useState } from 'react';
import { palmSignState, type PalmSignResult } from '../../../core/palm-sign-state';
import { scanState, uiState } from '../../../core/state';
import { noteAppLockExcuse } from '../../../features/app-lock';
import { acceptPalmSignBarcode, advancePalmSignStage, cancelPalmSignConfirmation, confirmPalmSignWarning, checkZtoPalmSignStages, palmSignWantsFrame, recheckZtoPalmSign, setPalmSignName, setPalmSignSelected, submitZtoPalmSign } from '../../../features/zto-palm-sign';
import { createScratchCanvas, loadScratchImage } from '../../../platform/document-io';
import { decodeBarcodeFromCanvasManual } from '../../../services/scan-engine';
import { withTimeout } from '../../../services/network';
import { closeModal } from '../../../ui/modal';
import { useStoreFields, useStoreValue } from '../../hooks/useStore';
import { Modal } from './Modal';
import { openFilePicker, refTo, setFieldValue } from '../../refs';

async function preparePhoto(file: File) {
    if (!file.type.startsWith('image/') || file.size > 20000000) throw new Error('image');
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => loadScratchImage(url, resolve, reject));
        const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = createScratchCanvas();
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const context = canvas.getContext('2d');
        if (!context || !canvas.width || !canvas.height) throw new Error('canvas');
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        let data = canvas.toDataURL('image/jpeg', 0.82);
        if (data.length > 1200000) data = canvas.toDataURL('image/jpeg', 0.6);
        if (data.length > 1200000 || !data.startsWith('data:image/jpeg;base64,')) throw new Error('size');
        let barcode = '';
        try {
            if (scanState.nativeDetector) barcode = (await withTimeout(scanState.nativeDetector.detect(canvas), 3000, 'Palm photo scan timed out'))[0]?.rawValue || '';
            if (!barcode && scanState.codeReader) barcode = await withTimeout(decodeBarcodeFromCanvasManual(scanState.codeReader, canvas), 3000, 'Palm photo scan timed out') || '';
        } catch {}
        return { data, barcode };
    } finally { URL.revokeObjectURL(url); }
}

const STAGE_TITLES = { dispatch: '១. ការស្កេនពេលចែកចាយទំនិញ', receipt: '២. ការស្កេនពេលទទួលទំនិញ' };
const STAGE_HINTS = {
    dispatch: 'ដាក់ Barcode មុខកាមេរ៉ា។ រូបភាពត្រូវបានចាប់ស្វ័យប្រវត្តិពេលស្កេនបាន រួចចុច «⬆ ផ្ញើបញ្ជី»។',
    receipt: 'វាយឈ្មោះអតិថិជន រួចស្កេន Barcode ម្ដងទៀត ដើម្បីចាប់រូបថ្មី ហើយចុច «⬆ ផ្ញើបញ្ជី»។'
};

function codeTone(result: PalmSignResult | undefined, photo: boolean, confirming: boolean) {
    if (!result) return photo ? 'is-ready' : 'is-wait';
    if (result.state === 'dispatched' || result.state === 'signed') return result.saved === false ? 'is-warn' : 'is-ok';
    return result.state === 'unknown' || confirming ? 'is-warn' : 'is-error';
}

function SignForm() {
    const v = useStoreFields(palmSignState, ['codes', 'selectedCodes', 'busy', 'message', 'results', 'dispatchResults', 'stage', 'photos', 'checking', 'checked', 'signMan', 'confirmation', 'warnings', 'problemScans']);
    const [barcode, setBarcode] = useState('');
    const [message, setMessage] = useState('');
    const [preparing, setPreparing] = useState(false);
    const [cameraEpoch, setCameraEpoch] = useState(0);
    const results = v.stage === 'dispatch' ? v.dispatchResults : v.results;
    const available = v.stage === 'dispatch' ? v.codes : v.codes.filter((code) => v.dispatchResults.some((r) => r.code === code && r.state === 'dispatched' && r.proof) || v.results.some((r) => r.code === code && r.state === 'signed'));
    const allReceived = v.codes.length > 0 && v.codes.every((code) => v.results.some((r) => r.code === code && r.state === 'signed'));
    const disabled = v.busy || v.checking || preparing || !!v.confirmation;
    const needsName = v.stage === 'receipt' && !allReceived && !v.signMan.trim();
    const canScan = !disabled && v.codes.some((code) => v.checked[code]) && !allReceived && !needsName;
    const canAdvance = v.stage === 'dispatch' && v.codes.length > 0
        && v.codes.every((code) => v.dispatchResults.some((r) => r.code === code && r.state === 'dispatched' && r.proof) || v.results.some((r) => r.code === code && r.state === 'signed'));
    const sendable = v.selectedCodes.filter((code) => v.photos[code] && !results.some((r) => r.code === code && r.state !== 'failed'));
    const captured = available.filter((code) => v.photos[code]).length;
    const idle = v.checking ? 'កំពុងពិនិត្យស្ថានភាព ZTO…' : v.busy ? 'កំពុងផ្ញើទៅ ZTO…' : preparing ? 'កំពុងរៀបចំរូបភាព…' : v.confirmation ? 'រង់ចាំការបញ្ជាក់កញ្ចប់'
        : allReceived ? '✅ ZTO បញ្ជាក់ការទទួលរួចហើយ' : needsName ? '👤 វាយឈ្មោះអតិថិជនជាមុន ដើម្បីបើកកាមេរ៉ា' : 'កាមេរ៉ាផ្អាក';
    useEffect(() => {
        if (!canScan) return;
        return startPalmSignCamera((code, photo) => acceptPalmSignBarcode(code, photo),
            () => setMessage('បើកកាមេរ៉ាមិនបាន។ សូមអនុញ្ញាតកាមេរ៉ា ឬជ្រើសរូបពី Gallery។'), palmSignWantsFrame);
    }, [v.stage, cameraEpoch, canScan]);
    const addBarcode = (raw: string) => { acceptPalmSignBarcode(raw); setBarcode(''); };
    const takePhoto = async (file: File) => {
        const generation = palmSignState.generation;
        const stage = palmSignState.stage;
        const manualCode = barcode.trim();
        setPreparing(true);
        try {
            const prepared = await preparePhoto(file);
            if (generation !== palmSignState.generation || stage !== palmSignState.stage) return;
            const code = prepared.barcode || manualCode;
            if (!code) { setMessage('រូបនេះមិនអាន Barcode បាន។ សូមវាយ Barcode រួចជ្រើសរូប ឬថតរូបម្ដងទៀត។'); return; }
            acceptPalmSignBarcode(code, prepared.data.split(',')[1], true);
            setBarcode('');
        } catch { setMessage('បើករូបភាពមិនបាន។ សូមថតរូបម្ដងទៀត។'); }
        finally { setPreparing(false); }
    };
    return (
        <div className="modal-content palm-sign-content">
            <h3>✍️ Sign · ZTO Palm</h3>
            <ol className="palm-sign-steps" aria-label="ជំហាន Sign">
                <li className={v.stage === 'dispatch' ? 'is-active' : 'is-done'} aria-current={v.stage === 'dispatch' ? 'step' : undefined}>
                    <span className="palm-sign-step-no">{v.stage === 'dispatch' ? '១' : '✓'}</span>ចែកចាយ</li>
                <li className={v.stage === 'receipt' ? (allReceived ? 'is-done' : 'is-active') : undefined} aria-current={v.stage === 'receipt' ? 'step' : undefined}>
                    <span className="palm-sign-step-no">{allReceived ? '✓' : '២'}</span>ទទួល</li>
            </ol>
            <h4 className="palm-sign-stage">{STAGE_TITLES[v.stage]}</h4>
            <p className="palm-sign-hint">{STAGE_HINTS[v.stage]}</p>
            {v.stage === 'receipt' && !allReceived ? <div className="palm-sign-name">
                <label htmlFor="palmSignName">👤 ឈ្មោះអតិថិជន (អ្នកទទួល)</label>
                <input id="palmSignName" value={v.signMan} onChange={(event) => setPalmSignName(event.target.value)} maxLength={120} required placeholder="វាយឈ្មោះអ្នកទទួល"
                    disabled={disabled || v.results.some((r) => r.state !== 'failed')} autoComplete="off" />
            </div> : null}
            <div className="palm-sign-camera">
                <video id="palmSignVideo" ref={refTo('palmSignVideo')} autoPlay playsInline muted className="palm-sign-video" />
                {canScan ? <span className="palm-sign-frame" aria-hidden="true" /> : <span className="palm-sign-camera-idle">{idle}</span>}
                {canScan ? <button type="button" className="palm-sign-camera-retry" onClick={() => setCameraEpoch((value) => value + 1)}>🔄 បើកកាមេរ៉ាឡើងវិញ</button> : null}
            </div>
            {preparing || message || v.message ? <div className="palm-sign-status">
                {preparing || message ? <p role="status" aria-live="polite">{preparing ? 'កំពុងរៀបចំរូបភាព…' : message}</p> : null}
                {v.message ? <p role="status" aria-live="polite">{v.message}</p> : null}
            </div> : null}
            {v.confirmation ? <section className="palm-sign-confirmation" role="alertdialog" aria-labelledby="palmSignWarningTitle" aria-describedby="palmSignWarningMessage">
                <h4 id="palmSignWarningTitle">⚠️ បញ្ជាក់កញ្ចប់ · {v.confirmation.code}</h4>
                <p id="palmSignWarningMessage">{v.confirmation.message}</p>
                <div className="modal-btns">
                    <button type="button" className="btn-cancel" autoFocus disabled={v.busy} onClick={cancelPalmSignConfirmation}>បោះបង់</button>
                    <button type="button" className="btn-confirm" disabled={v.busy} onClick={() => void confirmPalmSignWarning()}>បញ្ជាក់ និងបន្ត</button>
                </div>
            </section> : null}
            {v.codes.some((code) => !v.checked[code])
                ? <button type="button" className="palm-sign-soft palm-sign-wide" disabled={disabled} onClick={() => void checkZtoPalmSignStages()}>🔄 ពិនិត្យស្ថានភាព ZTO ម្ដងទៀត</button> : null}
            {available.length ? <div className="palm-sign-list-head"><span>📦 កញ្ចប់ {available.length}</span><span>📷 {captured}/{available.length} បានចាប់រូប</span></div> : null}
            <div className="palm-sign-codes">
                {available.map((code) => {
                    const result = results.find((row) => row.code === code);
                    const tone = codeTone(result, !!v.photos[code], v.confirmation?.code === code);
                    return <label key={code} className={'palm-sign-code' + (v.selectedCodes.includes(code) ? ' is-selected' : '')}>
                        <input type="checkbox" checked={v.selectedCodes.includes(code)} disabled={disabled || !v.photos[code]}
                            onChange={(event) => setPalmSignSelected(code, event.target.checked)} />
                        <span className="palm-sign-code-body">
                            <span className="palm-sign-code-no">{code}</span>
                            {result ? <small role="status" className={'palm-sign-state ' + tone}>{result.message}</small>
                                : <small className={'palm-sign-state ' + tone}>{v.photos[code] ? '✅ បានស្កេន និងចាប់រូប' : '⏳ រង់ចាំស្កេន'}</small>}
                            {v.problemScans[code] ? <small className="palm-sign-problem">⚠️ មានស្កេនបញ្ហា · {v.problemScans[code].time}<br />{v.problemScans[code].message}</small> : null}
                            {v.warnings[code] ? <small className="palm-sign-warning">⚠️ សារព្រមានពី ZTO៖ {v.warnings[code]}</small> : null}
                        </span>
                        {v.photos[code] ? <img className="palm-sign-thumbnail" src={'data:image/jpeg;base64,' + v.photos[code]} alt={'រូបកញ្ចប់ ' + code} />
                            : <span className="palm-sign-thumb-empty" aria-hidden="true">📷</span>}
                    </label>;
                })}
            </div>
            <div className="palm-sign-tools">
                <input id="palmSignPhotoInput" ref={refTo('palmSignPhotoInput')} type="file" accept="image/*" capture="environment" hidden disabled={!canScan}
                    onChange={(event) => { const file = event.target.files?.[0]; setFieldValue('palmSignPhotoInput', ''); if (file) void takePhoto(file); }} />
                <button type="button" className="palm-sign-soft" disabled={!canScan}
                    onClick={() => { noteAppLockExcuse(); openFilePicker('palmSignPhotoInput'); }}>📷 ថតរូបកញ្ចប់</button>
                <input id="palmSignGalleryInput" ref={refTo('palmSignGalleryInput')} type="file" accept="image/*" hidden disabled={!canScan}
                    onChange={(event) => { const file = event.target.files?.[0]; setFieldValue('palmSignGalleryInput', ''); if (file) void takePhoto(file); }} />
                <button type="button" className="palm-sign-soft" disabled={!canScan}
                    onClick={() => { noteAppLockExcuse(); openFilePicker('palmSignGalleryInput'); }}>🖼 ជ្រើសរូបពី Gallery</button>
            </div>
            <form className="palm-sign-manual" onSubmit={(event) => { event.preventDefault(); if (!disabled) addBarcode(barcode); }}>
                <label htmlFor="palmSignBarcode">⌨️ ម៉ាស៊ីនស្កេន ឬ Barcode សម្រាប់ថតរូប</label>
                <div className="palm-sign-scan">
                    <input id="palmSignBarcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} disabled={!canScan}
                        autoComplete="off" spellCheck={false} placeholder="Barcode"
                        onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === 'Tab') && barcode.trim()) { event.preventDefault(); addBarcode(barcode); } }} />
                    <button type="submit" className="palm-sign-soft" disabled={!canScan}>ស្កេន</button>
                </div>
            </form>
            <div className="modal-btns palm-sign-actions">
                <button type="button" className="btn-confirm" disabled={disabled || !sendable.length}
                    onClick={() => void submitZtoPalmSign(v.selectedCodes)}>{'⬆ ផ្ញើបញ្ជី' + (sendable.length ? ' (' + sendable.length + ')' : '')}</button>
                {canAdvance ? <button type="button" className="btn-success" disabled={disabled} onClick={advancePalmSignStage}>បន្ទាប់ ➜ ស្កេនពេលទទួលទំនិញ</button> : null}
                {v.stage === 'receipt' && v.results.some((row) => row.state === 'unknown' || row.state === 'signed' && !row.saved)
                    ? <button type="button" className="palm-sign-soft" disabled={disabled} onClick={() => void recheckZtoPalmSign()}>🔄 ពិនិត្យ ZTO</button> : null}
                <button type="button" className="btn-cancel" disabled={v.busy} onClick={() => closeModal('ztoPalmSignModal')}>បិទ</button>
            </div>
        </div>
    );
}

export function ZtoPalmSignModal() {
    const open = useStoreValue(uiState, (state) => state.modalDisplay.ztoPalmSignModal === 'flex');
    const v = useStoreFields(palmSignState, ['generation', 'busy']);
    return <Modal id="ztoPalmSignModal" noDismiss={v.busy}>{open ? <SignForm key={v.generation} /> : null}</Modal>;
}
