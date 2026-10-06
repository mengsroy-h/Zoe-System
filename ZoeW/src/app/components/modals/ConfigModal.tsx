import { refTo } from '../../refs';
import { Modal } from './Modal';
import { onAct } from '../../actions';
import { viewState } from '../../../core/view-state';
import { useStoreFields } from '../../hooks/useStore';
import { SellerTelegramLink } from '../shell/SellerTelegramLink';

export function ConfigModal() {
    const v = useStoreFields(viewState, ['configBackend']);
    const supabase = v.configBackend === 'supabase';
    return (
        <Modal id="configModal">
            <div className="modal-content">
                <h3>⚙️ ភ្ជាប់ប្រព័ន្ធ</h3>
                <p>
                    ស្កេន QR ឬបើក <b>Setup Link</b> ដែលអ្នកលក់ផ្ញើ ➜ ការកំណត់បំពេញឲ្យដោយខ្លួនឯង។
                </p>
                <p className="cfg-contact">
                    មិនទាន់មានគណនី? ទាក់ទង{' '}
                    <SellerTelegramLink />
                    {' '}តាម Telegram ដើម្បីបង្កើតគណនី
                </p>
                <div className="modal-btns" style={{ marginBottom: "10px" }}>
                    <button type="button" className="btn-info" onClick={onAct("openConfigQrScanner")}>📷 ស្កេន QR (Setup Link)</button>
                </div>
                <div className="cfg-extra">
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
                    <p className="cfg-choice-title">ឬកំណត់ដោយដៃ — ប្រភេទ Server ៖</p>
                    <div className="cfg-choice" role="radiogroup" aria-label="ប្រភេទ Server">
                        <label className={supabase ? 'cfg-choice-item' : 'cfg-choice-item is-on'}>
                            <input type="radio" name="configBackend" checked={!supabase} onChange={onAct("selectConfigBackend", { args: ['firebase'] })} />
                            {' '}Firebase
                        </label>
                        <label className={supabase ? 'cfg-choice-item is-on' : 'cfg-choice-item'}>
                            <input type="radio" name="configBackend" checked={supabase} onChange={onAct("selectConfigBackend", { args: ['supabase'] })} />
                            {' '}Supabase
                        </label>
                    </div>
                </div>
                <p className={supabase ? 'hidden' : undefined}>
                    ឬបិទភ្ជាប់ Config Firebase ពី{' '}
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
                    <p>Supabase ➜ Project Settings ➜ API ៖ Project URL និង <b>Publishable key</b> (⛔ មិនមែន Secret key)។</p>
                    <input type="url" id="sbUrlInput" ref={refTo('sbUrlInput')} placeholder="https://xxxx.supabase.co" autoComplete="off" spellCheck={false} />
                    <input type="text" id="sbKeyInput" ref={refTo('sbKeyInput')} placeholder="sb_publishable_…" autoComplete="off" spellCheck={false} />
                    <input type="text" id="sbDomainInput" ref={refTo('sbDomainInput')} placeholder="loginDomain (ស្រេចចិត្ត ៖ users.zoew.invalid)" autoComplete="off" spellCheck={false} />
                </div>
                <p style={{ marginTop: "14px" }}>🐞 Sentry DSN (Optional — សម្រាប់ Auto Bug Report):</p>
                <input type="text" id="sentryDsnInput" ref={refTo('sentryDsnInput')} placeholder="https://xxxx@xxxx.ingest.sentry.io/xxxx" />
                <div className="modal-btns">
                    <button className="btn-confirm" id="configSaveBtn" onClick={onAct("saveFirebaseConfig")}>រក្សាទុក និងភ្ជាប់</button>
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["configModal"] })}>បោះបង់</button>
                </div>
            </div>
        </Modal>
    );
}
