import { Component, type ReactNode } from 'react';

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
