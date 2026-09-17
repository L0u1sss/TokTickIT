# TokTickIT Lab 3 REST API Contract

> สถานะ: Proposed contract สำหรับ peer review
>
> Issue: [#29](https://github.com/L0u1sss/TokTickIT/issues/29)
>
> เอกสารที่เกี่ยวข้อง: [specification.md](./specification.md), [ui-spec.md](./ui-spec.md), [tests.md](./tests.md)

## 1. Conventions

- Base path คือ `/api`; JSON ใช้ UTF-8, camelCase และเวลา ISO 8601 UTC
- Request JSON ต้องเป็น object, `Content-Type: application/json` และ reject unknown fields
- Integer path/query IDs ต้องเป็น positive base-10 integer; string length นับด้วย Unicode code points หลัง trim
- Protected requests ใช้ cookie `toktickit_session`; client ส่ง `credentials: "include"`
- ทุก browser request ที่ใช้ unsafe method ต้องส่ง `Origin` ตรง configured client origin รวม `POST /api/auth/login`; missing/unapproved Origin คืน `403 ORIGIN_NOT_ALLOWED` ก่อน credential/body validation
- Response ห้ามมี `password`, `passwordHash`, session token/hash หรือ Internal Notes สำหรับ Requester
- Endpoint เดิมของ Lab 2 คง path เดิม แต่ไม่ใช้ `x-requester-id`; identity มาจาก session ตาม BR-12

### 1.1 Authentication precedence

1. ไม่มี/invalid/expired/revoked session → `401 AUTHENTICATION_REQUIRED`
2. user inactive → revoke session และ `401 AUTHENTICATION_REQUIRED`
3. `mustChangePassword = true` และไม่ใช่ `/auth/me`, `/auth/change-password`, `/auth/logout` → `403 PASSWORD_CHANGE_REQUIRED`
4. role ไม่อนุญาต → `403 FORBIDDEN`
5. resource-scoped access ที่อาจเปิดเผยข้อมูลผู้อื่น → safe `404 NOT_FOUND`
6. จากนั้นจึง validate business transition/conflict

### 1.2 Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fieldErrors": { "email": "Enter a valid email address." },
    "requestId": "req_01J..."
  }
}
```

`fieldErrors` มีเฉพาะ validation ที่ปลอดภัย; unexpected `500` ใช้ code `INTERNAL_ERROR` และข้อความทั่วไป Server log ใช้ `requestId` แต่ไม่ log secrets

Issue #31 compatibility note: existing Ticket form clients may still read the Lab 2 `details` array; those validation responses retain it alongside `fieldErrors`. Protected API errors now include `requestId` (also sent as `X-Request-ID`). Foreign and missing Tickets use safe `404 NOT_FOUND`; a wrong role still receives `403 FORBIDDEN` before resource lookup.

| Status | Meaning |
|---:|---|
| `400` | malformed path/query/body หรือ validation failure |
| `401` | ไม่มี authenticated session หรือ login credentials ไม่ผ่าน |
| `403` | authenticated แต่ role/forced-password state ไม่อนุญาต |
| `404` | resource ไม่มีหรือถูกซ่อนจาก caller |
| `409` | state conflict เช่น duplicate email, concurrent claim, invalid transition |
| `500` | safe unexpected server failure |

## 2. Shared Schemas

### 2.1 `CurrentUser`

```json
{
  "id": 7,
  "displayName": "Narin Requester",
  "email": "narin.requester@example.test",
  "role": "REQUESTER",
  "mustChangePassword": false
}
```

Role มี `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`

### 2.2 Ticket operational values

- Priority: `LOW`, `MEDIUM`, `HIGH`
- Status: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`
- Owner summary: `{ "id": 12, "displayName": "Mali Staff", "email": "mali.staff@example.test" }` หรือ `null`
- Ticket responses ต่อจาก Lab 2 โดยเพิ่ม `owner`, `itPriority`, `problemAppearsResolvedAt` และ `problemAppearsResolvedBy`; staff detail เพิ่ม requester summary

### 2.3 `PublicComment` and `InternalNote`

