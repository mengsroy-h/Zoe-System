import { viewState } from '../../../core/view-state';
import { useStoreValue } from '../../hooks/useStore';
import { Modal } from './Modal';
import { onAct } from '../../actions';
import { HealthCheckList } from '../health/HealthCheckList';
import { DeviceInfoLine } from '../device/DeviceInfoLine';

export function HealthCheckModal() {
    const busy = useStoreValue(viewState, (st) => st.healthRecheckBusy);
    return (
        <Modal id="healthCheckModal">
            <div className="modal-content">
                <h3>🩺 ពិនិត្យសុខភាពប្រព័ន្ធ</h3>
                <DeviceInfoLine id="healthDeviceInfo" />
                <div id="healthCheckList" className="health-list">
                    <HealthCheckList />
                </div>
                <p className="health-note">
                    ការពិនិត្យនេះ{' '}
                    <b>អានតែប៉ុណ្ណោះ</b>
                    {' '}— វាមិនកែទិន្នន័យ ឬលុយអ្វីទាំងអស់។
                </p>
                <div className="modal-btns">
                    <button className="btn-confirm" id="healthRecheckBtn" disabled={busy} onClick={onAct("runHealthCheck")}>ពិនិត្យម្តងទៀត</button>
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["healthCheckModal"] })}>បិទ</button>
                </div>
            </div>
        </Modal>
    );
}
