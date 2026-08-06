# Lab 1 — Peer Review Record  (fill this in)

**Author:** พลัฏฐ์ อมาตย์ชยาภา — 67070507212 — GitHub: @L0u1sss
**Peer reviewer:** นายแทนบุญ เตียวสวัสดิ์ — 67070507211 — GitHub: @Tanaboonnnnn
**Peer reviewer:** นายฌาธนัชย์ อุทัยพิบูลย์ — 67070507210 — GitHub: @Chxtamos

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
|    5| feature/1-project-foundation |approved  |
|    6| feature/2-health-check |approved  |
|    7| feature/3-category-seed |approved  |
|    8| feature/4-category-list |approved  |

Reviewer comment I received: PR5 เเก้ไขทั้งหมดตามที่ feedback เรียบร้อย
PR6**จุดทีเรียบร้อยแล้ว**
- Backend /api/health เปลี่ยนเป็น HTTP 200
- JSON response ถูกต้อง
- มีการเรียก API จริงด้วย fetch
- มี loading state
- มี success/error state
- มีข้อความแจ้งเตือนเมื่อ Backend ใช้งานไม่ได้

**จุดที่ต้องแก้ไข**
- ปัญหา: มีการจัดการ categories เกินขอบเขต Issue 2
     -ไฟล์: client/src/App.tsx
       Issue 2 ควรจัดการเฉพาะสถานะ Health Check เท่านั้น แต่ไฟล์นี้ยังมีการจัดการข้อมูล categories ซึ่งเป็นงานของ Issue 4 ต้องแยกส่วนนี้ออกจาก PR ปัจจุบัน

- ปัญหา: เรียก setCategories(result.categories)
    - ไฟล์: client/src/App.tsx
       บรรทัดนี้เป็นการจัดเก็บข้อมูล categories ซึ่งอยู่ใน scope ของ Issue 4 ควรลบออกจาก PR นี้ และให้ Issue 2 จัดการเฉพาะผลลัพธ์ของ /api/health

- ปัญหา: แสดงรายการด้วย categories.map(...)
    - ไฟล์: client/src/App.tsx
      การใช้ categories.map(...) เป็น Category List UI ของ Issue 4 ต้องนำส่วนนี้ออกจาก PR ของ Issue 2

- ปัญหา: คืนค่า categories: [] ปลอม
    - ไฟล์: client/src/api.ts
       checkSystem() เรียกเฉพาะ /api/health แต่ยังคืนค่า categories: [] ทำให้ข้อมูลไม่ตรงกับการทำงานจริง ควรให้ฟังก์ชันนี้จัดการเฉพาะ Health Status และย้าย Category flow ไป Issue 4 

- ปัญหา: ข้อความสถานะไม่ตรงกับ Lab Sheet
   - ไฟล์: client/src/App.tsx
      ปรับข้อความให้ตรงกับ Lab Sheet เป็น System Status: Online และ System Status: Offline 
      
ตอนนี้ไม่มี Category UI แล้ว แต่ checkSystem() ยังคืนค่า categories: [] และใช้ SystemStatus ที่ผูกกับ Issue #4 อยู่
แนะนำให้แยกเป็น health-only response เพื่อไม่สร้างข้อมูล categories ปลอม และให้ Category flow อยู่ใน Issue #4 ครับโบร๋
แก้ที่่ไฟล์ client/src/api.ts ครับต้าว

PR7 Schema และ seed ถูกต้องแล้วโบร๋
- Category model มี id, unique name, createdAt
- seed มี 4 categories ครบ
- ใช้ upsert ทำให้รันซ้ำได้โดยไม่ซ้ำ

แต่ Issue 3 ยังต้องมี Prisma migration ที่สร้าง Category table ด้วย
ตอนนี้ใน Files changed ยังไม่เห็น server/prisma/migrations/.../migration.sql
ช่วยเพิ่ม migration และแนบผล npx prisma migrate status / npx prisma db seed ด้วยรับต้าวอ้วน 

