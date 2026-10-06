import { refTo } from '../../refs';
import { viewState } from '../../../core/view-state';
import { useStoreFields } from '../../hooks/useStore';
import { Modal } from './Modal';
import { onAct } from '../../actions';
import { ZtoListSyncBody } from '../zto/ZtoListSyncBody';

export function ZtoListSyncModal() {
    const v = useStoreFields(viewState, ['ztoListSyncNote', 'ztoListSyncSite']);
    return (
        <Modal
            id="ztoListSyncModal"
            close="closeZtoListSyncModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ztoListSyncTitle"
        >
            <div className="modal-content zto-list-modal-content">
                <h3 id="ztoListSyncTitle">📥 បញ្ជីកញ្ចប់ពី ZTO</h3>
                {v.ztoListSyncSite ? <p className="zto-list-site" id="ztoListSyncSite">🏢 សាខា ៖ {v.ztoListSyncSite}</p> : null}
                <div className="zto-list-range">
                    <label htmlFor="ztoListSyncFrom">ពីថ្ងៃ</label>
                    <input type="date" id="ztoListSyncFrom" ref={refTo('ztoListSyncFrom')} />
                    <label htmlFor="ztoListSyncTo">ដល់ថ្ងៃ</label>
                    <input type="date" id="ztoListSyncTo" ref={refTo('ztoListSyncTo')} />
                </div>
                <p id="ztoListSyncNote">{v.ztoListSyncNote}</p>
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
        </Modal>
    );
}
