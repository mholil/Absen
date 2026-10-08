# Security Specification — Absensi MI Cloud Firestore

## 1. Data Invariants
1. **Authentication & Verification Invariant**: Every read and write operation to `/school_records/{recordId}` and `/admins/{adminId}` requires an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`), or the bootstrapped administrator email (`mholil0513@gmail.com` with `email_verified == true`).
2. **Path Variable Hardening Invariant**: Every single-document ID (`recordId`, `adminId`) must match `^[a-zA-Z0-9_\-]+$` and have `.size() >= 1 && .size() <= 128`.
3. **Strict Schema & Key Allowlisting Invariant**:
   - `SchoolRecord` documents must contain all required keys `['id', 'section', 'ownerId', 'schoolName', 'academicYear', 'recordCount', 'createdAt', 'updatedAt']` and only allowed keys `['id', 'section', 'ownerId', 'schoolName', 'academicYear', 'recordCount', 'records', 'settingsData', 'createdAt', 'updatedAt']`.
   - `AdminUser` documents must contain all required keys `['uid', 'email', 'role', 'createdAt']` and only those keys.
4. **Identity & Immutability Invariant**:
   - On creation, `incoming().ownerId == request.auth.uid` and `incoming().id == recordId`.
   - On update, `incoming().id == existing().id`, `incoming().section == existing().section`, and `incoming().createdAt == existing().createdAt`.
5. **Temporal Integrity Invariant**:
   - On creation, `incoming().createdAt == request.time` and `incoming().updatedAt == request.time`.
   - On update, `incoming().updatedAt == request.time`.
6. **Query Enforcer Invariant**:
   - `allow list` on `/school_records` requires `resource.data.ownerId == request.auth.uid || isAdmin()`.

## 2. The "Dirty Dozen" Payloads (Designed to Break Identity, Integrity, and State)

1. **Payload 1 (Unauthenticated Write)**: `auth = null`, creating `/school_records/settings`. Expected: `PERMISSION_DENIED`.
2. **Payload 2 (Unverified Email Spoof)**: `auth = { uid: 'u1', token: { email: 'mholil0513@gmail.com', email_verified: false } }`. Expected: `PERMISSION_DENIED`.
3. **Payload 3 (Shadow Field Injection on Create)**: Adding `isSuperAdmin: true` to `/school_records/settings`. Expected: `PERMISSION_DENIED`.
4. **Payload 4 (Shadow Field Injection on Update)**: Updating `/school_records/settings` with an undeclared field `hacked: 'yes'`. Expected: `PERMISSION_DENIED`.
5. **Payload 5 (Owner Spoofing on Create)**: Creating `/school_records/students` with `ownerId: 'other-user-uid'`. Expected: `PERMISSION_DENIED`.
6. **Payload 6 (ID Poisoning / Path Mismatch)**: Creating `/school_records/students` with `id: 'classes'` or invalid regex characters `id: 'bad/id$!'`. Expected: `PERMISSION_DENIED`.
7. **Payload 7 (Oversized String / Denial of Wallet)**: Setting `schoolName` to a 5,000-character string (`size() > 200`). Expected: `PERMISSION_DENIED`.
8. **Payload 8 (Invalid Enum Section)**: Setting `section: 'unknown_section'` outside `['settings', 'classes', 'students', 'attendance', 'notes', 'bills', 'payments', 'admin_extra']`. Expected: `PERMISSION_DENIED`.
9. **Payload 9 (Forged Client Timestamp on Create)**: Setting `createdAt` to a past timestamp instead of `request.time`. Expected: `PERMISSION_DENIED`.
10. **Payload 10 (Mutating Immutable `createdAt` on Update)**: Changing `createdAt` during an `update` call. Expected: `PERMISSION_DENIED`.
11. **Payload 11 (Self-Assigned Admin Privilege Escalation)**: Non-admin user attempting to create `/admins/attackerUid` with `role: 'admin'`. Expected: `PERMISSION_DENIED`.
12. **Payload 12 (Unbounded Array Poisoning)**: Passing `records` as a non-list or exceeding maximum bound (`records.size() > 5000`). Expected: `PERMISSION_DENIED`.
