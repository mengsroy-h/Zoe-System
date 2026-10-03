import { useLayoutEffect } from 'react';
import { AppShell } from './components/AppShell';
import { DocumentEffects } from './components/shell/DocumentEffects';
import { PtrIndicator } from './components/shell/PtrIndicator';
import { SafeAreaProbe } from './components/shell/SafeAreaProbe';
import { ScrollThumb } from './components/shell/ScrollThumb';
import { UpdateBanner } from './components/shell/UpdateBanner';
import { bootApplication } from './lifecycle/boot';
import { createLifecycleScope } from './lifecycle/scope';

export function App() {
    useLayoutEffect(() => {
        const scope = createLifecycleScope();
        queueMicrotask(() => {
            if (!scope.disposed) bootApplication(scope);
        });
        return () => scope.dispose();
    }, []);

    return (
        <>
            <AppShell />
            <DocumentEffects />
            <UpdateBanner />
            <PtrIndicator />
            <ScrollThumb />
            <SafeAreaProbe />
        </>
    );
}
