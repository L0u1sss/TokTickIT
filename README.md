
# TokTickIT - IT Service Desk (Lab 1–3)

## Lab 3 authentication and identity migration — Issues #30–#31

วิธีตั้งค่า User/Session, migrate ข้อมูลเดิม และเปิดหน้า `/login` อยู่ใน [Identity migration setup and scope](docs/lab-03/identity-migration.md) ส่วน [Authentication baseline #30](docs/lab-03/authentication-implementation.md) เก็บบริบทก่อน cutover

เริ่มจาก `server`: ติดตั้ง dependencies, `npx prisma generate`, `npx prisma migrate deploy`, ตั้ง `CLIENT_ORIGIN=http://localhost:5173` และ `NODE_ENV=development` ใน `.env` แล้วรัน `npm run auth:provision -- --email auth-demo@example.test --name "Local Auth Demo" --role REQUESTER` เพื่อรับ initial password ที่แสดงครั้งเดียว จากนั้นเปิด server/client และเข้า `http://localhost:5173/login`

Issue #31 เปลี่ยน Ticket/Attachment API ให้ใช้ session identity แล้ว ไม่มี Development Requester selector อีกต่อไป ดู [migration, initial password, role scope และวิธีรัน](docs/lab-03/identity-migration.md) ก่อน migrate ฐานเดิม ห้าม reset ฐานเพื่อข้ามปัญหา ID/email ชนกัน

สำหรับฐาน local Lab เท่านั้น: หลัง `prisma migrate deploy` และ `prisma db seed` ใช้ `jennifer.a@example.com`, `staff.one@example.com` หรือ `admin@example.com` กับ initial password `Lab3-Initial-password1!` แล้วเปลี่ยนรหัสผ่านก่อนใช้งาน บัญชีเดิมที่เปลี่ยนรหัสผ่านแล้วจะไม่ถูก reset โดย seed ส่วนหน้าปฏิบัติงาน Staff/Admin ยังเป็นงาน issue ถัดไป

## Lab 3 IT Staff Ticket Queue — Issue #32

IT Staff and Administrators can open `/staff/tickets` to search, filter, sort and
paginate the shared queue. Desktop uses a table; tablet/mobile use cards. The
queue opens read-only Ticket Detail; operational actions remain issue #33.

Before starting this version, apply the additive migration from `server` with
`npx prisma migrate deploy` and regenerate the client with `npx prisma generate`.
The migration preserves existing Tickets/Attachments, initializes IT Priority
from Requested Priority, and adds optional ownership and Lab 3 status values.

PR #43's follow-up migration removes the static IT Priority default. All Ticket
creation code must explicitly copy Requested Priority to `itPriority`; omitted values
are rejected. Apply pending migrations even if the original queue migration already ran.
Existing priority values are preserved, including later staff adjustments.

Run `node client/scripts/run-auth-e2e.mjs --staff-queue` from the repository root
for an isolated live queue test and responsive screenshots. It requires the
existing `TEST_DATABASE_URL` configuration and creates its own disposable schema.
See [implementation and scope](docs/lab-03/staff-queue-implementation.md) and
[verification evidence](docs/lab-03/tests.md).

## Tech Stack

* **Frontend:** React + TypeScript + Vite
* **Backend:** Node.js + Express + TypeScript
* **Database & ORM:** PostgreSQL + Prisma
* **Testing:** Vitest, Supertest และ Playwright Chromium

---

## Project Structure

โครงสร้างหลักของไฟล์ที่ track อยู่ใน repository ปัจจุบัน:

```text
TokTickIT/
├── .github/
│   └── workflows/
│       └── ci.yml
├── client/
│   ├── e2e/
│   │   └── lab-02/
│   ├── scripts/
│   ├── src/
│   │   ├── components/
│   │   └── context/
│   ├── tests/
│   │   ├── lab-01/
│   │   └── lab-02/
│   ├── playwright.config.ts
│   └── playwright.live.config.ts
├── docs/
│   ├── lab-01/
│   └── lab-02/
│       └── evidence/
├── server/
│   ├── prisma/
│   │   └── migrations/
│   ├── scripts/
│   ├── src/
│   └── tests/
│       ├── lab-01/
│       └── lab-02/
├── .gitignore
└── README.md
```

---

## Quick Start: วิธีติดตั้งและรันทีละขั้น

คำสั่งในหัวข้อนี้รันจาก repository root (`TokTickIT/`) ด้วย PowerShell ยกเว้นเมื่อระบุเป็นอย่างอื่น

### สิ่งที่ต้องมี

- Node.js 22 ขึ้นไปและ npm
- PostgreSQL ที่กำลังทำงานอยู่
- Git

### ขั้นที่ 1: Clone repository

```powershell
git clone https://github.com/L0u1sss/TokTickIT.git
Set-Location TokTickIT
```

หากมี repository อยู่แล้ว ให้เปิด PowerShell ที่โฟลเดอร์ `TokTickIT` และเริ่มจากขั้นที่ 2

### ขั้นที่ 2: ติดตั้ง dependencies

```powershell
npm --prefix server ci
npm --prefix client ci
```

### ขั้นที่ 3: สร้าง development database

ตัวอย่างสำหรับ PostgreSQL local ที่ใช้ผู้ใช้ `postgres`:

```powershell
psql -U postgres -c "CREATE DATABASE toktickit;"
```

หาก PostgreSQL แจ้งว่าฐานข้อมูล `toktickit` มีอยู่แล้ว ให้ข้ามคำสั่งนี้ได้ ห้ามใช้ `prisma migrate reset` กับฐานข้อมูลที่มีข้อมูลซึ่งต้องการเก็บไว้

### ขั้นที่ 4: สร้างไฟล์ environment

```powershell
if (-not (Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
if (-not (Test-Path client/.env)) { Copy-Item client/.env.example client/.env }
```

แก้ `server/.env` ให้ username, password, host และ port ตรงกับ PostgreSQL ของเครื่อง ตัวอย่าง:

```dotenv
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/toktickit?schema=public"
TEST_DATABASE_URL="postgresql://postgres:<password>@localhost:5432/toktickit_test?schema=public"
PORT=3000
ATTACHMENT_STORAGE_DIR="./.attachment-storage"
```

`TEST_DATABASE_URL` ใช้เฉพาะชุดทดสอบ database และต้องชี้ไปคนละฐานข้อมูลกับ `DATABASE_URL` หากยังไม่รัน database tests สามารถเตรียมค่านี้ภายหลังได้

ตรวจ `client/.env` ให้ Client เรียก Server ที่ port 3000:

```dotenv
VITE_API_URL="http://localhost:3000"
```

ไฟล์ `.env` ทั้งสองไฟล์เป็นข้อมูลเฉพาะเครื่องและต้องไม่ commit

### ขั้นที่ 5: เตรียม Prisma schema และข้อมูลเริ่มต้น

```powershell
Push-Location server
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
Pop-Location
```

ผล seed ปกติคือ 4 Categories, 6 Related Systems, 5 Requesters, 4 IT Staff และ 1 Administrator การรันซ้ำไม่สร้างข้อมูลซ้ำและไม่ reset credentials ของบัญชีเดิม

### ขั้นที่ 6: เปิด Backend ใน Terminal 1

```powershell
npm --prefix server run dev
```

รอจนเห็นข้อความ:

```text
TokTickIT API listening on http://localhost:3000
```

จากนั้นตรวจ health endpoint:

```powershell
Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing
```

ควรได้ HTTP `200` และ JSON ที่มี `"status":"ok"`

### ขั้นที่ 7: เปิด Frontend ใน Terminal 2

เปิด PowerShell อีกหน้าต่างที่ repository root แล้วรัน:

```powershell
npm --prefix client run dev
```

เปิด URL ที่ Vite แสดง โดยปกติคือ [http://localhost:5173](http://localhost:5173)

### ขั้นที่ 8: Login และตรวจ session

เปิด `/login` และใช้บัญชี local ที่ seed หรือสร้างด้วย `auth:provision` จากนั้นเปลี่ยน initial password ก่อนใช้ Ticket screens หน้า Requester แสดง Create Ticket/My Tickets และ Logout โดยไม่มี selector

`GET /api/health` ยังเป็น public ส่วน Ticket/metadata/categories ต้องส่ง session cookie; การเปิด API โดยไม่ Login ได้ `401` เป็นพฤติกรรมที่ถูกต้อง `/api/requesters` ถูกยกเลิกแล้ว หาก Login ไม่สำเร็จ ให้ตรวจ API server, database, migration และ `CLIENT_ORIGIN` ให้ตรงกับ URL ของ Vite

### การรันครั้งถัดไป

หากเตรียมฐานข้อมูลแล้ว เปิดสอง Terminal จาก repository root:

```powershell
# Terminal 1
npm --prefix server run dev
```

```powershell
# Terminal 2
npm --prefix client run dev
```

หลัง pull หากมี migration หรือ dependencies ใหม่ ให้อัปเดต dependencies และรัน `prisma migrate deploy` ก่อนเปิดระบบ โดยไม่ reset ฐานเดิม


## Running Tests (การรันระบบทดสอบ)

สำหรับ Lab 3 แนะนำ `npm --prefix server run test:isolated` ซึ่งสร้าง schema ชั่วคราวจาก `TEST_DATABASE_URL`, migrate/seed, รัน suite และลบเฉพาะ schema ที่สร้างเอง โดยไม่ reset development หรือ shared test schema

วิธีรันชุดทดสอบอัตโนมัติที่ตั้งค่าไว้ในโปรเจกต์:

* **ทดสอบฝั่ง Frontend:** ไปที่โฟลเดอร์ `client/` แล้วรัน `npm run test`
* **ทดสอบ Backend แบบไม่ใช้ฐานข้อมูล:** ไปที่โฟลเดอร์ `server/` แล้วรัน `npm run test:unit`
* **ทดสอบ Backend ทั้งหมด:** ต้องเตรียม PostgreSQL test database แยกจากฐานข้อมูล development ตามขั้นตอนด้านล่าง แล้วจึงรัน `npm run test`

### Dedicated PostgreSQL test database

ชุดทดสอบ database/integration จะไม่ fallback ไปใช้ `DATABASE_URL` และต้องมี `TEST_DATABASE_URL` ที่ชี้ไปยังฐานข้อมูลหรือ schema สำหรับทดสอบโดยเฉพาะ ห้ามใช้ฐานข้อมูลเดียวกับ development หรือ production เพราะ test fixtures อาจสร้าง แก้ไข และลบข้อมูลระหว่างการทดสอบ

1. สร้างฐานข้อมูล PostgreSQL สำหรับทดสอบแยกต่างหาก ตัวอย่างเมื่อใช้ PostgreSQL local:

```powershell
psql -U postgres -c "CREATE DATABASE toktickit_test;"
```

หากฐานข้อมูลมีอยู่แล้วและ PostgreSQL แจ้งว่า duplicate database สามารถข้ามขั้นตอนนี้ได้

2. คัดลอก `server/.env.example` เป็น `server/.env` แล้วกำหนด URL สองค่าที่ชี้คนละฐานข้อมูล:

```dotenv
DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public"
TEST_DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit_test?schema=public"
```

ปรับ username, password, host และ port ให้ตรงกับ PostgreSQL ของเครื่อง Reviewer โดยชื่อ database/schema ใน `TEST_DATABASE_URL` ต้องมี segment `test`, `testing`, `ci` หรือ `spec` เช่น `toktickit_test` ระบบทดสอบจะปฏิเสธ URL ที่ไม่มี marker นี้หรือชี้ target เดียวกับ `DATABASE_URL`

3. ติดตั้ง dependencies และเตรียม schema/seed บน test database จาก repository root ด้วย PowerShell:

```powershell
npm --prefix server ci
npm --prefix client ci

$env:TEST_DATABASE_URL = "postgresql://toktickit:toktickit@localhost:5432/toktickit_test?schema=public"
$developmentDatabaseUrl = $env:DATABASE_URL
$env:DATABASE_URL = $env:TEST_DATABASE_URL
& server/node_modules/.bin/prisma.cmd migrate deploy --schema server/prisma/schema.prisma
npm --prefix server run prisma:seed
$env:DATABASE_URL = $developmentDatabaseUrl
```

หลัง migrate/seed แล้ว `DATABASE_URL` ต้องกลับไปเป็น development target หรือไม่ถูกกำหนดใน shell ส่วน `TEST_DATABASE_URL` ต้องยังชี้ไปยัง test database แยกต่างหาก

4. รันชุดทดสอบ:

```powershell
# Database/integration tests only
npm --prefix server run test:db

# Full server regression, including the database project
npm --prefix server test

# Full client regression
npm --prefix client test

# Install the browser once, then run the Lab 2 responsive audit
npm --prefix client exec playwright install chromium
npm --prefix client run test:responsive

# Run the six live Lab 2 browser workflows against the real API, test database,
# and temporary private attachment storage
npm --prefix client run test:e2e
```

ชุด responsive จะเปิด Vite ชั่วคราวด้วยตัวเอง ใช้ deterministic mocked API fixtures และบันทึกภาพหลักฐาน 12 ภาพไว้ใน `docs/lab-02/evidence/` จึงไม่ต้องเปิด server หรือ PostgreSQL สำหรับคำสั่งนี้

ชุด live E2E จะอ่าน `TEST_DATABASE_URL` จาก environment หรือ `server/.env` แล้วตรวจว่าชื่อ database/schema มีคำว่า `test`, `testing`, `ci` หรือ `spec` และต้องไม่ใช่ target เดียวกับ `DATABASE_URL` จากนั้น runner จะ reset/migrate/seed เฉพาะ test database ก่อนแต่ละ scenario, เปิด Vite และ API ชั่วคราว และใช้โฟลเดอร์ attachment ชั่วคราว ชุดนี้ครอบคลุม `E2E-01`–`E2E-06` และจะล้างข้อมูลใน test database ดังนั้น **ห้ามชี้ `TEST_DATABASE_URL` ไปยัง development หรือ production database**

CI ใช้ PostgreSQL service และฐานข้อมูล `toktickit_test` แบบ isolated ด้วยหลักการเดียวกัน พร้อมติดตั้ง Chromium และรันทั้ง responsive audit กับ live E2E รายละเอียดคำสั่งเพิ่มเติมอยู่ใน `docs/lab-02/tests.md` ห้ามใช้ `prisma migrate reset` กับ development หรือ production database เพื่อเตรียม test environment

---

## Lab 3 — Users, Roles, IT Staff Ticketing และ Admin Screens

Lab 3 อ้างอิงจาก Lab 3 labsheet และต่อยอดจาก Lab 2 โดยเปลี่ยน Development Requester selector เป็นระบบ authentication จริง พร้อม role-based authorization สำหรับ 3 roles:

- **Requester** — สร้างและจัดการเฉพาะ Ticket/Attachment ของตนเอง, Public Comments และแจ้งว่า problem appears resolved
- **IT Staff** — ใช้ Ticket Queue, เปิด Ticket Detail, claim/reassign Ticket, ตั้ง IT Priority, เปลี่ยน status ตาม workflow, เขียน Public Comments และ Internal Notes
- **Administrator** — จัดการ User Management, สร้าง/แก้ไข user, กำหนด role เดียว, activate/deactivate และตั้ง initial password; contract ปัจจุบันอนุญาต Ticket Queue/operations ตาม authorization matrix อย่างชัดเจน

### Lab 3 scope

- Login, logout, current-user และ mandatory first-login password change
- Password hashing และ authenticated session/token ตาม contract ที่อนุมัติ
- Server-side authentication, role authorization และ ownership checks
- Migration จาก Lab 2 User/Requester identity โดยรักษา Ticket และ Attachment เดิม
- IT Staff Ticket Queue และ Ticket Detail operations
- Claim/reassign, IT Priority และ permitted status transitions
- Public Comments และ Internal Notes แบบ append-only
- Minimalist Administrator User Management
- Requester regression, responsive UI, accessibility และ end-to-end evidence

### Lab 3 out of scope

MFA, SSO, social login, email invitations, email password reset, self-registration, user deletion, bulk user operations, import/export, multiple roles, departments, multi-tenant organizations, SLA/escalation, notification services, analytics dashboards และ production cloud infrastructure

### Lab 3 documentation

เอกสาร contract และ evidence ต้องอยู่ใน `docs/lab-03/`:

```text
docs/lab-03/
├── specification.md
├── tests.md
├── ui-spec.md
├── api-spec.md
├── reviewer.md
├── ai-use.md
└── report.md
```

`specification.md`, `api-spec.md` และ `ui-spec.md` ต้องจัดทำก่อนหรือพร้อม implementation ส่วน `tests.md` ต้องมี unit, API/integration, authorization/security, migration/regression, UI, responsive, accessibility และ E2E traceability

### Lab 3 test structure

```text
server/tests/lab-03/
├── auth.api.test.ts
├── authorization.api.test.ts
├── staff-queue.api.test.ts
├── staff-ticket-detail.api.test.ts
├── comments-notes.api.test.ts
└── users-admin.api.test.ts

client/tests/lab-03/
├── Login.test.tsx
├── ChangePassword.test.tsx
├── StaffTicketQueue.test.tsx
├── StaffTicketDetail.test.tsx
└── UserManagement.test.tsx

e2e/lab-03/
├── authentication.spec.ts
├── staff-ticket-flow.spec.ts
└── user-administration.spec.ts
```

ชื่อไฟล์ข้างต้นเป็นโครงสร้างขั้นต่ำตาม labsheet ให้ปรับ path ให้ตรงกับไฟล์จริงเมื่อ implementation เสร็จ และบันทึก path จริงไว้ใน `docs/lab-03/tests.md`

### Lab 3 local workflow

Issue #37 testing evidence and the current AC-to-test mapping are in
[tests.md](docs/lab-03/tests.md) and
[issue-37-evidence.md](docs/lab-03/issue-37-evidence.md).
The required browser specs are in `client/e2e/lab-03/`.
Use `npm --prefix client run test:staff:e2e` for the full staff workflow, alongside
`test:auth:e2e` and `test:admin:e2e` for authentication and administration.
These runners require the documented `TEST_DATABASE_URL`, allocate disposable
schemas, and save screenshots under `artifacts/lab-03/screenshots/`.
Run `npm --prefix client ci` and install Playwright Chromium before the browser
suites. They include axe accessibility checks; local passing evidence does not
replace final-main CI or peer approval.

เริ่ม feature branch จาก `lab3-staging` ซึ่งทีมสร้างจาก baseline ที่รวม Lab 2 เสร็จแล้ว:

```powershell
git switch lab3-staging
git pull origin lab3-staging
git switch -c <lab3-feature-branch>
```

รันระบบจาก repository root:

```powershell
npm --prefix server run dev
npm --prefix client run dev
```

ก่อน merge ต้องรัน test ของ server/client, migration/regression, authorization, responsive และ E2E ตามคำสั่งที่บันทึกใน `docs/lab-03/tests.md` และต้องตรวจให้ test database แยกจาก development database

### Lab 3 PDF submission

Labsheet กำหนดให้ส่ง **PDF เพียง 1 ไฟล์** โดยใช้หัวข้อตามลำดับและชื่อ exact ดังนี้:

```text
Answer Part 1: Git Use with Engineering Workflow
Answer Part 2: Spec DD
Answer Part 3: Test DD and Traceability
Answer Part 4: AI Use with Reflection
Answer Part 5: Working Login and Password Change UI
Answer Part 6: Working IT Staff Ticket Queue UI
Answer Part 7: Working IT Staff Ticket Detail UI
Answer Part 8: Working Administrator User Management UI
Answer Part 9: Zen Green UI and Responsive Evidence
```

PDF ต้องมี working links, screenshots ที่อ่านได้ และ evidence จาก final `main` branch ส่วน `docs/lab-03/report.md` ใช้เป็นต้นฉบับสำหรับจัดทำ PDF ได้ แต่ไฟล์ที่ส่งจริงต้องเป็น PDF ไฟล์เดียว

