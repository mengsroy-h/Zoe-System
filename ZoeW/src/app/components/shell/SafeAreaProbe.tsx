import { isNativeAndroid } from '../../../platform/native';
import { refTo } from '../../refs';

const PROBE_STYLE = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: 0,
    visibility: 'hidden',
    pointerEvents: 'none',
    paddingTop: 'env(safe-area-inset-top)'
} as const;

/**
 * ធាតុវាស់ `env(safe-area-inset-top)` (App Android តែប៉ុណ្ណោះ) ៖ `statusBarInsetPx()` អាន
 * `padding-top` ដែល browser គណនា ➜ ពណ៌រូបតំណាងរបាស្ថានភាព។
 * ⛔ មើលមិនឃើញ · មិនលេបការចុច · គ្មានទំហំ ➜ មិនប៉ះ layout · ⛔ web មិនគូរវាទេ (DOM ដូចដើម)។
 */
export function SafeAreaProbe() {
    if (!isNativeAndroid()) return null;
    return <div aria-hidden="true" ref={refTo('safeAreaProbe')} style={PROBE_STYLE}></div>;
}
