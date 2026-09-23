import { Modal } from './Modal';
import { onAct } from '../../actions';
import { DailyStatsCards } from '../stats/StatsCards';

export function DailyStatsModal() {
    return (
        <Modal id="dailyStatsModal">
            <div className="modal-content">
                <h3>📅 កញ្ចប់ & ចំណូល (យករួច) ប្រចាំថ្ងៃ</h3>
                <p>ទិន្នន័យរក្សាទុកក្នុង Database ជានិច្ច</p>
                <div id="dailyStatsContainer" style={{ maxHeight: "260px", overflowY: "auto", marginBottom: "8px" }}>
                    <DailyStatsCards />
                </div>
                <div className="modal-btns">
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["dailyStatsModal"] })}>បិទ</button>
                </div>
            </div>
        </Modal>
    );
}
