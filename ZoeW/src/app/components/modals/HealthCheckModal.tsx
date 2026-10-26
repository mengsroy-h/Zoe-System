import { useEffect } from 'react';
import { uiState } from '../../../core/state';
import { watchHealthCheck } from '../../behaviors/health-live';
import { viewState } from '../../../core/view-state';
import { useStoreValue } from '../../hooks/useStore';
import { Modal } from './Modal';
import { onAct } from '../../actions';
import { HealthCheckList } from '../health/HealthCheckList';
import { HealthAdviceBox } from '../health/HealthAdviceBox';
import { DeviceInfoLine } from '../device/DeviceInfoLine';

export function HealthCheckModal() {
    const open = useStoreValue(uiState, (st) => st.modalDisplay.healthCheckModal === 'flex');
    useEffect(() => open ? watchHealthCheck() : undefined, [open]);
    const busy = useStoreValue(viewState, (st) => st.healthRecheckBusy);
    return (
        <Modal id="healthCheckModal">
            <div className="modal-content">
                <h3>🩺 ពិនិត្យសុខភាពប្រព័ន្ធ</h3>
                <DeviceInfoLine id="healthDeviceInfo" />
                <div id="healthCheckList" className="health-list">
                    <HealthCheckList />
                </div>
                <HealthAdviceBox />
                <p className="health-note">
                    បណ្ដាញ/គណនីប្ដូរ ➜ ពិនិត្យថ្មី · ផ្ទៀងផ្ទាត់រៀងរាល់ 30 វិនាទីពេលប្រអប់បើក។{' '}
                    <b>មិនកែទិន្នន័យកញ្ចប់ ឬលុយ</b>
                    {' '}— ពិនិត្យការតភ្ជាប់ និងការផ្ទុកក្នុងឧបករណ៍។
                </p>
                <div className="modal-btns">
                    <button className="btn-confirm" id="healthRecheckBtn" disabled={busy} onClick={onAct("runHealthCheck")}>ពិនិត្យម្តងទៀត</button>
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["healthCheckModal"] })}>បិទ</button>
                </div>
            </div>
        </Modal>
    );
}
