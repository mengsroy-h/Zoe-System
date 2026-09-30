export function withTimeout<T>(promise: Promise<T>, ms: number, reason: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const guard = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(reason)), ms);
    });
    return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}
