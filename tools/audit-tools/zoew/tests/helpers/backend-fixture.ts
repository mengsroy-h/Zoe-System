export function setPartialBackendFixtureValue<T>(target: object, key: PropertyKey, value: T): T {
    if (!Reflect.set(target, key, value)) throw new TypeError('Partial backend fixture assignment failed');
    return value;
}

export function callPartialBackendFixtureMethod(target: object, key: PropertyKey, args: unknown[]): unknown {
    const method: unknown = Reflect.get(target, key);
    if (typeof method !== 'function') throw new TypeError('Partial backend fixture method is unavailable');
    return Reflect.apply(method, target, args);
}
