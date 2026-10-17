import { useRef, useState } from 'react';
import { palmSignState } from '../../../core/palm-sign-state';
import { scanState, uiState } from '../../../core/state';
import { noteAppLockExcuse } from '../../../features/app-lock';
import { acceptPalmSignBarcode, recheckZtoPalmSign, setPalmSignSelected, submitZtoPalmSign } from '../../../features/zto-palm-sign';
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

function SignForm() {
    const v = useStoreFields(palmSignState, ['codes', 'selectedCodes', 'busy', 'message', 'results']);
    const codes = v.selectedCodes;
    const [name, setName] = useState('');
    const [photo, setPhoto] = useState('');
    const [barcode, setBarcode] = useState('');
    const [message, setMessage] = useState('');
    const [preparing, setPreparing] = useState(false);
    const requestId = useRef(crypto.randomUUID());
    const photoSequence = useRef(0);
    const frozen = v.results.some((row) => row.state !== 'failed');
    const disabled = v.busy || preparing;
    const addBarcode = (raw: string) => {
        acceptPalmSignBarcode(raw);
        setBarcode('');
    };
    const takePhoto = async (file: File) => {
        const sequence = ++photoSequence.current;
        setPreparing(true);
        try {
            const prepared = await preparePhoto(file);
            if (sequence !== photoSequence.current) return;
            setPhoto(prepared.data);
            setMessage('✅ រូបភាពត្រៀមរួច។');
            if (prepared.barcode) addBarcode(prepared.barcode);
        } catch { setMessage('បើករូបភាពមិនបាន។ សូមថតរូបម្ដងទៀត។'); }
        finally { if (sequence === photoSequence.current) setPreparing(false); }
    };
    return (
        <div className="modal-content palm-sign-content">
            <h3>✍️ Sign · ZTO Palm</h3>
            <p>ជ្រើសកញ្ចប់ ថតរូប និងបញ្ចូលឈ្មោះអ្នកទទួល រួចចុច «ចុះឈ្មោះ» ដើម្បីផ្ញើទៅ ZTO។</p>
            <div className="palm-sign-codes">
                {v.codes.map((code) => {
                    const result = v.results.find((row) => row.code === code);
                    return <label key={code} className="palm-sign-code">
                        <input type="checkbox" checked={codes.includes(code)} disabled={disabled || !!result && result.state !== 'failed'}
                            onChange={(event) => setPalmSignSelected(code, event.target.checked)} />
                        <span>{code}{result ? <small role="status">{result.message}</small> : null}</span>
                    </label>;
                })}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); if (!disabled) addBarcode(barcode); }}>
                <label htmlFor="palmSignBarcode">ស្កេន ឬបញ្ចូល Barcode</label>
                <div className="palm-sign-scan">
                    <input id="palmSignBarcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} disabled={disabled}
                        autoComplete="off" spellCheck={false} placeholder="Barcode"
                        onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === 'Tab') && barcode.trim()) { event.preventDefault(); addBarcode(barcode); } }} />
                    <button type="submit" className="btn-info" disabled={disabled}>ស្កេន</button>
                </div>
            </form>
            <label htmlFor="palmSignName">ឈ្មោះអ្នកទទួល</label>
            <input id="palmSignName" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} disabled={disabled || frozen} autoComplete="off" />
            <input id="palmSignPhotoInput" ref={refTo('palmSignPhotoInput')} type="file" accept="image/*" capture="environment" hidden disabled={disabled || frozen}
                onChange={(event) => { const file = event.target.files?.[0]; setFieldValue('palmSignPhotoInput', ''); if (file) void takePhoto(file); }} />
            <button type="button" className="btn-info" disabled={disabled || frozen}
                onClick={() => { noteAppLockExcuse(); openFilePicker('palmSignPhotoInput'); }}>📷 {photo ? 'ថតរូបម្ដងទៀត' : 'ថតរូបកញ្ចប់ / អ្នកទទួល'}</button>
            {photo ? <img className="palm-sign-photo" src={photo} alt="រូបភាពសម្រាប់ ZTO Sign" /> : null}
            {preparing || message ? <p role="status" aria-live="polite">{preparing ? 'កំពុងរៀបចំរូបភាព…' : message}</p> : null}
            {v.message ? <p role="status" aria-live="polite">{v.message}</p> : null}
            <div className="modal-btns">
                <button className="btn-confirm" disabled={disabled || !photo || !name.trim() || !codes.some((code) => !v.results.some((r) => r.code === code && r.state !== 'failed'))}
                    onClick={() => void submitZtoPalmSign(codes, name, photo.split(',')[1], requestId.current)}>✍️ ចុះឈ្មោះ</button>
                {v.results.some((row) => row.state === 'unknown' || row.state === 'signed' && !row.saved)
                    ? <button className="btn-info" disabled={disabled} onClick={() => void recheckZtoPalmSign()}>ពិនិត្យ ZTO</button> : null}
                <button className="btn-cancel" disabled={v.busy} onClick={() => closeModal('ztoPalmSignModal')}>បិទ</button>
            </div>
        </div>
    );
}

export function ZtoPalmSignModal() {
    const open = useStoreValue(uiState, (state) => state.modalDisplay.ztoPalmSignModal === 'flex');
    const v = useStoreFields(palmSignState, ['generation', 'busy']);
    return <Modal id="ztoPalmSignModal" noDismiss={v.busy}>{open ? <SignForm key={v.generation} /> : null}</Modal>;
}
