/** ទិន្នន័យសាកល្បងដែល *គ្រប* សាខាទាំងអស់នៃការគូរជួរដេក។ */
export function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const CALL_MARKS = [undefined, 'no-answer', 'no-connect', 'wrong-number'];
const LOCKERS = [undefined, '', 'A1', 'B12', 'VIP-3'];
const PHONES = ['012345678', '0977777777', 'គ្មានលេខ', '0" onmouseover="alert(1)', "<script>x</script>"];

export function makeItem(rand: () => number, i: number) {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
    const barcodeCount = Math.floor(rand() * 4);
    const barcodes = barcodeCount === 0 ? undefined : Array.from({ length: barcodeCount }, (_, b) => ({
        code: `BC${i}${b}`,
        cod: Math.round(rand() * 5000) / 100,
        dod: rand() < 0.5 ? 0 : Math.round(rand() * 900) / 100,
        locker: pick(LOCKERS),
        isClosed: rand() < 0.4,
        isDeducted: false
    }));
    const isClosed = barcodes ? barcodes.every((b) => b.isClosed) : rand() < 0.3;
    return {
        id: `item-${i}`,
        phone: pick(PHONES),
        cod: Math.round(rand() * 4000) / 100,
        dod: rand() < 0.5 ? 0 : Math.round(rand() * 900) / 100,
        count: barcodeCount || 1,
        barcodes,
        locker: pick(LOCKERS),
        isClosed,
        isCalled: rand() < 0.5,
        callMark: pick(CALL_MARKS),
        callMarkTime: rand() < 0.5 ? Date.now() - 5 * 60 * 60 * 1000 : undefined,
        createdAt: Date.now() - Math.floor(rand() * 72) * 60 * 60 * 1000,
        time: rand() < 0.2 ? '' : `10:30:0${i % 10} (2026-09-1${i % 10})`
    };
}
