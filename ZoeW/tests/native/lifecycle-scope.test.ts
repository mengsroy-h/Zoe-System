/**
 * ⛔ `LifecycleScope` ជាអ្វីដែលធ្វើឲ្យ boot ទ្រាំនឹង unmount/remount (StrictMode ·
 *    HMR) ៖ listener និង interval ដែលចុះឈ្មោះត្រូវ **ដកចេញពិត** ពេល dispose
 *    ហើយការចាប់ផ្តើមម្តងក្នុងមួយអាយុទំព័រ មិនត្រូវរត់ ២ ដង។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLifecycleScope, oncePerPage } from '../../src/app/lifecycle/scope';

afterEach(() => { vi.useRealTimers(); });

describe('LifecycleScope', () => {
    it('dispose ដក listener ចេញពិត (រួម capture)', () => {
        const scope = createLifecycleScope();
        const target = new EventTarget();
        const plain = vi.fn();
        const captured = vi.fn();
        scope.listen(target, 'ping', plain);
        scope.listen(target, 'ping', captured, { capture: true });
        target.dispatchEvent(new Event('ping'));
        expect(plain).toHaveBeenCalledTimes(1);
        expect(captured).toHaveBeenCalledTimes(1);
        scope.dispose();
        target.dispatchEvent(new Event('ping'));
        expect(plain).toHaveBeenCalledTimes(1);
        expect(captured).toHaveBeenCalledTimes(1);
    });

    it('dispose បញ្ឈប់ interval', () => {
        vi.useFakeTimers();
        const scope = createLifecycleScope();
        const tick = vi.fn();
        scope.every(1000, tick);
        vi.advanceTimersByTime(3000);
        expect(tick).toHaveBeenCalledTimes(3);
        scope.dispose();
        vi.advanceTimersByTime(5000);
        expect(tick).toHaveBeenCalledTimes(3);
    });

    it('onLoad រត់ភ្លាមពេលឯកសារផ្ទុករួច (load មិនមកម្តងទៀតទេ)', () => {
        const scope = createLifecycleScope();
        const fn = vi.fn();
        expect(document.readyState).toBe('complete');
        scope.onLoad(fn);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('ក្រោយ dispose ការចុះឈ្មោះថ្មីគ្មានប្រសិទ្ធភាព · onDispose រត់ភ្លាម', () => {
        const scope = createLifecycleScope();
        scope.dispose();
        expect(scope.disposed).toBe(true);
        const target = new EventTarget();
        const fn = vi.fn();
        scope.listen(target, 'ping', fn);
        target.dispatchEvent(new Event('ping'));
        expect(fn).not.toHaveBeenCalled();
        const late = vi.fn();
        scope.onDispose(late);
        expect(late).toHaveBeenCalledTimes(1);
    });

    it('ការសម្អាតមួយធ្លាក់ មិនបញ្ឈប់ការសម្អាតដទៃ', () => {
        const scope = createLifecycleScope();
        const after = vi.fn();
        scope.onDispose(after);
        scope.onDispose(() => { throw new Error('boom'); });
        expect(() => scope.dispose()).not.toThrow();
        expect(after).toHaveBeenCalledTimes(1);
    });

    it('oncePerPage រត់តែម្តងក្នុងមួយអាយុទំព័រ ទោះ scope ថ្មី', () => {
        const fn = vi.fn();
        oncePerPage('test-once', fn);
        oncePerPage('test-once', fn);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
