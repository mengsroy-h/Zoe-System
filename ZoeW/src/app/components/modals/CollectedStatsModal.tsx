import { Modal } from './Modal';
import { onAct } from '../../actions';
import { CollectedStatsCards } from '../stats/StatsCards';

export function CollectedStatsModal() {
    return (
        <Modal id="collectedStatsModal">
            <div className="modal-content">
                <h3>💵 ចំណូលប្រចាំថ្ងៃ (តាមថ្ងៃយក)</h3>
                <p>
                    បង្ហាញទឹកប្រាក់តាមថ្ងៃដែលចុច{' '}
                    <b>«យក»</b>
                    {' '}លើកញ្ចប់ ដោយមិនគិតថាកញ្ចប់ស្កេនចូលថ្ងៃណាទេ។ ទិន្នន័យរក្សាទុកសម្រាប់{' '}
                    <b>៧ ថ្ងៃចុងក្រោយ</b>
                    ។
                </p>
                <div id="collectedStatsContainer" style={{ maxHeight: "260px", overflowY: "auto", marginBottom: "8px" }}>
                    <CollectedStatsCards />
                </div>
                <p className="mrep-foot">
                    ⛔ នេះ{' '}
                    <b>មិនមែន</b>
                    {' '}«📅 កញ្ចប់ប្រចាំថ្ងៃ» ទេ — ផ្ទាំងនោះគិតតាម{' '}
                    <b>ថ្ងៃស្កេនចូល</b>
                    ។
                </p>
                <div className="modal-btns">
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["collectedStatsModal"] })}>បិទ</button>
                </div>
            </div>
        </Modal>
    );
}