PR8 ส่วนที่ดีแล้วครับโบร์

- `server/src/app.ts`
  - GET `/api/categories` เรียกข้อมูลผ่าน Prisma
  - คืนค่าเฉพาะ `id` และ `name`
  - เรียงลำดับด้วย `id ASC`
  - สำเร็จด้วย HTTP 200 และมี error handling

- `client/src/api.ts`
  - เรียก `/api/health` และ `/api/categories`
  - ไม่ hard-code รายการหมวดหมู่
  - ส่งข้อมูล categories กลับไปให้หน้าเว็บ

- `client/src/App.tsx`
  - แสดงรายการ categories จาก API
  - มี loading state
  - มี success และ error state
  - แสดง Offline เมื่อ API ล้มเหลว

- `server/tests/lab-01/categories.test.ts`
  - ทดสอบ HTTP 200
  - ทดสอบว่ามี 4 categories
  - ทดสอบชื่อและลำดับ ID

- `client/tests/lab-01/App.test.tsx`
  - ทดสอบแสดง categories เมื่อ API สำเร็จ
  - ทดสอบแสดง Offline และ error message เมื่อ API ล้มเหลว

สิ่งที่ต้องกลับไปคุยกับวาฬสีน้ำเงินนะครับโบร๋

1. `client/src/App.tsx`

   ข้อความยังไม่ตรงตาม Lab Sheet:

   - ปัจจุบัน: `Online`
   - ควรเป็น: `System Status: Online`

   - ปัจจุบัน: `Offline`
   - ควรเป็น: `System Status: Offline`

2. `client/src/api.ts`

   `checkSystem()` เรียก `/api/health` เอง แทนที่จะ reuse `checkHealth()` ที่มีอยู่แล้ว

   ควรให้ `checkSystem()` เรียก `checkHealth()` ก่อน แล้วจึงเรียก `/api/categories` เพื่อไม่ให้ logic health check ซ้ำกัน

3. `client/src/App.tsx`

   ใน `handleCheck()` ยังไม่ได้ล้างข้อมูลเก่าก่อนเริ่ม request ใหม่ เช่น `error` หรือ `categories`

   ควรล้าง state ก่อนเริ่ม loading เพื่อป้องกันข้อมูลเก่าค้างเมื่อ request รอบใหม่ล้มเหลว

4. `client/src/App.tsx`

   ควรมีหัวข้อระบุรายการหมวดหมู่ เช่น `Supported Request Categories` ให้ตรงกับ Lab Sheet และอ่านง่ายขึ้น

5. `client/tests/lab-01/App.test.tsx`

   ยังขาด test สำคัญ:

   - ทดสอบว่าเมื่อกดปุ่มแล้วแสดง `Loading...`
   - ทดสอบว่าเมื่อสำเร็จก่อน แล้ว request ครั้งถัดไปล้มเหลว จะไม่แสดง categories เก่าค้างอยู่

6. `server/tests/lab-01/categories.test.ts`

   ควรเพิ่มการตรวจสอบว่า response แต่ละรายการมีเฉพาะ `id` และ `name` ไม่มี field อื่น เช่น `createdAt`

**จุดที่ผ่านแล้ว หลังแก้**
`client/src/api.ts`
    ใช้ await checkHealth() แทนการเขียน health check ซ้ำ
    เรียก /api/categories ต่อหลัง health สำเร็จ
    ไม่ hard-code categories

`client/src/App.tsx`
      ล้าง error และ categories เก่าก่อนเริ่ม request ใหม่
      แสดง System Status: Online
      แสดง System Status: Offline
      แสดงหัวข้อ Supported Request Categories
      แสดง category จาก API พร้อม ID และชื่อ
      มี loading state และปุ่มถูก disable ระหว่างโหลด
      ไม่แสดง categories เก่าหลัง request ล้มเหลว

