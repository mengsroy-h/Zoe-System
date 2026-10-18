import { palmSignPhotoFromFile, startPalmSignCamera } from '../../../services/palm-sign-camera';
import { useEffect, useState } from 'react';
import { palmSignState, type PalmSignResult } from '../../../core/palm-sign-state';
import { uiState } from '../../../core/state';
import { noteAppLockExcuse } from '../../../features/app-lock';
import { acceptPalmSignBarcode, cancelPalmSignConfirmation, confirmPalmSignWarning, checkZtoPalmSignStages, palmSignCodeOf, palmSignWantsFrame, recheckZtoPalmSign, removePalmSignScan, setPalmSignName, submitZtoPalmSign } from '../../../features/zto-palm-sign';
import { closeModal } from '../../../ui/modal';
import { useStoreFields, useStoreValue } from '../../hooks/useStore';
import { Modal } from './Modal';
import { openFilePicker, refTo, setFieldValue } from '../../refs';

type CodeView = { tone: string; text: string };

function codeView(code: string, v, confirming: boolean): CodeView {
    const result: PalmSignResult | undefined = v.results.find((row) => row.code === code);
    const dispatch: PalmSignResult | undefined = v.dispatchResults.find((row) => row.code === code);
    const photo = !!v.photos[code];
    if (result) {
        if (result.state === 'signed') return { tone: result.saved === false ? 'is-warn' : 'is-ok', text: result.message };
        return { tone: result.state === 'unknown' || confirming ? 'is-warn' : 'is-error', text: result.message };
    }
    if (v.dispatching[code]) return { tone: 'is-ready', text: '⏳ កំពុងចែកចាយក្នុង ZTO…' };
    if (dispatch && dispatch.state !== 'dispatched') return { tone: dispatch.state === 'unknown' ? 'is-warn' : 'is-error', text: dispatch.message };
    if (!photo) return { tone: 'is-wait', text: dispatch ? '🚚 ចែកចាយរួច · ⏳ រង់ចាំស្កេន' : '⏳ រង់ចាំស្កេន' };
    if (dispatch) return { tone: 'is-ok', text: '✅ រួចរាល់ Sign' };
    return { tone: 'is-ready', text: v.checked[code] ? '✅ បានស្កេន' : '⏳ កំពុងពិនិត្យ ZTO…' };
}

function CodeNote({ title, text }: { title: string; text: string }) {
    return <details className="palm-sign-note"><summary>{title}</summary><p>{text}</p></details>;
}

