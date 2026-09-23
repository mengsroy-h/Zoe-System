import { onAct } from '../../actions';
import { HealthCheckList } from '../health/HealthCheckList';

export function HealthCheckModal() {
    return (
        <div id="healthCheckModal" className="modal">
            <div className="modal-content">
                <h3>🩺 ពិនិត្យសុខភាពប្រព័ន្ធ</h3>
                <div id="healthCheckList" className="health-list">
                    <HealthCheckList />
                </div>
                <p className="health-note">
                    ការពិនិត្យនេះ{' '}
                    <b>អានតែប៉ុណ្ណោះ</b>
                    {' '}— វាមិនកែទិន្នន័យ ឬលុយអ្វីទាំងអស់។
                </p>
                <div className="modal-btns">
                    <button className="btn-confirm" id="healthRecheckBtn" onClick={onAct("runHealthCheck")}>ពិនិត្យម្តងទៀត</button>
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["healthCheckModal"] })}>បិទ</button>
                </div>
            </div>
        </div>
    );
}
