# ZoeW import-origin handoff

This handoff describes a local candidate based on the retained `a7980616661e8ac690b450dd0644eb8b0aa6f2af` source snapshot. Verify the current PR head and file overlap before applying it. The candidate is for review; it has not been merged or deployed.

## Change and compatibility

Fresh Cookie and Palm list imports capture the original scan identity and recheck the history row's incarnation during each origin transaction callback. The result distinguishes applied, unchanged, unresolved and unknown outcomes. Existing-only entries without the original scan binding remain unresolved and do not update origin metadata, even when an existing value matches. The scan journal does not durably retain the origin text for replay after restart. This candidate does not prove atomic global registry ownership or the provenance of an earlier upstream observation.

The patch changes two application source files, one existing unit test, three additional tests, the ZTO list guard, its local source-lock pin and this repository's history. The local source-lock update follows the owner-request and guard process; it does not establish deployment readiness.

## Verification and remaining work

- Local combined unit/lock/signed tests passed 127 cases. The adapted ZTO list guard passed 632 checks, the banner guard passed 209, and the documentation guard passed 115 on the generated audit root. Eight synthetic mutations failed at their intended assertions; these do not replace native backend tests.
- A synthetic SQL-only unsigned import of 100 entries and its exact repeat passed its core checks. The earlier test helper performed setup SQL before proving the initial socket owner; the target of those early setup connections is unproved. Console-only warning capture was incomplete. Do not treat this run as backend parity or proof of signed/mixed behavior.
- The local test-helper replacement and outbound fence are **unfinished** and are not included in this patch. A synthetic guardian test did not establish descendant drain. Do not start another local database until exact-process ownership, timeout and cleanup are independently verified. Never signal a process based only on a remembered PID; retain UNKNOWN where completion or ownership cannot be proved.
- Firebase RTDB emulator execution is unrun. The pinned CLI metadata identifies version `4.11.2` and the official download host `storage.googleapis.com`, which was outside the recorded environment allowlist. A supported configuration decision is required; do not bypass network policy or use a real project.
- Signed and mixed imports, their unresolved warning/origin outcomes, restart/retry behavior and matched Firebase/Supabase execution remain unverified for this candidate. F03 remains open. Prior platform restrictions on specific reviews and an extra R2 control must be respected; do not retry or reroute them.
- The last retained audit report for `a7980616661e8ac690b450dd0644eb8b0aa6f2af` recorded 228 passing and 9 failing groups. It is historical evidence for that revision, not a result for this unpushed candidate. Read the exact-head CI results after any authorized publication.

Keep unresolved evidence and journals intact. Do not infer a successful money or parcel effect from a pending/unknown result. Review the existing-only compatibility change before any rollout, and obtain the required authorization before merge, deployment, hosted rules/migrations or live-data operations.
