import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/app.css';
import './styles/react-root.css';

const host = document.getElementById('root');
if (!host) throw new Error('#root missing from index.html');

// ⛔ គ្មាន <StrictMode> ក្នុងផលិតកម្ម ៖ វាដំណើរការ effect **ពីរដង** ក្នុង dev
//    ហើយ bootstrap របស់ App ជា *ការចាប់ផ្តើមតែម្តង* (listener · timer ·
//    ការតភ្ជាប់ Firebase) ➜ ការរត់ ២ ដងបង្កើត listener ស្ទួន។ `App` ការពារ
//    ខ្លួនវាដោយ `booted` ref ហើយ StrictMode នៅបើកដដែលក្នុង dev ដើម្បីចាប់
//    កំហុសដទៃ។
// ⛔ build វាស់តែប៉ុណ្ណោះ (មើល `src/expose-globals.ts`) — Vite ជំនួសលក្ខខណ្ឌជា
//    `false` ពេល build ធម្មតា ➜ ម៉ូឌុលនោះមិនចូល bundle ផលិតកម្មទេ។
if (import.meta.env.VITE_EXPOSE_GLOBALS === '1') {
    import('./expose-globals').then((m) => m.exposeGlobals());
}

const tree = import.meta.env.DEV ? <StrictMode><App /></StrictMode> : <App />;
createRoot(host).render(tree);
