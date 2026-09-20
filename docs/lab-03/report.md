# TokTickIT Lab 3 — Final Report

รายงานฉบับนี้จัดทำขึ้นเพื่อสรุปการพัฒนา การตรวจสอบ และหลักฐานประกอบการส่งงาน TokTickIT Lab 3 ตามหัวข้อที่กำหนดใน `Lab_3_sheet.pdf` และ Issue [#38](https://github.com/L0u1sss/TokTickIT/issues/38)
TokTickIT เป็นระบบ IT Service Desk สำหรับรับแจ้ง ติดตาม และดำเนินการคำร้องด้าน IT โดย Lab 3 ขยายระบบจากการใช้งานแบบ Development Requester ไปสู่ระบบที่มีการยืนยันตัวตนจริง รองรับ Requester, IT Staff และ Administrator พร้อมการควบคุมสิทธิ์ที่ backend, workflow ของ Ticket, Public Comments, Internal Notes และการจัดการผู้ใช้

เอกสารนี้แยก **implementation evidence**, **test evidence**, **browser/demo evidence** และ **peer-review evidence** ออกจากกันอย่างชัดเจน เพื่อให้ตรวจสอบย้อนกลับได้ว่าข้อความใดเป็นผลที่ตรวจแล้ว และข้อใดยังมีขอบเขตหรือข้อจำกัดที่ต้องพิจารณา
## Release Snapshot

| รายการ | หลักฐานล่าสุด | สถานะ |
| Final `main` commit | `6c5b14f2fa0ba836365d3c5a0b2736b1d6e67165` | ยืนยันจาก GitHub metadata |
| Implemented scope | Authentication, requester regression, staff queue/operations, comments/notes และ user management | พร้อมหลักฐานใน repository |
| Local automated verification | 509 test cases ผ่าน, 0 failures | ผ่าน |
| Browser/demo evidence | ภาพ workflow ของ Authentication, Requester, IT Staff, Administrator และ responsive UI | พร้อมดูใน [demo report](../../artifacts/lab-03/demo-report/README.md) |
| Peer-review record | 45 submitted review records: 17 reviews ที่ส่งให้เพื่อน และ 28 reviews ที่ได้รับ | บันทึกไว้ใน [reviewer.md](./reviewer.md) |
| Final hosted CI for this exact `main` commit | ไม่ได้ยืนยันในเอกสารชุดนี้ | ยังไม่ยืนยัน |
| Review/approval completion | มี Approved submissions หลาย PR แต่ PR #50 ยังมีผลล่าสุดเป็น Changes requested | ยังไม่สมบูรณ์ |

## Answer Part 1: Git Use with Engineering Workflow
การพัฒนา Lab 3 ใช้ Git workflow แยกงานตามขอบเขตของ feature และรวมงานผ่าน staging ก่อนนำเข้าสู่ `main` โดยลำดับงานหลักครอบคลุม engineering contract, authentication, identity migration, staff queue, staff operations, comments/notes, administrator user management, requester regression และ final verification

หลักฐานที่ใช้ตรวจสอบ workflow ได้แก่:
- [Issue #38](https://github.com/L0u1sss/TokTickIT/issues/38) และ issues ที่เชื่อมโยงกับ Lab 3
- commit final `6c5b14f2fa0ba836365d3c5a0b2736b1d6e67165` ซึ่งถูกบันทึกว่า merge เข้า `main` เมื่อวันที่ 20 กันยายน 2026
- [reviewer.md](./reviewer.md) สำหรับประวัติ PR, review submissions และผลการ review แต่ละรอบ
- [README.md](../../README.md) สำหรับวิธีติดตั้ง โครงสร้าง repository และคำสั่งรันระบบ
- โครงสร้างหลัก `client/`, `server/`, `docs/lab-03/`, `artifacts/lab-03/` และ `.github/workflows/`

การ merge เข้า `main` ไม่ได้ถูกตีความว่าเป็นการ Approved review โดยอัตโนมัติ สถานะ review และ approval จึงรายงานแยกตามหลักฐานใน `reviewer.md`
## Answer Part 2: Spec DD

ข้อกำหนดหลักของระบบอยู่ใน [specification.md](./specification.md) ซึ่งระบุ FR-01 ถึง FR-17, BR-01 ถึง BR-39, authorization matrix, status-transition matrix, data/migration decisions และ AC-01 ถึง AC-19 โดยมี [api-spec.md](./api-spec.md) และ [ui-spec.md](./ui-spec.md) เป็น contract สนับสนุน
ขอบเขตที่ implementation ครอบคลุมประกอบด้วย:

- Login, logout, session identity และ mandatory first-login password change
- Backend authentication, role authorization และ Requester ownership protection
- Migration จาก `RequesterUser` ไปยัง `User` โดยรักษาความสัมพันธ์ของ Ticket และ Attachment
- Requester workflow สำหรับสร้าง ดู และติดตาม Ticket รวมถึง Public Comments และ Problem Appears Resolved
- IT Staff queue ที่รองรับ search, filters, sorting, pagination และ responsive table/card presentation
- Ticket detail สำหรับ claim, assignment, IT Priority, status workflow, attachments, Public Comments และ Internal Notes
- Administrator user management สำหรับ list, search, role filter, create, edit, activate/deactivate และ reset initial password
- Responsive และ accessibility behavior ที่ตรวจผ่าน browser assertions ตามขอบเขตของหลักฐาน

การพิจารณาว่า requirement ใดผ่านหรือยังมีข้อจำกัดต้องอ่านร่วมกับ [tests.md](./tests.md) เนื่องจาก contract เป็นข้อกำหนดเชิง normative ส่วนผลการทดสอบเป็นหลักฐาน runtime ที่แยกจากกัน
## Answer Part 3: Test DD and Traceability

แผนการทดสอบและ traceability อยู่ใน [tests.md](./tests.md) ส่วนผลการรันล่าสุดสรุปไว้ใน [results.md](./results.md) การตรวจสอบ local ณ commit `6c5b14f2fa0ba836365d3c5a0b2736b1d6e67165` ผ่านทั้งหมด **509 test cases** โดยไม่มี failure

| กลุ่มการตรวจสอบ | ผลลัพธ์ |
|---|---:|
| Server isolated suite | 377/377 ผ่าน จาก 32 files |
| Client suite | 114/114 ผ่าน จาก 18 files |
| Authentication, Administrator, Staff queue, Staff operations และ Communications browser workflows | 5/5 ผ่าน |
| Requester live regression | 7/7 ผ่าน |
| Responsive browser checks | 6/6 ผ่าน |
| Server/client lint และ build | ผ่านทั้งสอง package |
| Prisma schema validation | ผ่าน |
การทดสอบฐานข้อมูลใช้ disposable test schemas เพื่อไม่กระทบ development database และ browser tests มี keyboard/axe assertions ตามที่ระบุใน test plan ทั้งนี้ responsive reflow ที่ viewport 720×450 เป็นการตรวจการจัดวางใหม่ ไม่ใช่การจำลอง browser zoom 200% โดยตรง

ผลชุดนี้เป็น **local verification evidence** ไม่ใช่การยืนยัน hosted CI สำหรับ final `main` และไม่ควรตีความว่าแทนที่ coverage ที่ยังมีสถานะ `Planned` ใน test matrix
## Answer Part 4: AI Use with Reflection

รายละเอียดการใช้ AI และการสะท้อนผลอยู่ใน [ai-use.md](./ai-use.md) โดยเปิดเผยเครื่องมือ/agent ที่ใช้ ขอบเขตของงาน prompt สำคัญ การตรวจสอบโดยผู้พัฒนา การแก้ไขจากผลทดสอบ และข้อจำกัดของหลักฐาน

AI ถูกใช้เพื่อช่วยแตก requirement จาก handout ให้เป็น issue, contract, API/UI behavior, test cases และเอกสาร traceability รวมถึงช่วยวิเคราะห์ failure ระหว่างการพัฒนา อย่างไรก็ตามการตัดสินใจด้าน design, security boundary, authorization, data migration และการยอมรับผลลัพธ์ยังต้องผ่านการตรวจสอบของผู้พัฒนา
หลักการสำคัญคือไม่ถือว่า code, test, screenshot, CI หรือ peer approval เสร็จสมบูรณ์จากคำแนะนำของ AI เพียงอย่างเดียว ทุกข้อสรุปในรายงานนี้จึงอ้างอิงผลการรันหรือหลักฐานเอกสารที่ระบุไว้เท่านั้น

## Answer Part 5: Working Login and Password Change UI
ระบบรองรับการเข้าสู่ระบบด้วย email/password และแสดง authentication flow ที่บังคับให้ผู้ใช้ซึ่งได้รับ initial password เปลี่ยนรหัสผ่านก่อนเข้าสู่หน้าการทำงานหลัก เมื่อเปลี่ยนสำเร็จ ระบบจะแสดงตัวตนและ role ของผู้ใช้ พร้อมรองรับ session continuity และ logout

หลักฐานประกอบ:
- [authentication-implementation.md](./authentication-implementation.md)
- [authentication E2E](../../client/e2e/lab-03/authentication.spec.ts)
- [auth API tests](../../server/tests/lab-03/auth.api.test.ts)
จาก browser evidence ระบบแสดง login success, invalid credential feedback, mandatory password change และ logout flow โดยไม่เปิดเผยรายละเอียดเฉพาะบัญชีในข้อความผิดพลาดของการเข้าสู่ระบบ

## Answer Part 6: Working IT Staff Ticket Queue UI
IT Staff และ Administrator สามารถเปิด shared Ticket queue เพื่อค้นหา กรอง เรียงลำดับ แบ่งหน้า และเปิดรายละเอียด Ticket ได้ บน desktop ระบบแสดงผลเป็น table ส่วน tablet/mobile ปรับเป็น card layout เพื่อรักษาความสามารถในการอ่านและใช้งาน

หลักฐานประกอบ:
- [staff-queue-implementation.md](./staff-queue-implementation.md)
- [staff queue E2E](../../client/e2e/lab-03/staff-queue.spec.ts)
- [staff queue API tests](../../server/tests/lab-03/staff-queue.api.test.ts)
- [staff queue screenshots](../../artifacts/lab-03/screenshots/staff-queue/)
- ภาพ demo ลำดับที่ 6, 7, 16 และ 17 ใน [demo report](../../artifacts/lab-03/demo-report/README.md)

Demo evidence แสดง queue data, search/filter behavior, Requested Priority, IT Priority, owner, detail navigation และการเปลี่ยนจาก table เป็น cards บนหน้าจอขนาดเล็ก
## Answer Part 7: Working IT Staff Ticket Detail UI

หน้า Ticket Detail รองรับการดำเนินงานหลักของ IT Staff ได้แก่ Claim Ticket, assignment, การปรับ IT Priority, การเปลี่ยน status ตาม transition ที่อนุญาต, การดาวน์โหลด attachment ตามสิทธิ์ และการสื่อสารกับผู้แจ้ง

ระบบแยก Public Comments ออกจาก Internal Notes อย่างชัดเจน โดย Public Comments ใช้สื่อสารกับ Requester ขณะที่ Internal Notes จำกัดการมองเห็นไว้สำหรับ IT Staff และ Administrator เท่านั้น Requester ยังสามารถส่งสัญญาณ Problem Appears Resolved ได้โดยไม่เปลี่ยน formal status เอง
หลักฐานประกอบ:

- [comments-notes-implementation.md](./comments-notes-implementation.md)
- [comments/notes API tests](../../server/tests/lab-03/comments-notes.api.test.ts)
- [staff ticket communication tests](../../client/tests/lab-03/TicketCommunication.test.tsx)
- [comments/notes E2E](../../client/e2e/lab-03/comments-notes.spec.ts)
- [comments and notes screenshots](../../artifacts/lab-03/screenshots/comments-notes/)
- ภาพ demo ลำดับที่ 8–15 ใน [demo report](../../artifacts/lab-03/demo-report/README.md)

หลักฐานชุดนี้ครอบคลุม operational workflow, role restrictions, comment/note visibility, resolution indication และ safe feedback ตามขอบเขตที่ถูกบันทึกใน test plan
## Answer Part 8: Working Administrator User Management UI

Administrator สามารถดูรายชื่อผู้ใช้ ค้นหาด้วยชื่อหรืออีเมล กรอง role สร้างบัญชี แก้ไขข้อมูล เปลี่ยนสถานะ active และตั้ง initial password ใหม่ให้ผู้ใช้ได้ โดยแต่ละบัญชีมี role เดียวและไม่มี hard-delete workflow ใน Lab 3

หลักฐานประกอบ:
- [user-management.md](./user-management.md)
- [administrator E2E](../../client/e2e/lab-03/user-administration.spec.ts)
- [administrator API tests](../../server/tests/lab-03/users-admin.api.test.ts)
- [user management screenshots](../../artifacts/lab-03/screenshots/user-management/)
- ภาพ demo ลำดับที่ 18–23 ใน [demo report](../../artifacts/lab-03/demo-report/README.md)

Demo evidence แสดงการจัดการ list, create, edit, reset initial password, ผลลัพธ์หลังสร้างผู้ใช้ และ responsive reflow บน tablet โดย backend ยังคงเป็นผู้บังคับใช้ authorization และ safety rules ที่เกี่ยวข้อง
## Answer Part 9: Zen Green UI and Responsive Evidence

การออกแบบ UI ยึด contract ใน [ui-spec.md](./ui-spec.md) และคง visual language ของ Zen Green จาก Lab 2 พร้อมปรับ layout ให้เหมาะกับ workflow ของแต่ละ role หลักฐานภาพประกอบมาจากการใช้งานแอปจริง ไม่ใช่ mockup

หลักฐาน responsive และ visual:
- [Demo report: 24 ภาพ](../../artifacts/lab-03/demo-report/README.md)
- [Requester regression evidence](./evidence/requester-regression/)
- [Staff queue evidence](../../artifacts/lab-03/screenshots/staff-queue/)
- [Comments/notes evidence](../../artifacts/lab-03/screenshots/comments-notes/)
- [User management evidence](../../artifacts/lab-03/screenshots/user-management/)

ภาพหลักฐานแสดง desktop, tablet และ mobile states รวมถึง role navigation, status/priority badges, editable/read-only fields, visible focus, table-to-card transformation และการจัดวางที่ไม่เกิด horizontal overflow ภายในขอบเขตของ automated responsive checks
## Submission Checklist

- [x] มี engineering specification, API/UI contracts และ test traceability สำหรับ Lab 3
- [x] บันทึกผล local verification ล่าสุดใน [results.md](./results.md)
- [x] บันทึก final `main` SHA และประวัติ review ใน [reviewer.md](./reviewer.md)
- [x] จัดเตรียม screenshot/demo evidence สำหรับ workflow หลักและ responsive states
- [x] จัดทำเอกสาร AI use และ reflection ใน [ai-use.md](./ai-use.md)
- [ ] ยืนยัน hosted CI ของ final `main` commit ในหลักฐานชุดนี้
- [ ] ทำให้ review threads และ approval gate ครบถ้วนตามเงื่อนไข submission
- [ ] ตรวจลิงก์ทั้งหมดอีกครั้งหลัง export PDF และยืนยันว่าไฟล์แนบเป็น PDF ฉบับเดียว

สถานะใน checklist สะท้อนหลักฐานที่มีอยู่จริง ณ วันที่จัดทำรายงาน ไม่ได้เปลี่ยนข้อที่ยังไม่ยืนยันให้เป็น completed เพียงเพราะมีการ merge code หรือมี local test ผ่าน
