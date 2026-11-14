'use strict';

const functions = require('firebase-functions/v1');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getDatabaseWithUrl } = require('firebase-admin/database');
const { BUSINESS_ROOTS, createHandler, validateConfig, emulatorDatabaseUrl } = require('./business-audit.cjs');

let firebaseConfig = {};
try { firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}'); } catch (_) {}
const config = validateConfig({ projectId: process.env.ZOE_AUDIT_PROJECT_ID,
    instance: process.env.ZOE_AUDIT_DATABASE_INSTANCE, branchId: process.env.ZOE_AUDIT_BRANCH_ID,
    region: process.env.ZOE_AUDIT_REGION,
    emulatorHost: process.env.FIREBASE_DATABASE_EMULATOR_HOST,
    runtimeProjectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || firebaseConfig.projectId });
if (!getApps().length) initializeApp();
const verifyEmulatorRoot = (root, target) => root.isEqual(getDatabaseWithUrl(emulatorDatabaseUrl(target), root.database.app).ref());

for (const root of BUSINESS_ROOTS) {
    const name = 'audit_' + root.replace(/^zoew_/, '');
    exports[name] = functions.region(config.region).runWith({ failurePolicy: true, timeoutSeconds: 120,
        memory: '256MB', maxInstances: 10 }).database.instance(config.instance).ref('/' + root + '/{recordId}')
        .onWrite(createHandler(root, config, { verifyEmulatorRoot }));
}
