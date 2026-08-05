
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
├── client/          # โค้ดส่วนหน้าเว็บ React (Vite + Bootstrap)
├── server/          # โค้ดส่วนหลังบ้าน Node.js & Express
├── prisma/          # สคีมาและไฟล์ไมเกรตของฐานข้อมูล
├── tests/           # ไฟล์ทดสอบอัตโนมัติ (Vitest & Supertest)
└── docs/            # เอกสารประกอบแล็บ (reviewer.md, ai_use.md, tests.md)

```

---

## Getting Started / Installation (วิธีติดตั้งและเริ่มใช้งาน)

### 1. โคลน Repository

```
git clone <https://github.com/L0u1sss/TokTickIT>
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
4. เริ่มต้นใช้งาน Prisma และรัน migration:
```
npx prisma generate

```



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
* **ทดสอบฝั่ง Backend:** ไปที่โฟลเดอร์ `server/` แล้วรัน `npm run test`

