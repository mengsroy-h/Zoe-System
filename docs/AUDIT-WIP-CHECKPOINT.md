# WIP audit checkpoint — 2026-10-29

ការងារនេះមិនទាន់ផ្ទៀងចុងក្រោយ ឬរួចសម្រាប់ merge/deploy ទេ។ រក្សាទុកក្រោយ usage pause; បន្តពី checkpoint នេះ មិនត្រូវ reset ឬចាប់ផ្ដើម audit ពីដើម។

- Worktree: `/workspace/Zoe-System-target`; head branch: `codex/deep-audit-target-20261029`.
- User target/base: `claude/affectionate-cray-ua2chn`, `b0a67e915e61e6b8c8e4bc06a435c86742e45fa0`; remote tip unchanged at recovery.
- Recovered all modified files and six untracked source/test/migration files. No earlier WIP commit/push existed. Original main work remains separately in `/workspace/Zoe-System` and is not target-branch evidence.
- Evidence directory: `/workspace/zoe-audit-target-20261029`; `AUDIT-REPORT.md`, `branch-behavior-*.md/json`, `overlap-review.md`, `durable-scan-design.md`, raw logs and regression reports survive locally. Detailed evidence is not all embedded in this commit.

## Completed bounded work

Trash claim ownership/storage admission; Supabase console-write sequence/accounting migration; Signed reminder exclusion; auth listener cleanup; strict checker report validation and runner timer cleanup; ledger companion birth fencing; Palm pagination validation; License releaseEpoch client/rules fencing. HISTORY A445–A453 records these fixes and prerequisites. License rules must precede both clients; no rules or migration were deployed.

Latest focused evidence before pause: scan/action/ledger 71 PASS; pending wrapper/registry 28 PASS; evidence utility 26 PASS plus 10 detected mutations; same-browser actual RTDB claim probe 4 PASS with failing baseline control. These overlapping focused results are not a final aggregate pass. Initial aggregate was 208 PASS / 7 FAIL; its failures and subsequent focused fixes are preserved. The integrated final tree has not passed full build/typecheck/strict regression.

## Incomplete work and proven risks

1. Durable scan evidence is integrated locally before effects and survives restart with explicit pending warnings. It does **not** automatically repair committed-money/unknown-history crash outcomes. Full safe compensation needs authoritative actual-delta receipts and registry ownership; never infer reversal from missing history alone. Final integration review, extraction-fixture dependencies and queued registry-release failure control remain incomplete.
2. Pickup replay race remains reproducible: stale truth can delete a newer same-phone pickup key and retire the journal. Protocol design only: authoritative daily `pickupRevision` plus `pickupResetEpoch`; read revision before truth and CAS it; every writer including same-value writes advances revision; Reset advances epoch. Preserve original epoch across reapply/revert and block deletion/downgrade at rules `.write`. No pickup protocol/rules/migration/UI implementation was completed before pause.
3. Pickup journal durability is part of that fix: storage failure, seven-day expiry, 200-entry trimming and old clients reading v1 must not lose unresolved evidence. Proposed v2 journal isolates new intents; legacy unproven entries need explicit HOLD. Persistent scoped pending UI and mixed-version tests remain to implement.
4. Palm blanket restore policy remains unanswered; preserve current behavior. Live ZTO, real devices and production-scale behavior remain untested.

## Continue in this order

1. Verify this dedicated branch's local/remote SHA and recheck the user target tip; preserve all user commits. Do not mix separate main-only tests into target evidence.
2. Finish pickup protocol with real Firebase rules/emulator and generated Supabase SQL/parity tests; independently review reset, same-value ABA, pre-history optimistic writes, crash/restart, old-client and cross-session paths.
3. Finish durable scan integration review and targeted negative controls. Update coverage manifest, extraction fixtures, HISTORY/index and reports. Regenerate `money-core` after final source changes.
4. Rebuild and run all strict checks on the final tree, preserving initial evidence. Original orchestration `run-final.py` writes initial paths: create new `verification-*` outputs instead of overwriting. Source `/workspace/zoe-cloud/env.sh`, then append the reviewed localhost-only `node-loopback-faye.cjs` preload. Restart the emulator; no audit/emulator/test process survived environment restart. Numeric witness tooling is under `proposed/numeric-witness/`.
5. Run fresh performance distributions and 4/8 shops × 3 devices scale checks; prepared tools exist but these runs are NOT RUN. Refresh 135-path behavior/overlap ledger and final diff review.
6. After verification, commit/push and open a draft incremental PR into the user target branch; check final remote CI. Use `[skip netlify]` in every commit and initial PR title. Do not disable audit checks.

Authorization permits local fixes/tests, dedicated non-force push and draft PR. No merge, PR approval, deployment, live ZTO mutation, production DB/rules/secrets changes. Unknown outcomes stay pending. No clean/reset, no deleting journals or rewriting user commits. A repository Actions-variable read returned HTTP 403; do not retry without new relevant access evidence. Actual workflow results can be inspected after PR creation.
