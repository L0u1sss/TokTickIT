
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
* **ทดสอบฝั่ง Backend:** ไปที่โฟลเดอร์ `server/` แล้วรัน `npm run test`

