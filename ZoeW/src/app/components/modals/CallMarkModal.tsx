import { onAct } from '../../actions';

export function CallMarkModal() {
    return (
        <div id="callMarkModal" className="modal">
            <div className="modal-content">
                <h3>📞 សម្គាល់ការខល</h3>
                <p>
                    លេខទូរស័ព្ទ៖{' '}
                    <strong id="callMarkPhoneText" style={{ color: "var(--primary)" }}></strong>
                </p>
                <div className="modal-btns" style={{ marginTop: "6px" }}>
                    <button
                        className="call-mark-opt call-mark-no-answer"
                        onClick={onAct("setCallMark", { args: ["no-answer"] })}
                    >
                        🔕 ខល អត់លើក
                    </button>
                    <button
                        className="call-mark-opt call-mark-no-connect"
                        onClick={onAct("setCallMark", { args: ["no-connect"] })}
                    >
                        📵 ខល អត់ចូល
                    </button>
                    <button
                        className="call-mark-opt call-mark-wrong-number"
                        onClick={onAct("setCallMark", { args: ["wrong-number"] })}
                    >
                        ❗ ខុសលេខ
                    </button>
                    <button className="btn-cancel" onClick={onAct("setCallMark", { args: [null] })}>🔄 សម្អាតសម្គាល់</button>
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["callMarkModal"] })}>បិទ</button>
                </div>
            </div>
        </div>
    );
}
