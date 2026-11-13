import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PalmSignQueueModal } from '../../../ZoeW/src/app/components/modals/PalmSignQueueModal';
import { palmSignOutboxState } from '../../../ZoeW/src/features/palm-sign-outbox';
import { securityState } from '../../../ZoeW/src/core/state';
import { palmSignExifShot } from '../../../ZoeW/src/services/palm-sign-camera';
vi.mock('../../../ZoeW/src/features/palm-sign-outbox', async () => {
  const { createStore } = await import('../../../ZoeW/src/core/store');
  return { palmSignOutboxState: createStore('calendar-probe', { rows: [], recoveryRows: [], message: '' }), refreshPalmSignQueue: vi.fn(), actOnQueuedSign: vi.fn(), requestDiscardUnreadablePalmSignJobs: vi.fn() };
});
vi.mock('../../../ZoeW/src/features/queued-sign-photo', () => ({ exportQueuedSignPhoto: vi.fn() }));
vi.mock('../../../ZoeW/src/app/components/modals/Modal', () => ({ Modal: ({ children }) => <div>{children}</div> }));

describe('ផ្ទៀងឯករាជ្យ៖ ថ្ងៃក្នុង UI និង EXIF', () => {
  it.each([
    Date.UTC(2026, 11, 31, 17),
    Date.UTC(2028, 1, 28, 17),
    Date.UTC(2026, 2, 8, 7),
    Date.UTC(2026, 10, 1, 6)
  ])('កាលកំណត់លុបរូប %s បង្ហាញម៉ោងកម្ពុជា', cleanupAt => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    palmSignOutboxState.rows = [];
    palmSignOutboxState.recoveryRows = [{ id: 'synthetic', code: 'SYNTHETIC', phase: 'action', recovery: true, busy: false, signed: true, photoVerified: true, cleanupAt, message: '' }];
    const html = renderToStaticMarkup(createElement(PalmSignQueueModal));
    expect(html).toContain('SYNTHETIC');
    expect(html).toContain('លុបអចិន្ត្រៃយ៍៖ ' + new Date(cleanupAt).toLocaleString('km-KH', { timeZone: 'Asia/Phnom_Penh' }));
  });
  for (const time of ['2026:02:29 09:00:00', '2026:02:31 09:00:00', '2026:04:31 09:00:00', '2100:02:29 09:00:00']) {
    it.each(['', '+07:00'])('EXIF ថ្ងៃមិនមាន ' + time + ' offset=%s មិនក្លាយជាថ្ងៃពិត', offset => {
      const shot = palmSignExifShot({ time, offset, lat: 11.5, lng: 104.9 });
      expect(shot).toEqual({ lines: [], at: 0 });
    });
  }
  it.each(['', '+07:00'])('EXIF ថ្ងៃលោតត្រឹមត្រូវរក្សា epoch (offset=%s)', offset => {
    const shot = palmSignExifShot({ time: '2028:02:29 09:00:00', offset, lat: 11.5, lng: 104.9 });
    expect(shot.at).toBe(Date.UTC(2028, 1, 29, 2));
    expect(shot.lines[0]).toBe('2028-02-29 09:00:00');
    expect(shot.lines[1]).toBe('11.50000, 104.90000');
  });
  it.each(['2026:13:01 09:00:00', '2026:02:00 09:00:00', '2026:02:28 24:00:00', 'bad'])('EXIF format/range control %s', time => {
    expect(palmSignExifShot({ time, offset: '+07:00', lat: 11.5, lng: 104.9 })).toEqual({ lines: [], at: 0 });
  });
});
