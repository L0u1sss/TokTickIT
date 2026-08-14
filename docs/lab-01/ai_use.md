# Lab 1 — AI Use and Reflection  (fill this in)

**LLM/agent used:** gemini 3.5 pro, claude opus, deepseek v4

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Run the automated tests for Issue 4 (category list) | ตรวจสอบผลลัพธ์จาก terminal: test ฝั่ง client ผ่าน 3/3; test ฝั่ง server รายการ categories ไม่ผ่านเพราะยังไม่ได้ตั้งค่าฐานข้อมูล PostgreSQL จึงได้ติดตั้งและตั้งค่าฐานข้อมูลให้พร้อมใช้งาน |
| 2 | Resolve the merge conflicts in PR #8 (feature/4-category-list) |  เลือกเก็บโค้ดเวอร์ชัน Issue 4 ไว้ใน client/src/App.tsx จากนั้น merge lab1-staging เข้าสู่ feature branch และ push ขึ้น GitHub ทำให้ PR พร้อม merge ได้|
| 3 | Verify the PR against the Issue 4 acceptance criteria | ตรวจสอบเกณฑ์ทั้ง 6 ข้อเทียบกับโค้ดจริง (การ query ผ่าน Prisma, การคืนค่า id/name ตามลำดับ, test ด้วย Supertest, UI ดึงข้อมูลจาก API, สถานะ loading/error, test ด้วย Vitest)  ผ่านครบทุกข้อ |
| 4 | Fix "PrismaClientInitializationError: DATABASE_URL not found" | วินิจฉัยพบว่า Prisma Client 5.22 ไม่โหลดไฟล์ .env อัตโนมัติตอน runtime จึงเพิ่ม loadEnvFile() ใน server/src/index.ts จากนั้นรัน server ใหม่และยืนยันว่า /api/categories คืนข้อมูลหมวดหมู่ครบ 4 รายการ |
| 5 | Display the category ID together with the name in the list | 	แก้ไข App.tsx ให้แสดงผลเป็น {category.id}. {category.name} และอัปเดตการตรวจสอบใน test ให้ตรงกับผลลัพธ์ใหม่ |
| 6 |  Apply the reviewer's feedback (System Status text, reuse checkHealth, clear stale state, headings, extra tests)| ปรับปรุง App.tsx, api.ts และไฟล์ test ทั้งสองชุด จากนั้นรัน test ซ้ำ  ฝั่ง client ผ่าน 5/5 และฝั่ง server ผ่าน 3/3 (ทดสอบกับ PostgreSQL จริง) |
| 7 | Match the error message to the Lab Sheet ("Unable to connect to TokTickIT API") | เปลี่ยนในส่วน catch ของ App.tsx ให้ใช้ข้อความตามที่ Lab กำหนด พร้อมอัปเดต test ให้สอดคล้อง |
| 8 | Demonstrate the failure case when the DB server is not started | หยุดบริการ PostgreSQL แต่เปิด API server ไว้ จากนั้นตรวจสอบว่า /api/health ยังตอบ 200 แต่ /api/categories ตอบ 500 และยืนยันว่าหน้าเว็บแสดง "System Status: Offline" ถูกต้อง |
| 9 | Add the Prisma migrate/seed commands to the README | 	เพิ่มคำสั่ง npx prisma migrate dev และ npx prisma db seed ในหัวข้อการติดตั้ง เพื่อให้ผู้ที่ clone โปรเจกต์ใหม่สามารถสร้างตารางและข้อมูลเริ่มต้นได้ครบถ้วน |
| 10 | Write a code review for PR #9 (Lab 1 release) | 	จัดทำ review พร้อมตารางเปรียบเทียบ acceptance criteria (ผล Approve) และข้อเสนอแนะแบบไม่บล็อกการ merge อีก 4 ข้อ (README ขาดคำสั่ง migrate/seed, โค้ด template ค้าง, seed ไม่มี log, server กลืน error เงียบ) |
## Reflection
Two or three sentences: what made your prompts better, and one place you had to
correct or reject what the agent produced.
ในกรณีที่มีโทเท็นเหลือเยอะจะพร่อมด้วยคำสั่งก้อนใหญ่ที่เดียวเลยแต่ยังไม่กด acccept ทั้งหมดให้ ค่อยๆดูที่ละคำสั่งย่อยของมันอันไหนผิดแผนก็กด skip พอเช็คเสร็จค่อยมาเก็บฟีเจอยิบย่อยอีกที่ แต่ถ้าโทเท็นหมดแล้วก็กลับไปใช้แค่ chatbot ไม่ได้ใช้ agent แล้วทำเองค่อยส่งให้มันดูแค่ error