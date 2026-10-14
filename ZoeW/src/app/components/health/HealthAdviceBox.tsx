import { uiState } from '../../../core/state';
import { HEALTH_ICONS } from '../../../features/health-check';
import { useStore } from '../../hooks/useStore';

export function HealthAdviceBox() {
    useStore(uiState);
    const advice = uiState.healthAdvice;
    if (!advice) return null;
    const known = !!HEALTH_ICONS[advice.level];
    return (
        <div id="healthAdvice" className={'health-advice health-' + (known ? advice.level : 'info')}>
            <div className="health-advice-head">
                <span className="health-ico">🧠</span>
                <span>{(known ? HEALTH_ICONS[advice.level] : HEALTH_ICONS.info) + ' ' + advice.title}</span>
            </div>
            {advice.steps.length ? (
                <ol className="health-advice-steps">
                    {advice.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
            ) : null}
            {advice.healed.length ? (
                <span className="health-advice-healed">{'ជួរ ' + advice.healed.join(' · ') + ' នឹងជាវិញដោយខ្លួនឯងក្រោយជំហានខាងលើ — មិនចាំបាច់ធ្វើអ្វីលើវាទេ។'}</span>
            ) : null}
        </div>
    );
}
