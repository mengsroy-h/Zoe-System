import { onAct } from '../../actions';
import { ZtoSyncList } from '../zto/ZtoSyncList';

export function ZtoSyncModal() {
    return (
        <div
            id="ztoSyncModal"
            className="modal"
            data-close="closeZtoSyncModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ztoSyncModalTitle"
        >
            <div className="modal-content zto-sync-modal-content">
                <h3 id="ztoSyncModalTitle">🔄 កញ្ចប់ដែល ZTO មិនទាន់បិទ</h3>
                <p id="ztoSyncModalNote"></p>
                <div className="zto-sync-list" id="ztoSyncList">
                    <ZtoSyncList />
                </div>
                <div className="modal-btns">
                    <div className="modal-btns-row">
                        <button
                            type="button"
                            className="btn-confirm"
                            id="ztoSyncRecheckBtn"
                            onClick={onAct("recheckZtoPickupStatus")}
                        >
                            🔄 ពិនិត្យម្តងទៀត
                        </button>
                        <button
                            type="button"
                            className="btn-cancel"
                            id="ztoSyncCloseBtn"
                            onClick={onAct("closeZtoSyncModal")}
                        >
                            បិទ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
