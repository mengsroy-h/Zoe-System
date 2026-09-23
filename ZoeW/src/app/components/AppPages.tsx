import { PageData } from './PageData';
import { PageEntry } from './PageEntry';

/** កន្សោមរមូរខាងក្រៅតែមួយ (`#appPages`) — ⛔ PTR និង scroll-snap ពឹងលើវា។ */
export function AppPages() {
    return (
        <div className="app-pages" id="appPages">
            <PageData />
            <PageEntry />
        </div>
    );
}
