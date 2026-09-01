
# TokTickIT - IT Service Desk (Lab 1–2)

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

ผล seed ปกติคือ 4 Categories, 6 Related Systems และ 5 Requesters การรัน seed ซ้ำไม่สร้างข้อมูลซ้ำเพราะใช้ `upsert`

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

### ขั้นที่ 8: ตรวจ Development Requester

หน้าแรกควรแสดง requester ที่ active จำนวน 4 คน หากขึ้น **We couldn't load requesters.** ให้ตรวจตามลำดับ:

```powershell
# Server ต้องตอบ 200
Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing

# Requester API ต้องตอบ 200 และมีข้อมูล requester
Invoke-WebRequest http://localhost:3000/api/requesters -UseBasicParsing

# ตรวจและ apply migration ที่ยังขาด จาก repository root
Push-Location server
npx prisma migrate status
npx prisma migrate deploy
npm run prisma:seed
Pop-Location
```

จากนั้นกด **Retry** หรือ refresh หน้า Client

### การรันครั้งถัดไป

หากติดตั้งและเตรียมฐานข้อมูลแล้ว ปกติเปิดเพียงสอง Terminal:

```powershell
# Terminal 1
npm --prefix server run dev
```

```powershell
# Terminal 2
npm --prefix client run dev
```

หลัง `git pull` หากมี migration หรือ dependencies ใหม่ ให้รันขั้นที่ 2 และขั้นที่ 5 อีกครั้ง

---

## Running Tests (การรันระบบทดสอบ)

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