```json
{
  "id": 42,
  "content": "The issue still occurs after restarting.",
  "author": { "id": 7, "displayName": "Narin Requester", "role": "REQUESTER" },
  "createdAt": "2026-09-13T08:30:00.000Z"
}
```

Internal Note ใช้ shape เดียวกันแต่ต้องปรากฏเฉพาะ staff API/role และไม่มีใน requester ticket/comment response

### 2.4 `UserSummary`

```json
{
  "id": 12,
  "displayName": "Mali Staff",
  "email": "mali.staff@example.test",
  "role": "IT_STAFF",
  "isActive": true,
  "mustChangePassword": false,
  "createdAt": "2026-09-01T00:00:00.000Z",
  "updatedAt": "2026-09-13T08:00:00.000Z"
}
```

## 3. Authentication and Session

Implementation note (#30 + #31): this branch includes the reviewed authentication foundation and the session-based Requester API/selector cutover. Staff/Admin operational APIs remain later issues. Issue #30 closure still requires the #31 cutover to be merged and verified. [Setup, rate-limit policy and handoff](./authentication-implementation.md). Login counts ten failed credential checks per IP + normalized email per fifteen-minute fixed window, then returns `429 TOO_MANY_ATTEMPTS` with `Retry-After`. Successful logins neither consume nor reset this budget; validation/server failures are not counted. Already in-flight concurrent checks may finish before the threshold is observed.

### 3.1 Login

```http
POST /api/auth/login
Content-Type: application/json
```

Body: `{ "email": "user@example.test", "password": "Local-only-password1!" }`

- `email`: required, trimmed, valid format, max 254 code points
- `password`: required string, max 128 code points; login ไม่ trim password
- `200`: `{ "user": CurrentUser }` พร้อม `Set-Cookie`
- `400 VALIDATION_ERROR`: invalid shape/type/length
- `401 AUTHENTICATION_FAILED`: unknown email, wrong password และ inactive account (รวม valid password) ใช้ข้อความเดียวกัน `Unable to sign in with the provided credentials.`; ไม่สร้าง session หรือออก authenticated session cookie
- ทั้งสามกรณีใช้ error envelope เดียวกัน ไม่มี account-specific detail/fieldErrors; `requestId` ต่างกันได้ Login ไม่คืน code แยกเพื่อเปิดเผย inactive account ตาม BR-02
- `500 INTERNAL_ERROR`: safe failure

Request นี้ต้องผ่าน Origin check แม้ caller ยังไม่มี session cookie เพราะ response ที่สำเร็จจะสร้าง cookie; invalid/missing Origin ต้องไม่ตรวจหรือเปิดเผยผล credentials

Login endpoint ต้อง rate-limit แบบ local-course appropriate ต่อ IP+normalized email และคืน `429 TOO_MANY_ATTEMPTS` พร้อม `Retry-After` หลังเกิน policy ที่ implementation document

### 3.2 Current user

```http
GET /api/auth/me
```

- `200`: `{ "user": CurrentUser }`
- `401`: ไม่มี valid session
- endpoint นี้ใช้ได้แม้ `mustChangePassword = true`

### 3.3 Change required password

```http
POST /api/auth/change-password
Content-Type: application/json
```

Body:

```json
{
  "currentPassword": "Initial-password1!",
  "newPassword": "New-local-password2!",
  "confirmPassword": "New-local-password2!"
}
```

- `200`: `{ "user": CurrentUser }` โดย `mustChangePassword: false`
- `400 VALIDATION_ERROR`: password policy/confirmation/shape
- `401 CURRENT_PASSWORD_INCORRECT`: session valid แต่ current password ไม่ตรง
- `409 PASSWORD_REUSE_NOT_ALLOWED`: new password ตรงกับ current password
- สำเร็จแล้วคง current session ได้ แต่ rotate token และ revoke session อื่นทั้งหมด

### 3.4 Logout

```http
POST /api/auth/logout
```

คืน `204 No Content`, revoke session ถ้ามี และ expire cookie; เรียกโดยไม่มี/หมดอายุ session ยังคง `204`

## 4. Requester APIs Migrated from Lab 2

Allowed role: `REQUESTER`; paths และ success schemas เดิมคงอยู่

| Capability | Method/path | Lab 3 change |
|---|---|---|
| Metadata | `GET /api/metadata` | authenticated; active categories/systems |
| Create Ticket | `POST /api/tickets` | requester from session; reject body `requesterId` |
| My Tickets | `GET /api/tickets` | session-scoped; expanded status values |
| Ticket Detail | `GET /api/tickets/:id` | submitting Requester-only safe lookup; adds operational read-only fields |
| Upload | `POST /api/tickets/:id/attachments` | submitting Requester only; uploader from session |
| Download | `GET /api/tickets/:id/attachments/:attId/download` | submitting Requester-only private download |
| Remove | `PATCH /api/tickets/:id/attachments/:attId/remove` | submitting Requester only; remover from session |

`GET /api/requesters` ถูกถอดออกและไม่มี selector replacement endpoint Legacy `x-requester-id` ถูก ignore และห้ามมีผลต่อ query/write; ownership tests ต้องส่งค่าของ user อื่นเพื่อยืนยัน

### 4.1 Requester Public Comments

```http
GET  /api/tickets/:id/comments
POST /api/tickets/:id/comments
```

- owner Requester เท่านั้น
- GET `200`: `{ "items": PublicComment[] }` เรียง `createdAt asc, id asc`
- POST body `{ "content": "..." }`; `201`: `PublicComment`
- content 1–2,000 code points หลัง trim; reject actor/author/timestamp fields
- unowned/missing Ticket → safe `404`; invalid content → `400`

### 4.2 Problem Appears Resolved

```http
POST /api/tickets/:id/problem-appears-resolved
```

- owner Requester เท่านั้น; body เป็น `{}` หรือไม่มี body และ current status ต้องเป็น `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER` หรือ `REOPENED`
- `200`: `{ "problemAppearsResolvedAt": "...", "problemAppearsResolvedBy": CurrentUserSummary }`
- ส่งซ้ำสำหรับ indication ปัจจุบันคืน representation เดิมและไม่เปลี่ยน Ticket status
- status `RESOLVED`, `CLOSED` หรือ `CANCELLED` → `409 RESOLUTION_INDICATION_NOT_ALLOWED`; status transition ไป `REOPENED` clear indication เดิม

## 5. IT Staff APIs

ทุก endpoint ในหัวข้อนี้อนุญาต `IT_STAFF` และ `ADMINISTRATOR` ตาม authorization matrix ที่ทีมอนุมัติ

### 5.1 Ticket Queue

```http
GET /api/staff/tickets?search=printer&status=OPEN&requestedPriority=HIGH&itPriority=MEDIUM&ownerId=unassigned&sortBy=updatedAt&sortOrder=desc&page=1&pageSize=20
```

| Query | Rules |
|---|---|
| `search` | optional, trimmed 1–120; match case-insensitive Ticket Number, Summary, Requester name/email |
| `status` | optional exact status enum |
| `requestedPriority` | optional exact priority enum |
| `itPriority` | optional exact priority enum |
| `ownerId` | optional positive active IT Staff/Administrator ID, `me`, หรือ `unassigned` |
| `sortBy` | `updatedAt` (default), `createdAt`, `ticketNumber`, `itPriority`, `status` |
| `sortOrder` | `desc` default หรือ `asc` |
| `page` | positive integer, default 1 |
| `pageSize` | 1–100, default 20 |

Unknown, duplicate หรือ invalid query parameter คืน `400 INVALID_QUERY`; ไม่มี silent fallback

`200`:

```json
{
  "items": [
    {
      "id": 101,
      "ticketNumber": "TK-2026-000101",
      "createdAt": "2026-09-10T04:00:00.000Z",
      "updatedAt": "2026-09-13T08:00:00.000Z",
      "summary": "Printer is unavailable",
      "category": { "id": 1, "name": "Hardware" },
      "requester": { "id": 7, "displayName": "Narin Requester", "email": "narin.requester@example.test" },
      "requestedPriority": "HIGH",
      "itPriority": "MEDIUM",
      "status": "OPEN",
      "owner": null
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1 },
  "filters": { "search": "printer", "status": "OPEN", "requestedPriority": "HIGH", "itPriority": "MEDIUM", "ownerId": "unassigned", "sortBy": "updatedAt", "sortOrder": "desc" }
}
```

Ordering ต้อง deterministic โดยเติม `id` ทิศเดียวกับ sort เป็น tie-breaker

### 5.2 Staff reference data

```http
GET /api/staff/assignees
```

คืน `200 { "items": UserSummary[] }` เฉพาะ active `IT_STAFF` หรือ `ADMINISTRATOR` เรียง `displayName asc, id asc` สำหรับ owner filter/assignment

### 5.3 Staff Ticket Detail

```http
GET /api/staff/tickets/:id
```

คืน `200` Ticket detail ที่รวม requester, category/system, requested/IT priorities, active `owner`, historical `lastOwner`, status, resolution indication, active attachment metadata และ Public Comments; Internal Notesดึงแยกเพื่อไม่ปะปน response ไม่พบ → `404` Attachment download actionต้องใช้ staff routeในหัวข้อ 5.4 ไม่ใช้ requester route

### 5.4 Download an active Attachment

```http
GET /api/staff/tickets/:id/attachments/:attId/download
```

- Allowed roles: `IT_STAFF`, `ADMINISTRATOR`
- `200`: private file bytes พร้อม validated `Content-Type`, exact `Content-Length`, `X-Content-Type-Options: nosniff` และ safe `Content-Disposition: attachment` filename เช่นเดียวกับ Lab 2
- malformed IDs → `400`; missing Ticket, wrong-Ticket Attachment, missing metadata/file หรือ removed Attachment → safe `404 NOT_FOUND`
- storage key/path ไม่ปรากฏใน URL, JSON, header หรือ error; safe pre-stream failureใช้ `500 INTERNAL_ERROR`
- Requester เรียก staff route → `403 FORBIDDEN`; requester route `/api/tickets/:id/attachments/:attId/download` ยังคง owner-only

### 5.5 Claim and assign/reassign

```http
POST  /api/staff/tickets/:id/claim
PATCH /api/staff/tickets/:id/owner
```

- Claim body `{}`; `200` คืน updated owner; assigned อยู่แล้ว → `409 TICKET_ALREADY_ASSIGNED`
- Owner body `{ "ownerId": 12 }`; target ต้องเป็น active `IT_STAFF` หรือ `ADMINISTRATOR`; `200` คืน updated owner
- malformed `ownerId` → `400 VALIDATION_ERROR`; missing target/Ticket → `404`; inactiveหรือ non-operational target → `409 INVALID_ASSIGNEE`
- `CLOSED`/`CANCELLED` → `409 TICKET_NOT_ASSIGNABLE`
- Claim/assign/reassign กับ deactivate/demote ต้องใช้ PostgreSQL transaction-scoped advisory lock namespace เดียวกัน keyed by target `User.id` จากนั้น re-check Ticket status, owner, target role และ activation ก่อน write หาก assignment commitก่อน account mutationต้องคืน `409 USER_HAS_ASSIGNED_TICKETS`; หาก account mutation commitก่อน assignmentต้องคืน `409 INVALID_ASSIGNEE`

### 5.6 Update IT Priority

```http
PATCH /api/staff/tickets/:id/it-priority
```

Body `{ "itPriority": "HIGH" }`; `200` คืน `{ "itPriority": "HIGH", "updatedAt": "..." }`; invalid value/shape → `400`

### 5.7 Update status

```http
PATCH /api/staff/tickets/:id/status
```

Body `{ "status": "IN_PROGRESS" }`; `200` คืน status และ updatedAt; value unknown → `400`; known แต่ transition ไม่อนุญาต → `409 INVALID_STATUS_TRANSITION` เมื่อ target เป็น `CLOSED` หรือ `CANCELLED` server ต้อง copy current `owner` ไป `lastOwner`, clear `owner` และเปลี่ยน statusใน transactionเดียวกัน; transitionไป `REOPENED` clear Problem Appears Resolved indication เดิม

### 5.8 Staff Public Comments

```http
GET  /api/staff/tickets/:id/comments
POST /api/staff/tickets/:id/comments
```

ใช้ schema/order/validation เดียวกับ requester comments แต่เข้าถึง Ticket ใดก็ได้ใน staff scope

### 5.9 Internal Notes

```http
GET  /api/staff/tickets/:id/internal-notes
POST /api/staff/tickets/:id/internal-notes
```

- GET `200 { "items": InternalNote[] }` เรียง `createdAt asc, id asc`
- POST body `{ "content": "..." }`; `201 InternalNote`
- content 1–4,000 code points, append-only, author/time จาก server
- Requester เรียก staff path → `403` ก่อนอ่าน Ticket/note; note ไม่มีใน requester payload ใด

## 6. Administrator APIs

ทุก endpoint ในหัวข้อนี้อนุญาต `ADMINISTRATOR` เท่านั้น

### 6.1 List/search users

```http
GET /api/admin/users?search=mali&role=IT_STAFF
```

- `search`: optional trimmed 1–120, case-insensitive name/email
- `role`: optional exact role; มี single role filter เท่านั้น
- ไม่มี pagination/multi-sort ตาม scope; เรียง `displayName asc, id asc`
- `200 { "items": UserSummary[], "filters": { "search": "mali", "role": "IT_STAFF" } }`
- invalid/unknown query → `400 INVALID_QUERY`

### 6.2 Create user

```http
POST /api/admin/users
```

```json
{
  "displayName": "Mali Staff",
  "email": "mali.staff@example.test",
  "role": "IT_STAFF",
  "isActive": true,
  "initialPassword": "Local-only-password1!"
}
```

- name 1–120, email max 254, exact one role, boolean state, passwordตาม BR-04
- `201 UserSummary` พร้อม `Location: /api/admin/users/{id}` และ `mustChangePassword: true`
- duplicate normalized email → `409 EMAIL_ALREADY_EXISTS`; invalid role/body → `400`

### 6.3 Update user

```http
PATCH /api/admin/users/:id
```

Body ต้องมีอย่างน้อยหนึ่ง field จาก `displayName`, `email`, `role`, `isActive`; ไม่มี password field

- `200 UserSummary`
- target missing → `404`
- duplicate email → `409 EMAIL_ALREADY_EXISTS`
- deactivate self → `409 SELF_DEACTIVATION_NOT_ALLOWED`
- deactivate/change role ของ last active Administrator → `409 LAST_ACTIVE_ADMIN_REQUIRED`
- deactivate/changeเป็น Requester ขณะที่ target ยังมี active `Ticket.ownerId` → `409 USER_HAS_ASSIGNED_TICKETS`; historical `lastOwner` ไม่ขวาง operation
- account mutationต้องใช้ cross-operation lock เดียวกับ claim/assign/reassign แล้ว re-check active assignmentsก่อน commit เพื่อป้องกัน target กลายเป็น ineligible ownerจาก concurrent requests

### 6.4 Set new initial password

```http
POST /api/admin/users/:id/initial-password
```

Body `{ "initialPassword": "New-local-password2!" }`; `200 { "user": UserSummary }` โดย `mustChangePassword: true`; revoke active sessions ของ target; invalid password → `400`; missing target → `404`

ไม่มี `DELETE /api/admin/users/:id`

## 7. Exact Capability Matrix

| Endpoint group | Requester | IT Staff | Administrator |
|---|:---:|:---:|:---:|
| `/api/auth/me`, logout, change-password | Allowed | Allowed | Allowed |
| Lab 2 `/api/tickets*` requester paths | Own only | Forbidden | Forbidden |
| requester comments/resolution indication | Own only | Forbidden | Forbidden |
| `/api/staff/tickets*` รวม Attachment download | Forbidden | Allowed | Allowed |
| `/api/admin/*` | Forbidden | Forbidden | Allowed |

ทุก endpoint อาจคืน safe `500 INTERNAL_ERROR`; mutating endpoint อาจคืน `429` ตาม rate/abuse controls ไม่มี endpoint ใดใช้ UI state เป็น authorization

## 8. Deferred API Capabilities

- Password-reset email, invitations, account unlock และ self-registration
- User deletion/bulk/import/export/history/multiple roles
- Actions Taken, SLA, notifications และ analytics
- Comment/note edit/delete
- IT Staff User Management; Administrator Ticket operationsอนุญาตเฉพาะตาม matrix ปัจจุบัน
