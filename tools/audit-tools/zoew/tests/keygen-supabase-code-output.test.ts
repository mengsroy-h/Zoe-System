import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { expect, it, vi } from 'vitest';

const source = readFileSync(resolve(__dirname, '../../../../ZoeKeyGen/app.js'), 'utf8');
const ast: any = parse(source, { ecmaVersion: 'latest' });
const names = new Set(['sbIssueInvite', 'renderSbInviteResult', 'sbIssueResetCode', 'copySbInviteCode', 'copySbInviteLink', 'saveSbInviteQr', 'copySbResetCode']);
const code = ast.body.filter((n: any) => n.type === 'FunctionDeclaration' && names.has(n.id.name)).map((n: any) => source.slice(n.start, n.end)).join('\n');

function harness() {
    const elements = new Map<string, HTMLElement>();
    const element = (id: string): HTMLElement => {
        if (!elements.has(id)) elements.set(id, document.createElement('div'));
        return elements.get(id)!;
    };
    const copied: string[] = [], saved: string[] = [];
    const session = {};
    const ctx: any = {
        document: { getElementById: element }, sbLastInvite: null, sbLastResetCode: '',
        sbAdminSession: session, sbAdminBusy: false, SB_RESET_VALID_HOURS: 1, SB_INVITE_VALID_HOURS: 1,
        sbAdminIsCurrent: (s: object) => s === ctx.sbAdminSession,
        sbAdminWrite: async (_s: object, action: () => Promise<void>) => action(),
        sbInputValue: () => 'synthetic.user', sbAdminErrorText: () => 'synthetic error',
        sbAdminRpc: vi.fn(async () => ({ ok: true, body: [{ code: 'SYNTHETIC-FIRST', expires_at: '2099-01-01T00:00:00Z' }] })),
        sbInviteSetupLink: (_s: object, c: string) => 'https://example.test/#synthetic=' + c,
        renderQrInto: (el: HTMLElement) => { el.innerHTML = '<svg></svg>'; },
        copySensitiveText: async (text: string, current: () => boolean) => { if (text && current()) copied.push(text); },
        saveQrImage: (text: string) => { if (text) saved.push(text); },
        alert: vi.fn(), confirm: () => true, showToast: vi.fn()
    };
    runInNewContext(code, ctx);
    return { ctx, session, element, copied, saved };
}

it('ចេញកូដអញ្ជើញបន្ទាប់លុបកូដ Link និង QR មុនពេលរង់ចាំ ហើយមិនទុករបស់ហាងមុនពេលបរាជ័យ', async () => {
    const h = harness();
    await h.ctx.sbIssueInvite(h.session, { id: 'first', name: 'ហាងទីមួយ' }, 'owner');
    await h.ctx.copySbInviteCode();
    await h.ctx.copySbInviteLink();
    h.ctx.saveSbInviteQr();
    expect(h.copied).toHaveLength(2); expect(h.saved).toHaveLength(1);
    let settle!: (value: any) => void;
    h.ctx.sbAdminRpc.mockImplementation(() => new Promise(r => { settle = r; }));
    const pending = h.ctx.sbIssueInvite(h.session, { id: 'second', name: 'ហាងទីពីរ' }, 'member');
    expect(h.ctx.sbLastInvite).toBeNull();
    expect(h.element('sbInviteResultBox').classList.contains('hidden')).toBe(true);
    expect(h.element('sbInviteCodeText').textContent).toBe('');
    expect(h.element('sbInviteLinkText').textContent).toBe('');
    expect(h.element('sbInviteQrContainer').innerHTML).toBe('');
    settle({ ok: false, status: 503, body: null }); await pending;
    await h.ctx.copySbInviteCode(); await h.ctx.copySbInviteLink(); h.ctx.saveSbInviteQr();
    expect(h.copied).toHaveLength(2); expect(h.saved).toHaveLength(1);
});

