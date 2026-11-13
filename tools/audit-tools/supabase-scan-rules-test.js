'use strict';
process.env.SCANRULES_BACKEND = 'pg';
if (process.env.SBSCAN_APP_DIR) process.env.SCANRULES_APP_DIR = process.env.SBSCAN_APP_DIR;
require('./emu/scan-operation-rules-test.js');