function SignForm() {
    const v = useStoreFields(palmSignState, ['codes', 'selectedCodes', 'busy', 'message', 'results', 'dispatchResults', 'dispatching', 'photos', 'checking', 'checked', 'signMan', 'confirmation', 'warnings', 'problemScans']);
    const [barcode, setBarcode] = useState('');
    const [message, setMessage] = useState('');
    const [preparing, setPreparing] = useState(false);
    const [cameraEpoch, setCameraEpoch] = useState(0);
    const signedOf = (code: string) => v.results.some((r) => r.code === code && r.state === 'signed');
    const allReceived = v.codes.length > 0 && v.codes.every(signedOf);
    const disabled = v.busy || preparing || !!v.confirmation;
    const canScan = !disabled && !allReceived;
    const ready = v.selectedCodes.filter((code) => v.photos[code] && !signedOf(code) && v.dispatchResults.some((r) => r.code === code && r.state === 'dispatched' && r.proof)
        && !v.results.some((r) => r.code === code && r.state === 'unknown'));
    const scanned = v.codes.filter((code) => v.photos[code] || signedOf(code)).length;
    const needsName = !allReceived && !v.signMan.trim();
    const idle = v.busy ? 'កំពុង Sign ក្នុង ZTO…' : preparing ? 'កំពុងអានរូបភាព…' : v.confirmation ? 'រង់ចាំការបញ្ជាក់កញ្ចប់'
        : allReceived ? '✅ ZTO បញ្ជាក់ការទទួលរួចហើយ' : 'កាមេរ៉ាផ្អាក';
    useEffect(() => {
        if (!canScan) return;
        return startPalmSignCamera((code, photo) => acceptPalmSignBarcode(code, photo),
            () => setMessage('បើកកាមេរ៉ាមិនបាន។ សូមអនុញ្ញាតកាមេរ៉ា ឬជ្រើសរូបពី Gallery។'), palmSignWantsFrame, palmSignCodeOf);
    }, [cameraEpoch, canScan]);
    const addBarcode = (raw: string) => { acceptPalmSignBarcode(raw); setBarcode(''); };
    const takePhoto = async (file: File) => {
        const generation = palmSignState.generation;
        const manualCode = barcode.trim();
        setPreparing(true);
        setMessage('');
        try {
            const prepared = await palmSignPhotoFromFile(file, palmSignCodeOf);
            if (generation !== palmSignState.generation) return;
            const code = prepared.barcode || manualCode;
            if (!code) { setMessage('រូបនេះមិនអាន Barcode ឬ QR បាន។ សូមថតឲ្យជិត ច្បាស់ ឬវាយ Barcode រួចជ្រើសរូបម្ដងទៀត។'); return; }
            acceptPalmSignBarcode(code, prepared.data, true);
            setBarcode('');
        } catch { setMessage('បើករូបភាពមិនបាន។ សូមថតរូបម្ដងទៀត។'); }
        finally { setPreparing(false); }
    };
    const signLabel = allReceived ? '✅ Sign រួច' : needsName && ready.length ? '👤 សូមវាយឈ្មោះអ្នកទទួល' : '✍️ Sign' + (ready.length ? ' (' + ready.length + ')' : '');
    return (
        <div className="modal-content palm-sign-content">
            <h3>✍️ Sign · ZTO Palm</h3>
            <p className="palm-sign-hint">ស្កេន Barcode ឬ QR លើបុង ➜ វាយឈ្មោះអ្នកទទួល ➜ ចុច «✍️ Sign»។</p>
            <div className="palm-sign-camera">
                <video id="palmSignVideo" ref={refTo('palmSignVideo')} autoPlay playsInline muted className="palm-sign-video" />
                {canScan ? <span className="palm-sign-frame" aria-hidden="true" /> : <span className="palm-sign-camera-idle">{idle}</span>}
                {canScan ? <button type="button" className="palm-sign-camera-retry" onClick={() => setCameraEpoch((value) => value + 1)}>🔄 កាមេរ៉ា</button> : null}
            </div>
            {!allReceived ? <div className="palm-sign-name">
                <label htmlFor="palmSignName">👤 ឈ្មោះអ្នកទទួល</label>
                <input id="palmSignName" value={v.signMan} onChange={(event) => setPalmSignName(event.target.value)} maxLength={120} required placeholder="វាយឈ្មោះអ្នកទទួល"
                    disabled={disabled} autoComplete="off" />
            </div> : null}
            {preparing || message || v.message || v.checking ? <div className="palm-sign-status">
                {preparing || message ? <p role="status" aria-live="polite">{preparing ? 'កំពុងអានរូបភាព…' : message}</p> : null}
                {v.message || v.checking ? <p role="status" aria-live="polite">{v.message || 'កំពុងពិនិត្យស្ថានភាព ZTO…'}</p> : null}
            </div> : null}
            {v.confirmation ? <section className="palm-sign-confirmation" role="alertdialog" aria-labelledby="palmSignWarningTitle" aria-describedby="palmSignWarningMessage">
                <h4 id="palmSignWarningTitle">⚠️ បញ្ជាក់កញ្ចប់ · {v.confirmation.code}</h4>
                <p id="palmSignWarningMessage">{v.confirmation.message}</p>
                <div className="modal-btns">
                    <button type="button" className="btn-cancel" autoFocus disabled={v.busy} onClick={cancelPalmSignConfirmation}>បោះបង់</button>
                    <button type="button" className="btn-confirm" disabled={v.busy} onClick={() => void confirmPalmSignWarning()}>បញ្ជាក់ និងបន្ត</button>
                </div>
            </section> : null}
            <div className="palm-sign-list-head"><span>📦 កញ្ចប់ {v.codes.length}</span><span>📷 បានស្កេន {scanned}/{v.codes.length}</span></div>
            <div className="palm-sign-codes">
                {v.codes.map((code) => {
                    const view = codeView(code, v, v.confirmation?.code === code);
                    const photo = v.photos[code];
                    return <div key={code} className={'palm-sign-code' + (photo ? ' is-selected' : '')}>
                        {photo ? <img className="palm-sign-thumbnail" src={'data:image/jpeg;base64,' + photo} alt={'រូបកញ្ចប់ ' + code} />
                            : <span className="palm-sign-thumb-empty" aria-hidden="true">📷</span>}
                        <span className="palm-sign-code-body">
                            <span className="palm-sign-code-no">{code}</span>
                            <small role="status" className={'palm-sign-state ' + view.tone}>{view.text}</small>
                            {v.problemScans[code] ? <CodeNote title={'⚠️ ស្កេនបញ្ហា · ' + v.problemScans[code].time} text={v.problemScans[code].message} /> : null}
                            {v.warnings[code] ? <CodeNote title="⚠️ សារព្រមានពី ZTO" text={v.warnings[code]} /> : null}
                        </span>
                        {photo && !signedOf(code) ? <button type="button" className="palm-sign-remove" disabled={disabled} aria-label={'ដករូប ' + code}
                            onClick={() => removePalmSignScan(code)}>✕</button> : null}
                    </div>;
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
                <label htmlFor="palmSignBarcode">⌨️ ម៉ាស៊ីនស្កេន ឬវាយ Barcode</label>
                <div className="palm-sign-scan">
                    <input id="palmSignBarcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} disabled={!canScan}
                        autoComplete="off" spellCheck={false} placeholder="Barcode"
                        onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === 'Tab') && barcode.trim()) { event.preventDefault(); addBarcode(barcode); } }} />
                    <button type="submit" className="palm-sign-soft" disabled={!canScan}>＋ បន្ថែម</button>
                </div>
            </form>
            <div className="modal-btns palm-sign-actions">
                <button type="button" className="btn-confirm palm-sign-submit" disabled={disabled || v.checking || needsName || !ready.length}
                    onClick={() => void submitZtoPalmSign()}>{signLabel}</button>
                {v.codes.some((code) => !v.checked[code] && !signedOf(code)) && !v.checking
                    ? <button type="button" className="palm-sign-soft" disabled={disabled} onClick={() => void checkZtoPalmSignStages()}>🔄 ពិនិត្យស្ថានភាព ZTO</button> : null}
                {v.results.some((row) => row.state === 'unknown' || row.state === 'signed' && !row.saved)
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
