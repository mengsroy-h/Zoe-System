import { documentLoadComplete } from '../platform/document-io';

/**
 * ⛔ `app.js` ដើមផ្ទុកជា `<script>` នៅចុង `<body>` ➜ វាតែងតែឈរ **មុន**
 * ព្រឹត្តិការណ៍ `load`។ ក្នុង React ការចាប់ផ្តើមអាចកើតឡើង *ក្រោយ* `load`
 * (chunk យឺត) ➜ អ្នកស្តាប់ `load` នឹង **មិនបាញ់ជារៀងរហូត** ➜ App
 * មិនចាប់ផ្តើមសោះ ដោយស្ងាត់។
 *
 * `runOnWindowLoad()` លុបថ្នាក់កំហុសនោះតាម **រចនាសម្ព័ន្ធ** ៖ ផ្ទុករួចហើយ
 * ➜ រត់ភ្លាម; មិនទាន់ ➜ ចាំដដែល។
 */
export function runOnWindowLoad(fn: () => void): void {
    if (documentLoadComplete()) {
        fn();
        return;
    }
    const once = () => {
        window.removeEventListener('load', once);
        fn();
    };
    window.addEventListener('load', once);
}
