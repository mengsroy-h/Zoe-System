export function BiometricLabel({ busy }: { busy: boolean }) {
    return (
        <>
            <span className="bio-ico" aria-hidden="true">🫆</span>
            <span className="bio-label">{busy ? 'កំពុងស្កេន...' : 'ស្កេនក្រយៅដៃ ឬមុខ'}</span>
        </>
    );
}
