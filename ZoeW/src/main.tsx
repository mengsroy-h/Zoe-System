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

// ⛔ គ្មាន <StrictMode> ក្នុងផលិតកម្ម ៖ វាដំណើរការ effect **ពីរដង** ក្នុង dev។
//    ដំណាក់ boot ទ្រាំនឹងវាដោយរចនាសម្ព័ន្ធ ៖ listener/interval ដែលដកវិញបាន
//    ឆ្លងកាត់ `LifecycleScope` ហើយការចាប់ផ្តើមម្តងក្នុងមួយអាយុទំព័រ (Firebase ·
//    កាយវិការ · PTR) ឆ្លងកាត់ `oncePerPage()` (មើល `app/lifecycle/scope.ts`)។
// ⛔ build វាស់តែប៉ុណ្ណោះ (មើល `src/expose-globals.ts`) — Vite ជំនួសលក្ខខណ្ឌជា
//    `false` ពេល build ធម្មតា ➜ ម៉ូឌុលនោះមិនចូល bundle ផលិតកម្មទេ។
if (import.meta.env.VITE_EXPOSE_GLOBALS === '1') {
    import('./expose-globals').then((m) => m.exposeGlobals());
}

const app = <AppErrorBoundary><App /></AppErrorBoundary>;
const tree = import.meta.env.DEV ? <StrictMode>{app}</StrictMode> : app;
createRoot(host, ROOT_ERROR_OPTIONS).render(tree);
