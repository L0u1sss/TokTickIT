# TokTickIT — Lab 3 Demo Report

รายงานภาพประกอบการสาธิต TokTickIT ระบบ IT Service Desk สำหรับรับแจ้ง ติดตาม และจัดการคำร้องด้าน IT โดยบันทึกจากการใช้งานแอปจริงบนฐานข้อมูล demo ที่แยกจากฐานข้อมูลใช้งาน ข้อมูลผู้ใช้ ชื่อ Ticket และรายละเอียดต่าง ๆ ในภาพเป็นข้อมูลตัวอย่างที่จัดเตรียมขึ้นเพื่อการสาธิตเท่านั้น

ชุดภาพนี้เล่าเส้นทางการใช้งานหลักของ Lab 3 ตั้งแต่การเข้าสู่ระบบและบังคับเปลี่ยนรหัสผ่าน การสร้างและติดตาม Ticket ในบทบาท Requester การค้นหา รับงาน และดำเนินการ Ticket ในบทบาท IT Staff ตลอดจนการสื่อสารผ่าน Public Comments, การบันทึก Internal Notes, การควบคุมสิทธิ์ตามบทบาท และการจัดการผู้ใช้โดย Administrator นอกจากนี้ยังแสดงการออกแบบแบบ responsive บนมือถือและแท็บเล็ต เพื่อให้เห็นการทำงานของระบบในหลายขนาดหน้าจอ

## ขอบเขตของรายงาน

- ใช้ยืนยันลำดับการทำงานและหน้าตาของ UI ที่นำเสนอใน demo
- ครอบคลุมบทบาท Requester, IT Staff และ Administrator รวมถึงกรณีผู้ใช้ไม่มีสิทธิ์เข้าถึงหน้าจอ
- แสดงผลลัพธ์หลังการดำเนินการสำคัญ เช่น Claim Ticket, การเปลี่ยน Priority/Status, การเพิ่มความคิดเห็น และการสร้างหรือแก้ไขผู้ใช้
- ภาพทั้งหมดบันทึกจากระบบจริง ไม่ใช่ภาพจำลองหรือ mockup

รายงานนี้เป็นหลักฐานประกอบการสาธิต UI และ workflow เท่านั้น ไม่ใช่ผลการทดสอบที่ยืนยันความครบถ้วนของทุก requirement, test case หรือ security control รายละเอียดการทดสอบควรตรวจสอบจากเอกสาร verification และ test evidence ที่เกี่ยวข้อง

**วันที่บันทึกภาพ:** 20 กันยายน 2026 เวลา 21:50:49 UTC  
**วิธีดูภาพ:** เปิด `index.html` เพื่อดูภาพรวม แล้วกดภาพแต่ละรายการเพื่อเปิดไฟล์ PNG ต้นฉบับ

## ลำดับการสาธิต

การนำเสนอเรียงตาม workflow ต่อเนื่อง: Authentication → Requester Ticket → IT Staff Operations → Communication and Resolution → Role Authorization → Administrator User Management → Responsive UI → Logout


### ภาพที่ 1: เข้าสู่ระบบ

![เข้าสู่ระบบ](01-login.png)

หน้า Sign in สำหรับเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน

### ภาพที่ 2: รหัสผ่านไม่ถูกต้อง

![รหัสผ่านไม่ถูกต้อง](02-login-invalid.png)

ระบบแสดงข้อความปฏิเสธการเข้าสู่ระบบเมื่อใช้รหัสผ่านไม่ถูกต้อง

### ภาพที่ 3: เปลี่ยนรหัสผ่านครั้งแรก

![เปลี่ยนรหัสผ่านครั้งแรก](03-change-initial-password.png)

ผู้ใช้ต้องตั้งรหัสผ่านใหม่ก่อนเข้าถึงฟังก์ชันภายในระบบ

### ภาพที่ 4: Requester: สร้างคำร้อง

![Requester: สร้างคำร้อง](04-requester-create-ticket.png)

หลังเปลี่ยนรหัสผ่านสำเร็จ ผู้ใช้เข้าสู่หน้าสร้าง Ticket พร้อมแสดงตัวตนที่เข้าสู่ระบบ

### ภาพที่ 5: Requester: รายการคำร้อง

![Requester: รายการคำร้อง](05-requester-my-tickets.png)

ผู้แจ้งติดตาม Ticket ของตนเองผ่านหน้า My Tickets

### ภาพที่ 6: IT Staff: คิวงาน

![IT Staff: คิวงาน](06-staff-ticket-queue.png)

ตารางคิวงานแสดงสถานะ Requested Priority, IT Priority และผู้รับผิดชอบ พร้อมค้นหาและกรองข้อมูล

### ภาพที่ 7: IT Staff: ค้นหาและกรอง

![IT Staff: ค้นหาและกรอง](07-staff-search-filter.png)

ค้นหาคำว่า printer และกรองงานของตนเอง ได้ผลลัพธ์ตรงเงื่อนไขหนึ่งรายการ

