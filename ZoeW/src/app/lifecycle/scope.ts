/**
 * «វិសាលភាព lifecycle» ៖ រាល់ listener · interval · ការរង់ចាំ `load` ដែលដំណាក់
 * boot បង្កើត ត្រូវចុះឈ្មោះទីនេះ ➜ `dispose()` ដកវាចេញវិញទាំងអស់ពេល component
 * unmount (StrictMode · HMR · តេស្ត)។
 *
 * ⛔ **២ ប្រភេទនៃការចាប់ផ្តើម** ៖
 *    - **ដកវិញបាន** (listener · interval ដែលដំណាក់ boot ចាក់ផ្ទាល់) ➜ `listen()` ·
 *      `every()` ➜ ដកចេញពេល dispose ហើយចាក់ឡើងវិញពេល mount ម្តងទៀត។
 *    - **ម្តងក្នុងមួយអាយុទំព័រ** (`initFirebase()` · កាយវិការ · PTR …) ➜
 *      `oncePerPage()` ៖ វាចាក់ listener ខាងក្នុងខ្លួនដែលដកវិញមិនបាន ➜ ការរត់
 *      ២ ដង = listener ស្ទួន = សកម្មភាពរត់ ២ ដង (`listener-leak-test`)។
 * ⛔ កុំដាក់ការងារ «ម្តងក្នុងមួយអាយុទំព័រ» ក្នុង `listen()` ហើយកុំដាក់
 *    listener ដែលដកវិញបានក្នុង `oncePerPage()` — វានឹងបាត់ក្រោយ remount។
 */
export interface LifecycleScope {
    readonly disposed: boolean;
    listen(target: EventTarget | null | undefined, type: string, handler: any, options?: boolean | AddEventListenerOptions): void;
    every(ms: number, fn: () => void): void;
    onLoad(fn: () => void): void;
    onDispose(fn: () => void): void;
    dispose(): void;
}

export function createLifecycleScope(): LifecycleScope {
    const cleanups: Array<() => void> = [];
    let disposed = false;

    const scope: LifecycleScope = {
        get disposed() { return disposed; },
        listen(target, type, handler, options) {
            if (disposed || !target) return;
            target.addEventListener(type, handler, options);
            const capture = typeof options === 'boolean' ? options : !!(options && options.capture);
            cleanups.push(() => target.removeEventListener(type, handler, capture));
        },
        every(ms, fn) {
            if (disposed) return;
            const id = setInterval(fn, ms);
            cleanups.push(() => clearInterval(id));
        },
        onLoad(fn) {
            if (disposed) return;
            // ⛔ `load` អាចបាញ់រួច **មុន** React mount (chunk យឺត) ➜ រត់ភ្លាម
            //    ជំនួសការរង់ចាំព្រឹត្តិការណ៍ដែលនឹងមិនមកទៀត។
            if (document.readyState === 'complete') { fn(); return; }
            const once = () => {
                window.removeEventListener('load', once);
                if (!disposed) fn();
            };
            window.addEventListener('load', once);
            cleanups.push(() => window.removeEventListener('load', once));
        },
        onDispose(fn) {
            if (disposed) { fn(); return; }
            cleanups.push(fn);
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            while (cleanups.length) {
                const fn = cleanups.pop();
                try { fn(); } catch { /* ការសម្អាតមួយធ្លាក់ មិនត្រូវបញ្ឈប់ការសម្អាតដទៃ */ }
            }
        }
    };
    return scope;
}

const ranThisPage = new Set<string>();

export function oncePerPage(key: string, fn: () => void): void {
    if (ranThisPage.has(key)) return;
    ranThisPage.add(key);
    fn();
}
