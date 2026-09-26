import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.zoesystem.zoew',
    appName: 'ZoeW',
    webDir: 'dist',
    android: {
        allowMixedContent: false,
        webContentsDebuggingEnabled: false
    },
    plugins: {
        SystemBars: {
            insetsHandling: 'native',
            initialViewportFitValueHint: 'cover',
            style: 'LIGHT'
        },
        SplashScreen: {
            launchShowDuration: 400,
            launchAutoHide: true,
            backgroundColor: '#f8fafc',
            showSpinner: false,
            androidScaleType: 'CENTER_INSIDE'
        }
    }
};

export default config;
