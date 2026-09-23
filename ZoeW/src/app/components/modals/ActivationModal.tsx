import { onAct } from '../../actions';

export function ActivationModal() {
    return (
        <div id="activationModal" className="modal" style={{ display: "none" }} data-nodismiss="true">
            <div className="modal-content">
                <h3>🔑 ត្រូវការ Activation Key</h3>
                <p id="activationModalMsg">សូមបញ្ចូល Activation Key សម្រាប់ ZoeW ដើម្បីបន្ត។</p>
                <textarea
                    id="activationKeyInput"
                    placeholder="ZOEKEY-..."
                    style={{ minHeight: "70px", fontFamily: "monospace", fontSize: "calc(11 * var(--fs-unit))" }}
                ></textarea>
                <div className="modal-btns">
                    <button className="btn-confirm" id="activationSubmitBtn" onClick={onAct("submitActivationKey")}>ដាក់ Active</button>
                    <button className="btn-cancel" id="activationLogoutBtn" onClick={onAct("logoutApp")}>ចាកចេញ</button>
                </div>
                <p
                    style={{ marginTop: "10px", fontSize: "calc(11.5 * var(--fs-unit))", color: "var(--text-muted)", textAlign: "center" }}
                >
                    មិនទាន់មាន Key? ទាក់ទង{' '}
                    <a
                        href="https://t.me/mengsroyhun"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--primary)", fontWeight: "600" }}
                    >
                        @mengsroyhun
                    </a>
                    {' '}តាម Telegram
                </p>
            </div>
        </div>
    );
}
