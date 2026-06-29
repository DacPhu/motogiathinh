# Plan: Fix Cache & Auth Data Isolation Between Accounts

## Problem

Logging out and into different accounts on the same device shows mixed profiles from both accounts. The root cause is the frontend offline cache (`mgt_snapshot_v1`) being shared across all users with no identity check.

## Implemented Solution (4 files, 8 improvements)

### 1. User-Scoped Cache Key (data-loader.js)
Cache key `mgt_snapshot_v1` → `mgt_snapshot_v1_${userId}`. JWT decoded via `atob()` to extract `sub` claim. Mismatched cache discarded. Old-format keys cleaned up on first boot.

### 2. Guest Draft Isolation (screen-guest.jsx + data-loader.js)
localStorage key `mgt_guest_add_draft` → `mgt_guest_add_draft_${userId}`. IndexedDB `mgt_guest_draft` → `mgt_guest_draft_${userId}`. Prevents cross-user PII leakage (names, photos).

### 3. Background Data Refresh on Reconnect (data-loader.js)
`_probeReconnect` now calls `refreshAllData()` — re-fetches all 12 endpoints, updates arrays in place, recomputes derived fields. No page reload. User keeps scroll/forms/context.

### 4. Admin Form Auto-Save (modals.jsx)
All three admin modals (AddStudent, AddPayment, AddClass) auto-save form state to localStorage every 1s. Restored on modal open. Cleared on successful submit.

### 5. Boot Error Retry (app.jsx)
Auto-retry once after 3 seconds. If that fails, shows "Thử lại" button. Elderly users never hit a dead end.

### 6. Background Data Polling (data-loader.js)
Every 120 seconds (tab visible + online), heartbeat `/api/me` → `refreshAllData()`. Toast "Dữ liệu đã cập nhật" only when counts changed.

### 7. beforeunload Guard (modals.jsx)
When any admin modal has typed data, browser warns before tab close. "Bạn có thay đổi chưa lưu. Đóng trang sẽ mất dữ liệu."

### 8. Multi-Tab Coordination (data-loader.js)
`BroadcastChannel('mgt-auth')`: login/logout broadcasts. Different user on another tab → reload. Same user → no disruption.

## What is NOT Changed
- `mgt-theme`, `mgt-mode` — shared UI preferences
- Native credential clearing — auto-fill stays for same-user convenience
- Session expiry overlay — 90-day token, once-a-year event
- Aggressive logout cleanup — user-scoped keys handle isolation
- Backend JWT blacklist, rate limiting — separate security work

## Files Modified
| File | Changes |
|---|---|
| `frontend/data-loader.js` | Cache key scoping, refreshAllData, reconnect, polling, BroadcastChannel |
| `frontend/screen-guest.jsx` | IndexedDB + localStorage scoped to userId |
| `frontend/modals.jsx` | Auto-save, beforeunload, draft clear |
| `frontend/app.jsx` | Boot error retry |