`client/tests/lab-01/App.test.tsx`
      ทดสอบ Online และ categories
      ทดสอบ Offline และ error message
      ทดสอบ Loading และปุ่ม disabled
      ทดสอบล้าง categories เก่าเมื่อ request ครั้งถัดไปล้มเหลว
      ตรวจข้อความสถานะตรงตาม Lab Sheet

`server/tests/lab-01/categories.test.ts`
      ตรวจว่า response มีเฉพาะ keys id และ name
      ตรวจจำนวน 4 รายการ
      ตรวจชื่อและลำดับ ID


ด้วยรักจากใจสุดโหด นายแทนบุญ เตียวสวัสดิ์ และคืนLuna sek solo

How I responded: PR6 แก้แล้วลูกพี่PRอีกรอบหน่อย

## Pull Requests I reviewed for my partner
My comment: PR5 ของ นายฌาธนัชย์ ลง package ครบ
run test ผ่าน 
ไม่มีไฟล์ที่เป็นsecrets โผล่มา
README ตรงตามงาน

PR6 ของ นายแทนบุญ GET /api/health returns HTTP 200. มีการแก้แล้ว
The JSON response contains status = ok and service = TokTickIT API. เช็คในไฟล์testแล้ว
A Supertest test verifies the endpoint. npm run test แล้ว
The React page displays the backend status based on a real API call ผ่าน
A useful error message appears when the backend is unavailable. ผ่านใช้งานได้จริง

PR7 ของ นายแทนบุญ โมเดล Category — ใน server/prisma/schema.prisma:23-27 มี id (auto increment), name (unique), createdAt (default now)
Migration — ไฟล์ server/prisma/migrations/20260805193129_init/migration.sql สร้างตาราง Category พร้อม unique index บนคอลัมน์ name
Seed — server/prisma/seed.ts:9 แทรกข้อมูล 4 รายการ: Account and Access, Hardware, Software, Network
รันซ้ำได้ไม่ซ้ำ — ใช้ prisma.category.upsert({ where: { name }, update: {}, create: { name } }) ทำให้รันกี่ครั้งก็ไม่เกิดข้อมูลซ้ำ
ไม่มีการ commit ข้อมูลลับ — ระบบติดตาม (track) เฉพาะ .env.example เท่านั้น ส่วน .gitignore กันไฟล์ .env และ *.env ไว้
คอมเม้นโดยพลัฏฐ์ เพื่อนรักAI และ สัตว์เลี้ยงตัวใหม่วาฬจากแดนมังกร
PR8 ของ นายแทนบุญ
1. GET /api/categories ดึงจาก PostgreSQL ผ่าน Prisma server/src/app.ts — getPrisma().category.findMany(...) พร้อม try/catch คืน 500
2. API คืน id + name เรียงลำดับชัดเจน orderBy: { id: "asc" }, select: { id: true, name: true } + test ตรวจว่า key เป็น id,name เป๊ะ และ id เรียงขึ้น
3. Supertest test ตรวจ response server/tests/lab-01/categories.test.ts — 200, length 4, ชื่อทั้ง 4 ตามลำดับ, id เรียงขึ้น, key ครบ id,name
4. React แสดงข้อมูลจาก API (ไม่ hard-code) api.ts — checkSystem() fetch จริง; App.tsx — categories.map() จาก state
5. มี loading และ error states loading: ปุ่มขึ้น "Loading…" + disabled (มี test ตรวจด้วย toBeDisabled); error: "System Status: Offline" + ข้อความ
6. Vitest test ตรวจ UI App.test.tsx — 4 test: Online สำเร็จ, Offline ผิดพลาด, loading + รายการหมวดหมู่, ล้างข้อมูลเก่าตอน error
โดยนายพลัฏฐ์ และ นายหาลึกรุ่น๔แสงสระ(ใหม่)

Partner's response: <...>