it('ចេញកូដប្ដូរពាក្យសម្ងាត់បន្ទាប់មិនទុកកូដមុនអាចចម្លង ពេលសំណើរង់ចាំ ឬបរាជ័យ', async () => {
    const h = harness();
    await h.ctx.sbIssueResetCode(); await h.ctx.copySbResetCode();
    expect(h.copied).toEqual(['SYNTHETIC-FIRST']);
    let settle!: (value: any) => void;
    h.ctx.sbAdminRpc.mockImplementation(() => new Promise(r => { settle = r; }));
    const pending = h.ctx.sbIssueResetCode();
    expect(h.ctx.sbLastResetCode).toBe('');
    expect(h.element('sbResetCodeText').textContent).toBe('');
    expect(h.element('sbResetResultBox').classList.contains('hidden')).toBe(true);
    settle({ ok: false, status: 503, body: null }); await pending;
    await h.ctx.copySbResetCode(); expect(h.copied).toEqual(['SYNTHETIC-FIRST']);
});

it('ការចេញជោគជ័យជំនួសកូដ Link និង QR ដោយលទ្ធផលថ្មីតែប៉ុណ្ណោះ', async () => {
    const h = harness();
    await h.ctx.sbIssueInvite(h.session, { id: 'first', name: 'ហាងទីមួយ' }, 'owner');
    await h.ctx.sbIssueResetCode();
    h.ctx.sbAdminRpc.mockResolvedValue({ ok: true, body: [{ code: 'SYNTHETIC-SECOND', expires_at: '2099-01-02T00:00:00Z' }] });
    await h.ctx.sbIssueInvite(h.session, { id: 'second', name: 'ហាងទីពីរ' }, 'member');
    await h.ctx.sbIssueResetCode();
    await h.ctx.copySbInviteCode(); await h.ctx.copySbInviteLink(); h.ctx.saveSbInviteQr(); await h.ctx.copySbResetCode();
    expect(h.copied).toEqual(['SYNTHETIC-SECOND', 'https://example.test/#synthetic=SYNTHETIC-SECOND', 'SYNTHETIC-SECOND']);
    expect(h.saved).toEqual(['https://example.test/#synthetic=SYNTHETIC-SECOND']);
    expect(h.element('sbInviteCodeText').textContent).toBe('SYNTHETIC-SECOND');
    expect(h.element('sbInviteResultLabel').textContent).toContain('ហាងទីពីរ');
    expect(h.element('sbResetCodeText').textContent).toBe('synthetic.user ➜ SYNTHETIC-SECOND');
    expect(h.element('sbInviteResultBox').classList.contains('hidden')).toBe(false);
    expect(h.element('sbInviteQrSaveBtn').classList.contains('hidden')).toBe(false);
    expect(h.element('sbResetResultBox').classList.contains('hidden')).toBe(false);
});

it('បណ្ដាញបាត់ចម្លើយមិនស្ដារកូដពីសំណើមុន', async () => {
    const h = harness();
    await h.ctx.sbIssueInvite(h.session, { id: 'first', name: 'ហាងទីមួយ' }, 'owner');
    await h.ctx.sbIssueResetCode();
    h.ctx.sbAdminRpc.mockRejectedValue(new Error('synthetic response lost'));
    await expect(h.ctx.sbIssueInvite(h.session, { id: 'second', name: 'ហាងទីពីរ' }, 'member')).rejects.toThrow('synthetic response lost');
    await h.ctx.sbIssueResetCode();
    await h.ctx.copySbInviteCode(); await h.ctx.copySbInviteLink(); h.ctx.saveSbInviteQr(); await h.ctx.copySbResetCode();
    expect(h.copied).toEqual([]); expect(h.saved).toEqual([]);
    expect(h.ctx.sbLastInvite).toBeNull(); expect(h.ctx.sbLastResetCode).toBe('');
});

it('ការបោះបង់ ឬសម័យចាស់មិនលុបលទ្ធផលជោគជ័យបច្ចុប្បន្ន', async () => {
    const h = harness();
    await h.ctx.sbIssueInvite(h.session, { id: 'first', name: 'ហាងទីមួយ' }, 'owner');
    await h.ctx.sbIssueResetCode();
    h.ctx.confirm = () => false;
    await h.ctx.sbIssueResetCode();
    await h.ctx.sbIssueInvite({}, { id: 'second', name: 'ហាងទីពីរ' }, 'member');
    expect(h.ctx.sbLastInvite.code).toBe('SYNTHETIC-FIRST');
    expect(h.ctx.sbLastResetCode).toBe('SYNTHETIC-FIRST');
    expect(h.ctx.sbAdminRpc).toHaveBeenCalledTimes(2);
});
