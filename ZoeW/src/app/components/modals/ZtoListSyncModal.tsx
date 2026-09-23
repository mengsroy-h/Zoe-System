import { onAct } from '../../actions';
import { ZtoListSyncBody } from '../zto/ZtoListSyncBody';

export function ZtoListSyncModal() {
    return (
        <div
            id="ztoListSyncModal"
            className="modal"
            data-close="closeZtoListSyncModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ztoListSyncTitle"
        >
            <div className="modal-content zto-list-modal-content">
                <h3 id="ztoListSyncTitle">📥 បញ្ជីកញ្ចប់ពី ZTO</h3>
                <div className="zto-list-range">
                    <label htmlFor="ztoListSyncFrom">ពីថ្ងៃ</label>
                    <input type="date" id="ztoListSyncFrom" />
                    <label htmlFor="ztoListSyncTo">ដល់ថ្ងៃ</label>
                    <input type="date" id="ztoListSyncTo" />
                </div>
                <p id="ztoListSyncNote"></p>
                <div className="zto-list-body" id="ztoListSyncBody">
                    <ZtoListSyncBody />
                </div>
                <div className="modal-btns">
                    <div className="modal-btns-row">
                        <button
                            type="button"
                            className="btn-confirm"
                            id="ztoListSyncRunBtn"
                            onClick={onAct("runZtoListSyncPreview")}
                        >
                            📥 ទាញបញ្ជី
                        </button>
                        <button
                            type="button"
                            className="btn-confirm zto-list-import-btn"
                            id="ztoListSyncImportBtn"
                            onClick={onAct("importZtoListRows")}
                        >
                            ➕ បញ្ចូលកញ្ចប់ថ្មី
                        </button>
                        <button
                            type="button"
                            className="btn-cancel"
                            id="ztoListSyncCloseBtn"
                            onClick={onAct("closeZtoListSyncModal")}
                        >
                            បិទ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
