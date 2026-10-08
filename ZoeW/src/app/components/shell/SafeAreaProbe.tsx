import { isNativeAndroid } from '../../../platform/native';
import { refTo } from '../../refs';

const PROBE_STYLE = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: 0,
    visibility: 'hidden',
    pointerEvents: 'none',
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)'
} as const;

export function SafeAreaProbe() {
    if (!isNativeAndroid()) return null;
    return <div aria-hidden="true" ref={refTo('safeAreaProbe')} style={PROBE_STYLE}></div>;
}
