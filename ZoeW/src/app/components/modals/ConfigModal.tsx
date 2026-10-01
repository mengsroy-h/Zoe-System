import { refTo } from '../../refs';
import { Modal } from './Modal';
import { onAct } from '../../actions';

export function ConfigModal() {
    return (
        <Modal id="configModal">
            <div className="modal-content">
                <h3>⚙️ ភ្ជាប់ប្រព័ន្ធ</h3>
                <p>
                    ស្កេន QR ឬបើក <b>Setup Link</b> ដែលអ្នកលក់ផ្ញើ ➜ ការកំណត់បំពេញឲ្យដោយខ្លួនឯង។
                </p>
                <div className="modal-btns" style={{ marginBottom: "10px" }}>
                    <button type="button" className="btn-info" onClick={onAct("openConfigQrScanner")}>📷 ស្កេន QR (Setup Link)</button>
                </div>
                <p>
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
                    placeholder={"បិទភ្ជាប់អ្វីដែល copy ពី Firebase Console ទាំងស្រុងបានតែម្តង៖\n\nconst firebaseConfig = {\n  apiKey: \"...\",\n  authDomain: \"...\",\n  databaseURL: \"...\",\n  projectId: \"...\"\n};"}
                ></textarea>
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