### ภาพที่ 8: IT Staff: รายละเอียดคำร้อง

![IT Staff: รายละเอียดคำร้อง](08-staff-ticket-detail.png)

รายละเอียด Ticket ก่อนรับงาน พร้อมปุ่ม Claim Ticket ตัวเลือกผู้รับผิดชอบ สถานะ ความสำคัญ และไฟล์แนบ

### ภาพที่ 9: IT Staff: รับงานและอัปเดตสถานะ

![IT Staff: รับงานและอัปเดตสถานะ](09-staff-claim-priority-status.png)

หลัง Claim Ticket เจ้าหน้าที่ Mali IT Staff เป็นผู้รับผิดชอบ ปรับ IT Priority เป็น Low และสถานะเป็น In Progress

### ภาพที่ 10: IT Staff: ความคิดเห็นและบันทึกภายใน

![IT Staff: ความคิดเห็นและบันทึกภายใน](10-staff-comments-and-notes.png)

Public Comments ใช้สื่อสารกับผู้แจ้ง ส่วน Internal Notes แสดงเฉพาะ IT Staff และ Administrator

### ภาพที่ 11: Public Comment

![Public Comment](11-public-comment-closeup.png)

เจ้าหน้าที่แจ้งผลการแก้ไขผ่านความคิดเห็นที่ผู้แจ้งอ่านได้

### ภาพที่ 12: Internal Note

![Internal Note](12-internal-note-closeup.png)

บันทึกผลวิเคราะห์ภายในสำหรับทีม IT

### ภาพที่ 13: Requester: แจ้งว่าปัญหาดูเหมือนได้รับการแก้ไข

![Requester: แจ้งว่าปัญหาดูเหมือนได้รับการแก้ไข](13-requester-resolution.png)

ผู้แจ้งตอบกลับผ่าน Public Comment และกด Problem Appears Resolved โดยไม่มีส่วน Internal Notes

### ภาพที่ 14: จำกัดสิทธิ์ตามบทบาท

![จำกัดสิทธิ์ตามบทบาท](14-role-access-denied.png)

Requester ไม่สามารถเข้าหน้าจัดการผู้ใช้ของ Administrator ได้

### ภาพที่ 15: IT Staff: ยืนยันแก้ไขสำเร็จ

![IT Staff: ยืนยันแก้ไขสำเร็จ](15-staff-resolved.png)

เจ้าหน้าที่เห็นการยืนยันจากผู้แจ้งและเปลี่ยนสถานะ Ticket เป็น Resolved

### ภาพที่ 16: มือถือ: คิวงาน

![มือถือ: คิวงาน](16-mobile-staff-queue.png)

คิวงานบนหน้าจอมือถือใช้รูปแบบการ์ดแทนตาราง

### ภาพที่ 17: มือถือ: การ์ด Ticket

![มือถือ: การ์ด Ticket](17-mobile-ticket-cards.png)

ภาพส่วนผลลัพธ์คิวงานบนมือถือ ขนาด 390 × 844

### ภาพที่ 18: Administrator: จัดการผู้ใช้

![Administrator: จัดการผู้ใช้](18-admin-user-management.png)

แสดงรายชื่อผู้ใช้ บทบาท สถานะ และคำสั่งเพิ่มหรือแก้ไขผู้ใช้

### ภาพที่ 19: Administrator: เพิ่มผู้ใช้

![Administrator: เพิ่มผู้ใช้](19-admin-create-user.png)

กำหนดชื่อ อีเมล บทบาท และรหัสผ่านเริ่มต้นสำหรับเจ้าหน้าที่ใหม่

### ภาพที่ 20: Administrator: เพิ่มผู้ใช้สำเร็จ

![Administrator: เพิ่มผู้ใช้สำเร็จ](20-admin-user-created.png)

บัญชี Pim Support ปรากฏในรายการหลังบันทึกผ่านระบบจริง

### ภาพที่ 21: Administrator: แก้ไขผู้ใช้

![Administrator: แก้ไขผู้ใช้](21-admin-edit-user.png)

หน้าต่างแก้ไขข้อมูล บทบาท และสถานะ Active ของผู้ใช้

### ภาพที่ 22: Administrator: ตั้งรหัสเริ่มต้นใหม่

![Administrator: ตั้งรหัสเริ่มต้นใหม่](22-admin-reset-password.png)

หน้าต่างสำหรับตั้งและยืนยันรหัสผ่านเริ่มต้นใหม่ของผู้ใช้

### ภาพที่ 23: แท็บเล็ต: จัดการผู้ใช้

![แท็บเล็ต: จัดการผู้ใช้](23-tablet-user-management.png)

หน้าจัดการผู้ใช้บน viewport 834 × 1112

### ภาพที่ 24: ออกจากระบบ

![ออกจากระบบ](24-logout.png)

หลัง Logout ระบบกลับสู่หน้า Sign in

