/**
 * ទម្រង់សកលដែល App ពឹងលើ តែមិនបានបង្កើតដោយខ្លួនឯង។
 * ពួកវាផ្ទុកដោយ `<script>` ដាច់ដោយឡែក (CSP-safe · cache បាន · ក្រៅបណ្តាញបាន)
 * ដូច្នេះវាមិនមែនជា npm dependency ទេ — មើល `docs/ARCHITECTURE.md` ផ្នែក ៤។
 */

interface ZoeErrorsApi {
    capture(error: unknown, context?: Record<string, unknown>): void;
    setUser?(user: unknown): void;
    redactDeep?(value: unknown): unknown;
    [key: string]: any;
}

interface ZoeLicenseApi {
    getStatus(...args: any[]): any;
    activate(...args: any[]): any;
    checkOnline(...args: any[]): any;
    syncServerTime(...args: any[]): any;
    [key: string]: any;
}

declare global {
    interface Window {
        ZoeErrors?: ZoeErrorsApi;
        ZoeLicense?: ZoeLicenseApi;
        firebaseSDK?: any;
        XLSX?: any;
        ZXingWASM?: any;
        Sentry?: any;
        BarcodeDetector?: any;
        visualViewport?: VisualViewport | null;
        standalone?: boolean;
        opera?: any;
        MSStream?: any;
        webkitAudioContext?: typeof AudioContext;
        mozRequestAnimationFrame?: typeof requestAnimationFrame;
    }

    interface Navigator {
        connection?: any;
        mozConnection?: any;
        webkitConnection?: any;
        standalone?: boolean;
    }

    const ZoeErrors: ZoeErrorsApi | undefined;
    const ZoeLicense: ZoeLicenseApi | undefined;
    const XLSX: any;
    const ZXingWASM: any;
    const Sentry: any;
    const BarcodeDetector: any;

    /** ចាក់ដោយ Vite `define` ➜ ដេរីវេពី `src/core/version.ts` ពិត។ */
    const __APP_VERSION__: string;
    const __CACHE_VERSION__: string;
    const __FCM_CONFIGURED__: boolean;
}

export {};
