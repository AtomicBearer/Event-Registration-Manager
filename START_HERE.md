# AC-STEM 9.0 — Production Staff Event Desk (separate from old test site)

**Status:** Built from the existing staff-login Event Desk interface and the already-deployed production Supabase `event-desk` Edge Function. Local offline tests only; *the first real scan has not yet been performed*. No database rows or Edge Functions were modified to create this package.

## Why this is a SEPARATE folder

The old website uses `server.js` with an `sb_secret_...` in `.env`, reads `desk_test_checkins`, and was designed for private pilot testing. Do **not** just drop this new `server.js` into that old folder. Extract this entire package as a NEW directory and test independently. Keep the old test site as backup, but do not operate it at the production entrance.

## What it uses

- Official event UUID: `33238a0f-4e1d-446a-92e7-ff1b8d265e95` (`AC-STEM 9.0`).
- Browser has only the public `sb_publishable_...` key, **no** `sb_secret_` and no `.env`.
- Staff name/passcode authentication enforced by the deployed Supabase `event-desk` function (existing `desk_operators` table). The name **must be listed as an active operator**, and the backend must have its private passcode and signing secret configured.
- Lists only official AC-STEM event registrations, not the old 18 legacy TCET Event records.
- QR scans send the exact 64-character raw QR token to `event-desk` action `checkIn` for SHA-256 verification and atomic attendance insertion into `desk_checkins`.
- Manual check-in searches students by their 5-character code (first letter of name, final 4 phone digits), verifies a matching candidate, and then sends the **unique internal `EVT-...` registration ID** to `manualCheckIn`. Never sends the 5-character code as the actual registration identity.
- Duplicate QR/manual check-ins share a unique active-check-in constraint in the same official event.
- Bulk marking, unapproved walk-in creation, other events, and removal of official Form registrations are intentionally disabled in this version. To register a walk-in, submit the same official Google Form first.

## Step-by-step

1. Extract to a NEW folder, e.g. `AC_STEM_Production_Event_Desk`. Do not overwrite the current test website.
2. Open that folder in VS Code. No `.env`, npm install, or additional Supabase keys required.
3. Open Terminal and run `node server.js` (Node 20+).
4. On the laptop open `http://localhost:8000`. The website should show **Your name** and **Team passcode** login. If it opens directly to the dashboard without login, you're in the wrong folder.
5. Sign in using an existing **active `desk_operators.display_name`** and its correct backend passcode (provided privately by the event administrator). Do not place the passcode in `config.js` or screenshots.
6. Select **Registrations**. You should see the official AC-STEM 9.0 test registration only. If none appears, check the connected Form and staff permission.
7. Calculate the student's backup code: first English initial of name + last four digits of phone, for example Meeth + ...3210 = `M3210`. Search it. If several students match, ask for name and another detail. Use Details before pressing Mark present.
8. **Controlled test:** Choose an authorized *test* registration, Mark present, select a reason and confirm. Check status and refresh on another device. Then try scanning that same QR: should return Already checked in, not count twice.
9. An authorized admin should use Undo to return the controlled test registration to Not yet. This preserves audit history. Do not undo or alter genuine attendance.
10. Phone scanner: connect laptop and authorized phone to **same Tailscale private tailnet**, leave Node running in Terminal 1, open Terminal 2 and run `tailscale serve 8000`. Use the private `https://...ts.net` link on the phone. Do not use `tailscale funnel` or expose via router port forwarding.
11. When done, close both terminals and sign out. Never share screenshots with student phone/email information publicly.

## What you must check before the actual event

- Staff roster and individual access: only one pilot operator may be configured currently. Add/verify authorized staff and revoke former staff.
- The existing Edge login uses shared team/admin passcodes; this needs rate limiting and ideally unique per-user credentials before broad deployment.
- Test phone camera HTTPS and repeated QR scans on separate physical devices; confirm event stats and database counts agree.
- Load-test at expected peak traffic; this package is **not** proof of 60+ scans per minute.
- Ensure students who forgot their phone can still be verified by a staff member; **the five-character code is a lookup hint, not a password or proof of identity**.
- Consider handling offline/internet outages, which this app does not support; attendance requires Supabase connectivity.

## Important

This production UI is directly connected to **real** attendance. It is not a demo. The test registration is real, and clicking Mark present or scanning its QR will change `desk_checkins`. Never test with a genuine student's attendance without their authorization.
