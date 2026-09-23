import { ToastList } from './toast/ToastList';

/** ម្ចាស់ផ្ទះរបស់ toast */
export function ToastContainer() {
    return (
        <div className="toast-container" id="toastContainer">
            <ToastList />
        </div>
    );
}
