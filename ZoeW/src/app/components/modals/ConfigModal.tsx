import { refTo } from '../../refs';
import { Modal } from './Modal';
import { onAct } from '../../actions';
import { viewState } from '../../../core/view-state';
import { useStoreFields } from '../../hooks/useStore';
import { SellerTelegramLink } from '../shell/SellerTelegramLink';
import { FirebaseMark, SupabaseMark } from '../shell/BackendMark';

export function ConfigModal() {
    const v = useStoreFields(viewState, ['configBackend', 'configManual', 'configPendingLink']);
    const supabase = v.configBackend === 'supabase';
    const link = v.configPendingLink;
    const linkSupabase = !!link && link.backend === 'supabase';
    return (
        <Modal id="configModal">
            <div className="modal-content">
                <h3>⚙️ ភ្ជាប់ប្រព័ន្ធ</h3>
                <p className="cfg-lead">
                    ស្កេន QR ឬបិទភ្ជាប់ <b>Setup Link</b> ដែលអ្នកលក់ផ្ញើ ➜ App ភ្ជាប់ដោយខ្លួនឯង។
                </p>
                {link ? (
                    <div className={linkSupabase ? 'cfg-link-card cfg-sb' : 'cfg-link-card cfg-fb'} id="configLinkCard">
                        <div className="cfg-link-card-head">
                            {linkSupabase ? <SupabaseMark /> : <FirebaseMark />}
                            <span>Setup Link ៖ {linkSupabase ? 'Supabase' : 'Firebase'}</span>
                        </div>
                        <div className="cfg-link-card-host">{link.host}</div>
                        {link.invite ? <div className="cfg-link-card-note">📝 មានកូដអញ្ជើញ (ហាងថ្មី ➜ ចុះឈ្មោះ)</div> : null}
                        <button type="button" className="cfg-link-card-btn" id="configLinkConnectBtn" onClick={onAct("saveFirebaseConfig")}>✅ ភ្ជាប់</button>
                    </div>
                ) : null}
                <div className="cfg-quick">
                    <button type="button" className="cfg-scan-btn" onClick={onAct("openConfigQrScanner")}>📷 ស្កេន QR (Setup Link)</button>
                    <label className="cfg-image-btn" htmlFor="configQrImageInput">🖼️ QR ពីរូបភាព</label>
                    <input
                        type="file"
                        id="configQrImageInput"
                        ref={refTo('configQrImageInput')}
                        className="hidden"
                        accept="image/*"
                        onChange={onAct("decodeConfigQrImage", { evt: true })}
                    />
                    <div className="cfg-link-row">
                        <input
                            type="text"
                            id="setupLinkInput"
                            ref={refTo('setupLinkInput')}
                            placeholder="បិទភ្ជាប់ Setup Link (https://…?setup=…)"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <button type="button" className="btn-info" id="setupLinkApplyBtn" onClick={onAct("applySetupLinkFromInput")}>ប្រើ Link</button>
                    </div>
                </div>
                <label className="cfg-manual-toggle">
                    <input
                        type="checkbox"
                        id="configManualToggle"
                        role="switch"
                        checked={v.configManual}
                        onChange={onAct("toggleConfigManual")}
                    />
                    <span className="cfg-switch" aria-hidden="true"></span>
                    <span>✍️ បំពេញ Config ដោយដៃ</span>
                </label>
                <div className={v.configManual ? 'cfg-manual' : 'cfg-manual hidden'} id="configManualSection">
                    <div className="cfg-choice" role="radiogroup" aria-label="ប្រភេទ Server">
                        <label className={supabase ? 'cfg-choice-item cfg-fb' : 'cfg-choice-item cfg-fb is-on'}>
                            <input type="radio" name="configBackend" checked={!supabase} onChange={onAct("selectConfigBackend", { args: ['firebase'] })} />
                            <FirebaseMark />
                            Firebase
                        </label>
                        <label className={supabase ? 'cfg-choice-item cfg-sb is-on' : 'cfg-choice-item cfg-sb'}>
                            <input type="radio" name="configBackend" checked={supabase} onChange={onAct("selectConfigBackend", { args: ['supabase'] })} />
                            <SupabaseMark />
                            Supabase
                        </label>
                    </div>
                    <p className={supabase ? 'cfg-hint hidden' : 'cfg-hint'}>
                        បិទភ្ជាប់ Config ពី{' '}
                        <b>Firebase Console ➜ Project settings ➜ Your apps</b>
                        {' '}ទាំងស្រុងបានតែម្តង — រួមទាំង{' '}
                        <code>import</code>
                        , comment និង{' '}
                        <code>const firebaseConfig = …</code>
                        ។
                    </p>
                    <textarea
                        id="firebaseConfigInput" ref={refTo('firebaseConfigInput')}
                        className={supabase ? 'hidden' : undefined}
                        placeholder={"បិទភ្ជាប់អ្វីដែល copy ពី Firebase Console ទាំងស្រុងបានតែម្តង៖\n\nconst firebaseConfig = {\n  apiKey: \"...\",\n  authDomain: \"...\",\n  databaseURL: \"...\",\n  projectId: \"...\"\n};"}
                    ></textarea>
                    <div className={supabase ? 'cfg-supabase' : 'cfg-supabase hidden'}>
                        <p className="cfg-hint">Supabase ➜ Project Settings ➜ API ៖ Project URL និង <b>Publishable key</b> (⛔ មិនមែន Secret key)។</p>
                        <input type="url" id="sbUrlInput" ref={refTo('sbUrlInput')} placeholder="https://xxxx.supabase.co" autoComplete="off" spellCheck={false} />
                        <input type="text" id="sbKeyInput" ref={refTo('sbKeyInput')} placeholder="sb_publishable_…" autoComplete="off" spellCheck={false} />
                        <input type="text" id="sbDomainInput" ref={refTo('sbDomainInput')} placeholder="loginDomain (ស្រេចចិត្ត ៖ users.zoew.invalid)" autoComplete="off" spellCheck={false} />
                    </div>
                    <p className="cfg-hint cfg-dsn-label">🐞 Sentry DSN (Optional — សម្រាប់ Auto Bug Report)</p>
                    <input type="text" id="sentryDsnInput" ref={refTo('sentryDsnInput')} placeholder="https://xxxx@xxxx.ingest.sentry.io/xxxx" />
                    <button className="btn-confirm cfg-save-btn" id="configSaveBtn" onClick={onAct("saveFirebaseConfig")}>រក្សាទុក និងភ្ជាប់</button>
                </div>
                <p className="cfg-contact">
                    មិនទាន់មានគណនី? ទាក់ទង{' '}
                    <SellerTelegramLink />
                    {' '}តាម Telegram ដើម្បីបង្កើតគណនី
                </p>
                <div className="modal-btns">
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["configModal"] })}>បោះបង់</button>
                </div>
            </div>
        </Modal>
    );
}
