import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppErrorBoundary } from './app/components/shell/AppErrorBoundary';
import { ROOT_ERROR_OPTIONS } from './app/root-errors';
import './styles/app.css';
import './styles/react-root.css';
import './styles/native.css';

const host = document.getElementById('root');
if (!host) throw new Error('#root missing from index.html');

if (import.meta.env.VITE_EXPOSE_GLOBALS === '1') {
    import('./expose-globals').then((m) => m.exposeGlobals());
}

const app = <AppErrorBoundary><App /></AppErrorBoundary>;
const tree = import.meta.env.DEV ? <StrictMode>{app}</StrictMode> : app;
createRoot(host, ROOT_ERROR_OPTIONS).render(tree);
