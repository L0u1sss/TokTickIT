# TokTickIT Lab 3 — Sprint Engineering Specification

> สถานะ: Proposed contract สำหรับ peer review ก่อนเริ่ม implementation
>
> อ้างอิงหลัก: `Lab_3_sheet.pdf` และ contract ของ Lab 2
>
> Issue: [#29 — define Sprint 3 engineering contract and traceability](https://github.com/L0u1sss/TokTickIT/issues/29)

เอกสารนี้เป็น contract หลักของ Lab 3 หาก implementation จำเป็นต้องต่างจากเอกสาร ต้องแก้ contract พร้อมเหตุผลและ test traceability ก่อนถือว่างานเสร็จ

## 1. Sprint Goal

พัฒนา TokTickIT จากระบบจำลอง Development Requester ให้เป็นระบบที่ยืนยันตัวตนจริง รองรับ Requester, IT Staff และ Administrator โดยรักษาฟังก์ชันและข้อมูลจาก Lab 2 เพิ่ม workflow จัดการ Ticket สำหรับ IT Staff และ User Management ขั้นพื้นฐานสำหรับ Administrator พร้อมบังคับ authorization ที่ backend

## 2. Stakeholder Request

ผู้ใช้ต้องเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน เปลี่ยน initial password ก่อนใช้งานครั้งแรก และเห็นเฉพาะหน้ากับ action ตาม role ของตน Requester ต้องทำงานเดิมจาก Lab 2 ด้วย identity ที่ยืนยันแล้ว ส่วน IT Staff ต้องค้นหา รับผิดชอบ และดำเนินสถานะ Ticket พร้อมสื่อสารผ่าน Public Comments และบันทึก Internal Notes ได้ ขณะที่ Administrator จัดการบัญชีผู้ใช้แบบจำกัดขอบเขตโดยไม่ลบประวัติ

## 3. Scope

### 3.1 Included

- Login, logout, current-user retrieval และ mandatory first-login password change
- Backend authentication, role authorization และ Requester ownership protection
- Migration จาก `RequesterUser` ของ Lab 2 ไปยัง `User` โดยรักษา Ticket และ Attachment เดิม
- Requester regression: Create Ticket, My Tickets, Ticket Detail และ Attachment lifecycle โดยใช้ authenticated identity
- Requester Public Comments และ “Problem Appears Resolved” indication
- IT Staff Ticket Queue พร้อม search, filters, sorting และ pagination
- IT Staff Ticket Detail พร้อม claim/assignment, IT Priority, permitted status workflow, Public Comments และ Internal Notes
- Administrator User Management: list/search/optional role filter/create/edit/activate/deactivate/set initial password
- Zen Green UI, reusable components, responsive และ accessibility behaviorต่อเนื่องจาก Lab 2
- Unit, API/integration, UI, security/authorization, migration/regression, responsive และ E2E evidence

### 3.2 Explicitly excluded

- Email invitation/reset, MFA, social login, SSO และ self-registration
- Actions Taken, SLA, escalation, notification services และ analytics dashboard
- Multiple roles per user, departments, organizations, multi-tenancy และ extended profiles
- User deletion, bulk operations, import/export, role history และ account-history screens
- Account unlocking, approval workflows และ advanced identity recovery
- Advanced user-list pagination, multi-column sorting และ simultaneous multi-filtering
- Production deployment และ cloud infrastructure

## 4. Functional Requirements

- **FR-01 — Authentication:** ระบบต้องให้ active user เข้าสู่ระบบด้วย email/password และคืน safe current-user identity กับ role โดยไม่คืน credential fields
- **FR-02 — Mandatory password change:** บัญชีที่ใช้ initial password ต้องเข้าได้เฉพาะหน้าเปลี่ยนรหัสผ่าน, current-user และ logout จนบันทึกรหัสผ่านใหม่ที่ valid สำเร็จ
- **FR-03 — Session lifecycle:** ระบบต้องคืน current user จาก authenticated session และทำให้ session ปัจจุบันใช้ต่อไม่ได้ทันทีหลัง logout
- **FR-04 — Role navigation:** App shell ต้องแสดงชื่อ, role, Logout และ navigation ที่เหมาะกับ role; direct URL/API ที่ไม่มีสิทธิ์ยังต้องถูก backend ปฏิเสธ
- **FR-05 — Authenticated Requester regression:** Requester ต้องใช้ Create Ticket, My Tickets, Ticket Detail และ Attachment functions ของ Lab 2 ด้วย `requesterId` จาก session เท่านั้น โดยไม่มี selector หรือ Change Requester
- **FR-06 — Requester collaboration:** Requester เจ้าของ Ticket ต้องอ่าน/เพิ่ม Public Comment และส่ง “Problem Appears Resolved” ได้ แต่ตั้ง Resolved หรือ Closed เองไม่ได้
- **FR-07 — Staff queue:** IT Staff ต้องเห็น shared queue พร้อม search, status/requested-priority/IT-priority/owner filters, sorting, pagination และ open-detail action
- **FR-08 — Staff ticket access:** IT Staff และ Administrator ต้องเปิด Ticket Detail รวม Requester, Ticket fields, owner, priorities, status, attachment metadata/secure download และ public conversation ได้
- **FR-09 — Assignment:** IT Staff และ Administrator ต้อง claim Ticket ที่ยังไม่ assigned และ assign/reassign Ticket ให้ active IT Staff หรือ Administrator ได้ตาม authorization matrix
- **FR-10 — Operational fields:** IT Staff และ Administrator ต้องเปลี่ยน IT Priority และ status เฉพาะค่าหรือ transition ที่ contract อนุญาต
- **FR-11 — Public Comments:** ผู้มีสิทธิ์ต้องอ่านและเพิ่ม Public Comments แบบ append-only พร้อม author และเวลาจาก backend
- **FR-12 — Internal Notes:** IT Staff และ Administrator ต้องอ่านและเพิ่ม Internal Notes แบบ append-only; Requester ต้องไม่เห็นทั้งใน UI และ API
- **FR-13 — User list:** Administrator ต้องดูรายชื่อผู้ใช้ แสดง Name, Email, Role, Status และค้นด้วย name/email พร้อม optional single-role filter ได้
- **FR-14 — User create/edit:** Administrator ต้องสร้างบัญชีด้วยหนึ่ง role และ initial password และแก้ name, email, role, activation state ได้
- **FR-15 — Reset initial password:** Administrator ต้องตั้ง initial password ใหม่และบังคับผู้ใช้นั้นเปลี่ยนใน login ครั้งถัดไปได้
- **FR-16 — Safe states:** ทุกหน้าหลักต้องมี processing, validation, success, empty/no-results, forbidden/not-found/conflict และ safe failure feedbackตามความเหมาะสม
- **FR-17 — Data continuity:** migration และ seed ต้องทำซ้ำได้อย่างปลอดภัย และข้อมูล Category, Related System, Ticket, Attachment และ ownership จาก Lab 2 ต้องยังใช้งานได้

## 5. Business Rules

### 5.1 Authentication and account rules

- **BR-01:** เฉพาะ active user ที่มี valid credentials เท่านั้นที่ authenticate ได้
- **BR-02:** Email ใช้เปรียบเทียบแบบ trim และ case-insensitive และต้อง unique ด้วย canonical normalized value; unknown email, wrong password และ inactive account (แม้ password ถูกต้อง) ต้องคืน `401 AUTHENTICATION_FAILED` พร้อมข้อความเดียวกัน `Unable to sign in with the provided credentials.` โดยไม่สร้าง session หรือออก authenticated session cookie และไม่เผยว่า email มีอยู่, password ถูก/ผิด หรือบัญชี inactive; requestId ต่างกันได้ แต่ห้ามมี account-specific detail/fieldErrors ส่วน malformed input, Origin rejection, rate limit และ unexpected failure ใช้ error ตาม API contract แยกจาก account-specific authentication failure
- **BR-03:** Password ไม่เก็บหรือ log เป็น plaintext ต้อง hash ด้วย Argon2id พร้อม random salt และค่าที่เหมาะกับ environment; API response ต้องไม่คืน hash
- **BR-04:** Password ใหม่ต้องยาว 12–128 Unicode code points ไม่มี whitespace ต้น/ท้าย และมีอย่างน้อย 3 จาก 4 กลุ่มตาม Unicode properties: lowercase letter, uppercase letter, decimal number และ character ที่ไม่ใช่ letter/number/whitespace
- **BR-05:** Initial password และ password ที่ Administrator ตั้งใหม่มี `mustChangePassword = true`; user ดังกล่าวเข้า normal application ไม่ได้จนเปลี่ยนสำเร็จ
- **BR-06:** Change Password ต้องตรวจ current password, confirmation และห้ามใช้รหัสเดิม; เมื่อสำเร็จต้อง clear `mustChangePassword` และ invalidate session อื่นของบัญชีนั้น
- **BR-07:** Session token ต้องสุ่มแบบ cryptographically secure เก็บเฉพาะ SHA-256 hash ในฐานข้อมูล ใช้ cookie `toktickit_session` แบบ `HttpOnly`, `SameSite=Lax`, `Path=/` และ `Secure` นอก local development อายุไม่เกิน 8 ชั่วโมง
- **BR-08:** Logout ลบ server session และ expire cookie; การเรียกซ้ำให้สำเร็จแบบ idempotent โดยไม่คืนข้อมูลผู้ใช้
- **BR-09:** ทุก unsafe method (`POST`, `PATCH`, `PUT`, `DELETE`) ที่ browser เรียกต้องมี `Origin` ตรงกับ configured client origin รวมถึง `POST /api/auth/login` เพราะ endpoint นี้สร้าง session cookie แม้ request เริ่มต้นยังไม่มี cookie; missing/unapproved Origin คืน `403 ORIGIN_NOT_ALLOWED` ก่อนตรวจ credentials/body และ CORS ต้อง allow เฉพาะ configured origin พร้อม credentials
- **BR-10:** บัญชี inactive หรือ session หมดอายุต้องใช้ protected endpoint ไม่ได้ และไม่สร้าง session ใหม่อัตโนมัติ

### 5.2 Identity, authorization and ownership

- **BR-11:** Role มีค่าเดียวจาก `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`; frontend visibility ไม่ทดแทน backend authorization
- **BR-12:** Requester operations ใช้ authenticated `User.id` เท่านั้น ค่า `requesterId` หรือ legacy `x-requester-id` จาก client ต้องไม่เปลี่ยน identity หรือ ownership
- **BR-13:** สำหรับ protected resource ที่ไม่มีสิทธิ์เห็น ให้คืน safe `404 NOT_FOUND` เมื่อจำเป็นเพื่อไม่เปิดเผยว่าข้อมูลของผู้อื่นมีอยู่; role-level forbidden ที่ไม่เปิดเผย resource ใช้ `403 FORBIDDEN`
- **BR-14:** Requester อ่าน/แก้ได้เฉพาะ Ticket และ Attachment ของตน; staff queue/detail ใช้ได้เฉพาะ role ที่ matrix อนุญาต
- **BR-15:** Deactivated user เก็บเป็นประวัติอ้างอิงได้ แต่ login, claim, assignment หรือ reactivation ผ่านช่องทางที่ไม่ได้อนุญาตไม่ได้

### 5.3 Ticket workflow

- **BR-16:** Ticket ที่ยังไม่เป็น terminal status เริ่ม unassigned ได้และมี active assignment (`ownerId`) ได้สูงสุดหนึ่งคน โดย owner ต้องเป็น active `IT_STAFF` หรือ `ADMINISTRATOR`; เมื่อ status เปลี่ยนเป็น `CLOSED` หรือ `CANCELLED` server ต้องย้าย final owner ไป `lastOwnerId` และตั้ง `ownerId = null` ใน transaction เดียวกัน เพื่อรักษา historical ownership โดยไม่ทำให้ terminal Ticket ขวางการ deactivate/demote ภายหลัง
- **BR-17:** Claim ทำได้เมื่อ Ticket ยัง unassigned และไม่ใช่ `CLOSED`/`CANCELLED` เท่านั้น; การ claim ซ้ำหรือแข่งกันหลังมี ownerแล้วคืน `409 TICKET_ALREADY_ASSIGNED` และ terminal Ticket คืน `409 TICKET_NOT_ASSIGNABLE`
- **BR-18:** Assign/reassign ทำได้เฉพาะ non-terminal Ticket และต้องชี้ไป active IT Staff หรือ Administrator ทุก operation ที่อาจ assign ให้ user หรือทำให้ user หมด eligibility ต้องใช้ PostgreSQL transaction-scoped advisory lock namespace เดียวกัน keyed by target `User.id` หลังได้ lock แล้วต้อง re-check role, activation และ current assignment ก่อน commit; ผลหลัง concurrent assign/reassign กับ deactivate/demote ต้องเป็น assignment ที่ eligible หรือ `null` เสมอ โดยหนึ่งฝั่งคืน `409` (`INVALID_ASSIGNEE` หรือ `USER_HAS_ASSIGNED_TICKETS`)
- **BR-19:** `requestedPriority` เป็นค่าที่ Requester ส่งและแก้ไม่ได้ ส่วน `itPriority` เริ่ม copy จาก requested priority แล้วเปลี่ยนได้เฉพาะ IT Staff หรือ Administrator ทุก approved creation path ต้องกำหนด `itPriority = requestedPriority` อย่าง explicit; Prisma/database column เป็น required และไม่มี static default เพื่อปฏิเสธ insert ที่ลืมกำหนดค่าเริ่มต้น
- **BR-20:** Status มี `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`; API/UI แสดง label ที่อ่านง่าย
- **BR-21:** Status transition ต้องเป็นไปตาม matrix ในหัวข้อ 6.2 และ backend reject transition อื่นด้วย `409 INVALID_STATUS_TRANSITION`
- **BR-22:** การเปลี่ยนเป็น `RESOLVED`, `CLOSED` หรือ `CANCELLED` ต้องมี confirmation ใน UI; confirmation เป็น usability control ส่วน backend transition validation เป็น authoritative control
- **BR-23:** Requester “Problem Appears Resolved” ทำได้เฉพาะ status `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER` หรือ `REOPENED`; สร้าง timestamp/actor indication โดยไม่เปลี่ยน formal status ส่งซ้ำขณะที่ indication ปัจจุบันยังอยู่ให้ idempotent ส่วน `RESOLVED`, `CLOSED` หรือ `CANCELLED` คืน `409 RESOLUTION_INDICATION_NOT_ALLOWED` และ transition ไป `REOPENED` ต้อง clear indication เดิมเพื่อรับรอบใหม่
- **BR-24:** Actions Taken และเงื่อนไขที่เกี่ยวข้องกับการ resolve ถูก defer ไป Lab 4 และห้ามนำมาเป็นเงื่อนไขปิดงาน Lab 3

### 5.4 Comments and notes

- **BR-25:** Public Comment และ Internal Note ยาว 1–2,000 Unicode code points หลัง trim; empty/whitespace-only ถูกปฏิเสธ
- **BR-26:** Public Comments และ Internal Notes เป็น append-only ไม่มี edit/deleteใน Lab 3; author และ `createdAt` มาจาก backend
- **BR-27:** เนื้อหาจัดเก็บ/คืนเป็น plain text และ render เป็น text ไม่ใช้ unsanitized HTML
- **BR-28:** Public Comment มองเห็นได้โดย Requester เจ้าของ Ticket, IT Staff และ Administrator; Internal Note มองเห็นเฉพาะ IT Staff และ Administrator และต้องไม่ปรากฏใน requester response, count หรือ error detail

### 5.5 Administrator safety

- **BR-29:** Administrator สร้าง user ได้หนึ่ง permitted role และแก้เฉพาะ name, email, role, activation state; unknown/invalid fields ถูกปฏิเสธ
- **BR-30:** Duplicate normalized email คืน `409 EMAIL_ALREADY_EXISTS` โดยไม่แก้ข้อมูลเดิม
- **BR-31:** Administrator ห้าม deactivate บัญชีตนเอง และห้าม deactivate หรือเปลี่ยน role ของ active Administrator คนสุดท้าย
- **BR-32:** User ไม่มี hard-delete endpoint; ใช้ deactivation เท่านั้น User ที่มี active assignment (`Ticket.ownerId`) ต้องถูก reassign หรือให้ Ticket เข้าสู่ terminal statusก่อน deactivate/เปลี่ยนเป็น `REQUESTER`; มิฉะนั้นคืน `409 USER_HAS_ASSIGNED_TICKETS` ส่วน `lastOwnerId` เป็น historical reference และไม่ขวาง operation นี้ Historical authorship/ownership ต้องไม่ถูกลบ
- **BR-33:** Seeded credentials ใช้เฉพาะ local development ต้องระบุใน README/seed output และห้ามใช้ personal password หรือ secret จริง

### 5.6 Validation, concurrency and failures

- **BR-34:** Validation ใช้ Unicode code-point counting เหมือนกันทั้ง UI และ API; integer IDs ต้องเป็น positive base-10 integers และ enum/query values ต้องตรง exact contract
- **BR-35:** Server เป็นผู้กำหนด actor, owner-sensitive fields, timestamps และ workflow outcomes; client-supplied protected fields ถูกปฏิเสธ
- **BR-36:** Concurrent claim, assign/reassign versus deactivate/demote, last-active-admin change และ unique-email operation ต้องมี database/transaction protection ไม่พึ่ง check ฝั่ง client ทุก path ที่เปลี่ยน owner eligibility ต้องใช้ lock order/transaction protocol เดียวกันและ re-checkก่อน commit เพื่อให้ invariant `ownerId IS NULL OR owner is active IT_STAFF/ADMINISTRATOR` เป็นจริงหลังทุก commit
- **BR-37:** Unexpected errorsคืน safe error envelope และ server log correlation ID โดยไม่เผย stack trace, SQL, token, password hash หรือ protected resource data
- **BR-38:** ทุก Lab 2 invariant ที่ไม่ถูกแทนที่โดย contract นี้ยังมีผล รวม attachment 5 MiB decision, private opaque storage, soft removal และ idempotent ticket creation
- **BR-39:** Login ต้องจำกัดความถี่ตาม IP และ normalized email ด้วยค่าที่กำหนดจาก environment; เมื่อเกิน limit คืน `429 TOO_MANY_ATTEMPTS` และ `Retry-After` โดยไม่เปิดเผยว่าบัญชีมีอยู่หรือไม่

## 6. Authorization and Workflow Matrices

### 6.1 Authorization matrix

| Capability | Public | Requester | IT Staff | Administrator |
|---|:---:|:---:|:---:|:---:|
| Login | Yes | Yes | Yes | Yes |
| Change own required password / logout / current user | No | Yes | Yes | Yes |
| Create/list/view own Tickets and owned Attachments | No | Yes | No | No |
| Public Comments on own Ticket | No | Yes | No | No |
| Problem Appears Resolved on own Ticket | No | Yes | No | No |
| Shared Ticket Queue / staff Ticket Detail | No | No | Yes | Yes |
| Claim, assign/reassign, IT Priority, status | No | No | Yes | Yes |
| Download active Attachment from permitted Ticket | No | Own Ticket only | Yes | Yes |
| Public Comments on any Ticket | No | No | Yes | Yes |
| Internal Notes on any Ticket | No | No | Yes | Yes |
| User Management | No | No | No | Yes |

Contract นี้ใช้ทางเลือกที่ labsheet อนุญาตโดยให้ Administrator ทำ Ticket operations ได้อย่างชัดเจน เพื่อรองรับ owner/IT Priority rules ในหัวข้อ 4.5 แต่เฉพาะ Administrator เท่านั้นที่เข้าถึง User Management หากทีมเปลี่ยน matrix นี้ ต้องแก้ API/UI/tests พร้อมเหตุผลก่อน implementation

### 6.2 Status-transition matrix

| Current | Permitted next status |
|---|---|
| `NEW` | `OPEN`, `CANCELLED` |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` |
| `RESOLVED` | `REOPENED`, `CLOSED` |
| `REOPENED` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` |
| `CLOSED` | `REOPENED` |
| `CANCELLED` | `REOPENED` |

การ claim/assign ไม่เปลี่ยน status อัตโนมัติ เพื่อให้ operation แต่ละอย่างตรวจสอบและสื่อสารผลได้ชัดเจน

## 7. UI Specification Summary

- Login และ Change Password เป็น public/forced-flow screens ที่มี label, rules, validation, busy และ safe failure feedback
- Authenticated shell แสดง user name, role, role-specific navigation และ Logout
- Requester shell ใช้ Create Ticket/My Tickets; Ticket Detail เพิ่ม Public Comments และ Problem Appears Resolved โดยไม่มี requester selector
- Staff shell ใช้ Ticket Queue และ Ticket Detail; Public Comments กับ Internal Notes ต้องแยก visual/wording ชัดเจน
- Administrator shell ใช้ User Management หน้าเดียวพร้อม list, search, role filter, create/edit และ set-initial-password flows
- ทุก screen รองรับ keyboard, visible focus, semantic labels/status feedback และ viewport `1440×900`, `834×1112`, `390×844` ตามกฎ responsive ของ Lab 2

รายละเอียด normative อยู่ใน [ui-spec.md](./ui-spec.md)

## 8. Data Changes

### 8.1 Models and fields

| Model | Required design |
|---|---|
| `User` | Preserve migrated requester IDs; `displayName` varchar(120), canonical lowercase unique `email` varchar(254), `passwordHash`, `role`, `isActive`, `mustChangePassword`, timestamps; relations to submitted Tickets, owned Tickets, Attachments, Comments, Notes และ resolution indications |
| `Session` | Opaque token hash unique, `userId`, `expiresAt`, `createdAt`, optional `revokedAt`; index by user and expiry |
| `Ticket` | Existing fields plus nullable active-assignment `ownerId`, nullable historical `lastOwnerId`, `itPriority`, expanded status, optional resolution-indication actor/time; indexes for queue ordering and filters |
| `PublicComment` | `id`, `ticketId`, `authorId`, `content`, `createdAt`; append-only; index `(ticketId, createdAt, id)` |
| `InternalNote` | `id`, `ticketId`, `authorId`, `content`, `createdAt`; append-only; index `(ticketId, createdAt, id)` |

`Category`, `RelatedSystem` และ `Attachment` เดิมยังคงอยู่ โดย Attachment actor relations เปลี่ยนจาก `RequesterUser` เป็น `User` โดยรักษา IDs

Constraints/indexes ขั้นต่ำคือ unique `User.email`, unique `Session.tokenHash`, restrictive foreign keys สำหรับ historical actor/`lastOwnerId`, session indexesที่ `(userId, expiresAt)` และ `expiresAt`, queue indexesที่รองรับ `(status, updatedAt, id)`, `(ownerId, updatedAt, id)`, `(itPriority, updatedAt, id)` และ `(requestedPriority, updatedAt, id)` รวมถึง comment/note indexes `(ticketId, createdAt, id)` Ticket มี same-row check ว่า terminal status ต้องมี `ownerId = null`; ส่วน owner role/activation เป็น cross-row invariant ที่ transactional service บังคับด้วย protocol เดียวกันตาม BR-18/BR-36

### 8.2 Migration strategy

Issue #31 implements Requester-to-User migration, existing Ticket/Attachment FK preservation and session/role cutover on top of #30. Workflow columns and feature models in the full strategy below remain subsequent issues. See [current migration decisions and local initial credentials](identity-migration.md).

1. เพิ่ม enums/models/nullable columns โดยยังไม่ลบ `RequesterUser` หรือข้อมูลเดิม
2. สร้าง `User` rows จาก Requester เดิมโดย preserve ID, displayName, email, activation state และกำหนด role `REQUESTER`
3. สร้าง Argon2id hash จาก local-lab initial password ที่ documented และตั้ง `mustChangePassword = true`
4. เปลี่ยน Ticket requester และ Attachment uploader/remover FKs ให้ชี้ `User`; verify counts, IDs และ orphan count ก่อนลบ/rename schema เก่า
5. ขยาย Ticket status โดย map `NEW` เดิมตรงตัว เพิ่ม `ownerId = null` และ backfill `itPriority = requestedPriority`
6. เพิ่ม constraints/indexes แล้วทำ migration verificationทั้ง empty database และฐาน Lab 2 ที่มีข้อมูล
7. ลบ selector API/UI/sessionStorage key หลัง authenticated flow พร้อมใช้งาน

Migration ต้อง fail ชัดเจนแทน silent data loss หาก duplicate normalized email หรือ broken foreign key ถูกพบ

### 8.3 Seed decisions

- Idempotent upsert ด้วย stable fixture identifiers
- อย่างน้อย 4 active + 1 inactive Requester, 3 active + 1 inactive IT Staff และ 1 active Administrator
- Ticket กระจาย requester, owner/unassigned, statuses และ priorities อย่างสมจริง
- มี Public Comments และ Internal Notes ตัวอย่างที่ไม่มีข้อมูลลับ
- Credential fixture เป็น local-only; seed ตั้ง `mustChangePassword = true` เฉพาะตอนสร้าง fixture ครั้งแรก และการรันซ้ำต้องไม่ reset password/flag ของบัญชีที่ผู้ใช้เปลี่ยนแล้ว

## 9. API Contract Summary

REST API ใช้ JSON UTF-8 ใต้ `/api`, authenticated cookie ตาม BR-07 และ error envelope เดียวกัน แบ่งเป็น `/api/auth/*`, requester-compatible `/api/tickets/*`, `/api/staff/*` และ `/api/admin/*` ค่า actor/requester จาก session เสมอ Queue ใช้ validated search/filter/sort/page contract และ nested protected resource ใช้ safe lookup orderเพื่อไม่รั่วข้อมูล

รายละเอียด endpoint, shapes, status codes และ errors อยู่ใน [api-spec.md](./api-spec.md)

## 10. Acceptance Criteria

- **AC-01:** Given active user และ valid credentials, when login, then server creates authenticated session และคืน safe identity/role
- **AC-02:** Given unknown email, wrong password หรือ inactive user (รวม valid password), when login ด้วย valid request และ approved Origin ภายใน rate limit, then ทั้งสามกรณีคืน `401 AUTHENTICATION_FAILED` พร้อมข้อความเดียวกัน `Unable to sign in with the provided credentials.`, ไม่มี account-specific detail/fieldErrors, ไม่สร้าง session หรือออก authenticated session cookie และ UI แสดง generic error เดียวกัน
- **AC-03:** Given `mustChangePassword`, when login succeeds, then normal screens/APIs remain forbidden until valid password change succeeds
- **AC-04:** Given authenticated session, when logout then protected direct navigation/API is inaccessible and revoked session cannot be reused
- **AC-05:** Given each role, when app loads then shell/navigation/actions match matrix; direct forbidden API still rejects the request
- **AC-06:** Given Requester, when client supplies another requester identity then backend still scopes all Lab 2 Ticket/Attachment behavior to authenticated owner
- **AC-07:** Given migrated Lab 2 data, when migrations finish then requester, ticket and attachment relationships/counts remain intact and functions regress successfully
- **AC-08:** Given staff queue data, when valid search/filter/sort/page queries are used then deterministic correct rows and pagination metadata are returned; invalid query returns `400`
- **AC-09:** Given unassigned Ticket, when IT Staff claims it then that staff becomes owner exactly once; conflicting claim is `409`
- **AC-10:** Given Ticket และ eligible owner, when authorized assignment/IT Priority update หรือ concurrent assignmentกับ account eligibility change occurs then validated change persists, queue/detail agree และ committed non-null owner remains eligible
- **AC-11:** Given a current Ticket status, when IT Staff requests a permitted transition it persists; invalid transition is `409` and terminal status remains unchanged
- **AC-12:** Given Ticket access, when authorized actor posts valid Public Comment then all permitted viewers see identical append-only author/time/content; invalid content is rejected
- **AC-13:** Given Requester or unauthorized role, when Internal Note endpoint is requested then no note data or existence detail is disclosed
- **AC-14:** Given owning Requester and an allowed non-terminal workflow status, when Problem Appears Resolved is submitted then indication is recorded without formal status change; Resolved/Closed/Cancelled requests are rejected and Reopened starts a fresh indication cycle
- **AC-15:** Given Administrator, when list/search/filter/create/edit/set-initial-password actions use valid data then results persist with exactly one role and next login requires password change
- **AC-16:** Given duplicate email, self-deactivation, last-active-admin removal หรือ deactivate/role-change ของ assigned owner, when Administrator submits change then backend returns conflict and preserves safe valid state
- **AC-17:** Given processing/empty/no-results/forbidden/conflict/failure scenarios, when user uses a major screen then clear recoverable feedback is shown without leaking secrets or private notes
- **AC-18:** Given desktop/tablet/mobile viewport and keyboard/zoom use, when major Lab 3 screens are exercised then content remains usable without horizontal page overflow, controls are labelled, focus is visible/managed, and status is announced
- **AC-19:** Given an active Attachment on a Ticket, when IT Staff or Administrator downloads through the staff Attachment route then authorized bytes and safe headers are returned; Requester, missing/removed/wrong-Ticket requests reveal no protected file or storage path

ทุก AC map ไปยัง planned tests ใน [tests.md](./tests.md)

## 11. Product Definition of Done

- [ ] Specification, API, UI และ test contracts ได้รับ peer review ก่อน implementation PR หลักเสร็จ
- [ ] Migration ผ่านทั้ง fresh database และ populated Lab 2 database โดยไม่มี data/ownership loss
- [ ] Authentication secrets ไม่อยู่ใน source/client และ passwords ใช้ approved hash
- [ ] ทุก protected endpoint มี authentication, active-account, role และ ownership checks ตาม matrix
- [ ] Requester regression, staff workflow, comments/notes และ Administrator safety rules ผ่าน automated tests
- [ ] Unit, API/integration, UI/style, security, migration/regression และ E2E suites ผ่านบน final `main`
- [ ] Screenshots desktop/tablet/mobile และ accessibility checklist ครบ major Lab 3 screens
- [ ] Safe error behaviorผ่านและไม่มี password/token/hash/stack/SQL/private-note leakage
- [ ] README, `.env.example`, migration/seed/run instructions, `reviewer.md` และ `ai-use.md` ตรงกับของจริง
- [ ] Feature branches merge เข้า `lab3-staging`, แล้ว merge เข้า `main`; CI และ peer approval ผ่าน
- [ ] Final PDF ใช้หัวข้อ `Answer Part 1` ถึง `Answer Part 9` ตามลำดับและมี working links

## 12. Assumptions and Decisions

- เลือก opaque database-backed session cookie แทนเก็บ bearer token ใน browser storage เพื่อลดการเปิดเผย credential ต่อ client scriptและรองรับ server-side logout invalidation
- เลือก Argon2id สำหรับ password hashing; ค่า tuning ต้องวัดใน CI/development และห้าม hard-code secret
- Contract นี้อนุญาต Administrator ใช้ Ticket Queue/operations ผ่าน staff endpoints อย่างชัดเจน เพื่อรองรับ owner และ IT Priority rule ของ labsheet; User Management ยังคงห้าม IT Staff
- `ownerId` หมายถึง active assignment เท่านั้น ส่วน `lastOwnerId` เก็บ final historical owner เมื่อ Ticket ปิดหรือยกเลิก จึงไม่ใช้ historical rows เป็นเหตุผลบังคับ reassign ตอน deactivate/demote
- Staff/Admin download ใช้ route แยก `/api/staff/tickets/:id/attachments/:attId/download`; requester route เดิมยังเป็น owner-only และไม่ถูกเปิดกว้าง
- Staff queue default order คือ `updatedAt desc, id desc`; page size default 20 และสูงสุด 100
- User Management ไม่บังคับ pagination เพราะ labsheet ระบุว่าไม่จำเป็น; search กับ single role filter เพียงพอ
- `Problem Appears Resolved` เป็น indication ไม่ใช่ comment และไม่ใช่ status transition
- Contract นี้ไม่ claim ว่า implementation หรือ tests ผ่าน; สถานะจริงต้องบันทึกใน `tests.md` หลังแต่ละ PR
