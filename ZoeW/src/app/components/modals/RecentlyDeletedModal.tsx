import { refTo } from '../../refs';
import { Modal } from './Modal';
import { onAct } from '../../actions';
import { TrashSummaryBox } from '../trash/TrashSummaryBox';
import { TrashTableBody } from '../trash/TrashTableBody';

export function RecentlyDeletedModal() {
    return (
        <Modal id="recentlyDeletedModal">
            <div className="modal-content trash-modal-content">
                <h3>🗑️ ធុងសំរាម</h3>
                <p>ផុតកំណត់ ៨ថ្ងៃ៖ ២ ថ្ងៃ · ប្រភេទផ្សេង៖ ៣០ ថ្ងៃ</p>
                <div className="trash-search-box">
                    <span className="icon">🔍</span>
                    <input
                        type="search"
                        id="deletedSearchInput" ref={refTo('deletedSearchInput')}
                        placeholder="ស្វែងរកលេខទូរស័ព្ទ ឬ Barcode..."
                        autoComplete="off"
                        onInput={onAct("filterRecentlyDeleted")}
                    />
                </div>
                <div className="trash-summary" id="trashSummaryBox">
                    <TrashSummaryBox />
                </div>
                <div className="table-responsive trash-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: "42%" }}>អតិថិជន</th>
                                <th style={{ width: "30%" }}>កញ្ចប់ / តម្លៃ</th>
                                <th style={{ width: "28%", textAlign: "center" }}>សកម្មភាព</th>
                            </tr>
                        </thead>
                        <tbody id="deletedTableBody">
                            <TrashTableBody />
                        </tbody>
                    </table>
                </div>
                <div className="modal-btns">
                    <button className="btn-cancel" onClick={onAct("closeRecentlyDeletedModal")}>បិទ</button>
                </div>
            </div>
        </Modal>
    );
}
