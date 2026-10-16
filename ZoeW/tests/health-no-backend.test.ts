/**
 * ⛔ 🩺 ពិនិត្យសុខភាព ពេល App ទើបដំឡើង មិនទាន់ភ្ជាប់ Server ណាមួយ (សំណើម្ចាស់គម្រោង ៖ «ក្នុង ពិនិត្យសុខភាព ប្រាប់តែពីរបៀបភ្ជាប់ firebase
 *    ទាំងដែល app បច្ចុប្បន្ន គាំទ្រ beckend ដល់ទៅ 2») ៖ គ្មាន `zoew_firebase_config` ➜ ជួរ Server និង 💡 ការណែនាំ ត្រូវរាយផ្លូវទាំង ២ (Firebase · Supabase)
 *    ជួរអាជ្ញាប័ណ្ណមិនទាមទារ Activation Key (Supabase គ្មាន Key) · Config រក្សាទុករួច ➜ ប្រាប់តែ Server នោះ (ឈ្មោះដេរីវេពី Config ដែលរក្សាទុក
 *    មិនមែនពី `viewState.backendKind` ដែលនៅ `firebase` រហូតដល់ SDK ផ្ទុករួច)។
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { runHealthCheck } from '../src/features/health-check';

const CONFIG_KEY = 'zoew_firebase_config';
const FIREBASE_CONFIG = { apiKey: 'AIzaSyTEST000000000000000000000000000', authDomain: 'demo-zoe.firebaseapp.com', databaseURL: 'https://demo-zoe-default-rtdb.firebaseio.com', projectId: 'demo-zoe' };
const SUPABASE_CONFIG = { supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_TEST000000000000' };

async function measure() {
    uiState.modalDisplay = { healthCheckModal: 'flex' };
    uiState.modalStack = ['healthCheckModal'];
    uiState.isModalOpen = true;
    await runHealthCheck();
    const rows = uiState.healthRows as Array<{ state: string; label: string; detail: string }>;
    return { rows, advice: uiState.healthAdvice as { level: string; title: string; steps: string[]; healed: string[] } };
}

const databaseRow = (rows) => rows[1];
const licenseRow = (rows) => rows[3];

beforeEach(() => {
    window.localStorage.removeItem(CONFIG_KEY);
    viewState.backendKind = 'firebase';
    firebaseState.isDatabaseConnected = false;
    firebaseState.hasEverConnectedToDatabase = false;
    firebaseState.fb = null;
    firebaseState.auth = null;
    (window as any).ZoeLicense = { getStatus: () => Promise.resolve({ state: 'required' }) };
});

afterEach(() => {
    window.localStorage.removeItem(CONFIG_KEY);
    viewState.backendKind = 'firebase';
    delete (window as any).ZoeLicense;
    uiState.modalDisplay = {};
    uiState.modalStack = [];
    uiState.isModalOpen = false;
});

describe('⛔ 🩺 មិនទាន់ភ្ជាប់ Server ➜ ប្រាប់ផ្លូវទាំង ២ (Firebase · Supabase)', () => {
    it('គ្មាន Config ➜ ជួរ Server ❌ រាយ Firebase និង Supabase · 💡 ជំហានទី ១ = Config ដែលរាយផ្លូវទាំង ២', async () => {
        const { rows, advice } = await measure();
        expect(rows.length).toBe(9);
        const db = databaseRow(rows);
        expect(db.state).toBe('bad');
        const dbText = db.label + ' ' + db.detail;
        expect(dbText).toMatch(/Firebase/);
        expect(dbText).toMatch(/Supabase/);
        expect(advice.level).toBe('bad');
        expect(advice.steps[0]).toMatch(/Config/);
        expect(advice.steps[0]).toMatch(/Firebase/);
        expect(advice.steps[0]).toMatch(/Supabase/);
    });

    it('គ្មាន Config ➜ ជួរអាជ្ញាប័ណ្ណមិនទាមទារ Activation Key តែឯង (Supabase គ្មាន Key) · 💡 មិនប្រាប់ឲ្យសុំ Key', async () => {
        const { rows, advice } = await measure();
        const lic = licenseRow(rows);
        expect(lic.state).toBe('info');
        expect(lic.detail).toMatch(/Activation Key/);
        expect(lic.detail).toMatch(/Supabase/);
        expect(advice.steps.join(' | ')).not.toMatch(/សុំ Key/);
    });

    it('ទិសផ្ទុយ ៖ Config Firebase រក្សាទុក មិនដែលភ្ជាប់ ➜ ប្រាប់តែ Firebase · Activation Key នៅទាមទារ', async () => {
        window.localStorage.setItem(CONFIG_KEY, JSON.stringify(FIREBASE_CONFIG));
        const { rows, advice } = await measure();
        const db = databaseRow(rows);
        expect(db.label).toBe('Firebase');
        expect(db.state).toBe('bad');
        expect(advice.steps[0]).toMatch(/Firebase/);
        expect(advice.steps[0]).not.toMatch(/Supabase/);
        const lic = licenseRow(rows);
        expect(lic.state).toBe('bad');
        expect(lic.detail).toMatch(/Activation Key/);
    });

    it('Config Supabase រក្សាទុក តែ SDK មិនទាន់ផ្ទុក (backendKind នៅ firebase) ➜ ជួរ Supabase · ជួរហាង មិនមែន Activation Key', async () => {
        window.localStorage.setItem(CONFIG_KEY, JSON.stringify(SUPABASE_CONFIG));
        const { rows, advice } = await measure();
        const db = databaseRow(rows);
        expect(db.label).toBe('Supabase');
        expect(advice.steps[0]).toMatch(/Supabase/);
        expect(advice.steps[0]).not.toMatch(/Firebase/);
        const lic = licenseRow(rows);
        expect(lic.label).toBe('ហាង (Supabase)');
        expect(lic.detail).not.toMatch(/Activation Key/);
    });
});
