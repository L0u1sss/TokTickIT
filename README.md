
# TokTickIT - IT Service Desk (Lab 1)

## Tech Stack
* **Frontend:** React + TypeScript + Vite + Bootstrap
* **Backend:** Node.js + Express + TypeScript
* **Database & ORM:** PostgreSQL + Prisma
* **Testing:** Vitest และ Supertest

---

## Project Structure
```text
toktickit/
├── client/
├── server/
│ ├── prisma/
│ ├── src/
│ └── tests/
│ └── lab-01/
├── docs/
│ └── lab-01/
│ ├── ai_use.md
│ └── reviewer.md
├── .gitignore
└── README.md

```

---

## Getting Started / Installation (วิธีติดตั้งและเริ่มใช้งาน)

### 1. โคลน Repository

```
git clone [https://github.com/L0u1sss/TokTickIT](https://github.com/L0u1sss/TokTickIT)
cd toktickit

```

### 2. ตั้งค่าฐานข้อมูลและระบบหลังบ้าน (Backend)

1. เข้าไปที่โฟลเดอร์ server:
```
cd server

```


2. ติดตั้งแพ็กเกจที่จำเป็น:
```
npm install

```


3. สร้างไฟล์ `.env` โดยคัดลอกมาจาก `.env.example` แล้วกำหนดค่าเชื่อมต่อฐานข้อมูล PostgreSQL (`DATABASE_URL`) ของคุณ
4. รัน Prisma migration เพื่อสร้างตารางในฐานข้อมูล และ seed ข้อมูลหมวดหมู่เริ่มต้น:
```
npx prisma migrate dev
npx prisma db seed

```
> **หมายเหตุ:** รัน seed ซ้ำได้เรื่อยๆ จะไม่สร้างข้อมูลซ้ำ (ใช้ `upsert`)
> หากเปลี่ยน schema แล้วต้องการ reset ฐานข้อมูล: `npx prisma migrate reset`



### 3. ตั้งค่าระบบหน้าบ้าน (Frontend)

1. กลับมาที่โฟลเดอร์ client:
```
cd ../client

```


2. ติดตั้งแพ็กเกจที่จำเป็น:
```
npm install

```



---

## Running the Application (วิธีรันแอปพลิเคชัน)

* **รันเซิร์ฟเวอร์หลังบ้าน (Development Server):**
```
cd server
npm run dev

```


* **รันหน้าเว็บ (Development Server):**
```
cd client
npm run dev

```

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
```

CI ใช้ PostgreSQL service และฐานข้อมูล `toktickit_test` แบบ isolated ด้วยหลักการเดียวกัน รายละเอียดคำสั่งเพิ่มเติมอยู่ใน `docs/lab-02/tests.md` ห้ามใช้ `prisma migrate reset` กับ development หรือ production database เพื่อเตรียม test environment

