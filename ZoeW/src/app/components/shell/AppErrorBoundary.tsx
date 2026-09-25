import { Component, type ReactNode } from 'react';

/**
 * ⛔ App React ៖ កំហុសក្នុង render **មួយ** (ឧ. ទិន្នន័យ Firebase ដែលមានរូបរាងមិនរំពឹង) unmount ដើមឈើ **ទាំងមូល**
 *    ➜ អេក្រង់ស គ្មានប៊ូតុង គ្មានសារ។ App ដើម (vanilla) មិនដែលសដោយកំហុសតែមួយទេ (DOM នៅដដែល)។
 *    ➜ ព្រំដែននេះជំនួសអេក្រង់សដោយសារ និងប៊ូតុងផ្ទុកឡើងវិញ។ កំហុសខ្លួនវាត្រូវរាយការណ៍តាម `onCaughtError`
 *    របស់ `createRoot()` (`main.tsx`) ➜ `reportError()` ➜ Sentry និងអ្នកស្តាប់ `error` ឃើញវាដូចមុន។
 * ⛔ សារមិនសន្យាថា «ទិន្នន័យមិនបាត់» ៖ ការសរសេរដែលនៅក្នុងជួរក្រៅបណ្តាញ អាចមិនទាន់ចុះ។
 */
interface Props { children: ReactNode }
interface State { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
    state: State = { failed: false };

    static getDerivedStateFromError(): State {
        return { failed: true };
    }

    render(): ReactNode {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="app-crash" id="appCrashFallback" role="alert">
                <div className="app-crash-card">
                    <p className="app-crash-title">⚠️ App ជួបបញ្ហាក្នុងការបង្ហាញ</p>
                    <p className="app-crash-body">សូមផ្ទុក App ឡើងវិញ។ បើបញ្ហានៅតែកើត សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយផ្ទុកម្តងទៀត។</p>
                    <button type="button" className="app-crash-reload" onClick={() => window.location.reload()}>🔄 ផ្ទុក App ឡើងវិញ</button>
                </div>
            </div>
        );
    }
}
