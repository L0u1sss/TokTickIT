# TokTickIT Lab 3 UI Specification

> สถานะ: Proposed contract สำหรับ peer review
>
> อ้างอิง: [specification.md](./specification.md) และ [api-spec.md](./api-spec.md)

## 1. Design System and Application Shell

Lab 3 ใช้ Zen Green tokens, typography, spacing, cards, buttons, form controls, badges และ focus styles เดิมจาก Lab 2 ไม่สร้าง visual system ใหม่

Authenticated shell ต้องมี:

- TokTickIT identity และ skip link ไป `<main>`
- current user display name และ role badge
- role-specific navigation พร้อม `aria-current="page"`
- Logout action และ password actionเมื่อได้รับอนุญาต
- responsive header ที่ไม่ตัดข้อความหรือบังคับ horizontal page scroll

| Role | Navigation |
|---|---|
| Requester | Create Ticket, My Tickets |
| IT Staff | Ticket Queue |
| Administrator | Ticket Queue, User Management |

Development Requester selector, Change Requester และ sessionStorage requester context ต้องถูกถอดออก ไม่มี flash ของ unauthorized navigation ระหว่าง restore session

## 2. Routing and Access Guards

| Route | Access | Behavior |
|---|---|---|
| `/login` | Public | valid session redirect ไป role home; forced-change user ไป `/change-password` |
| `/change-password` | authenticated forced-change user | normal user redirect role home; unauthenticated redirect login |
| `/tickets/new`, `/tickets`, `/tickets/:id` | Requester | other roles show Forbidden หรือ role home; backend remains authoritative |
| `/staff/tickets`, `/staff/tickets/:id` | IT Staff, Administrator | other roles show Forbidden |
| `/admin/users` | Administrator | other roles show Forbidden |

หลัง logout ทุก protected route redirect `/login`; browser back ต้องไม่แสดง protected cached content

## 3. Authentication Screens

Issue #30 staging note: `/login` and `/change-password` lead to the authenticated `/account` shell. Final role-home navigation and replacement of the legacy root/Ticket entry are integrated in #31. This intermediate route is documented in [authentication-implementation.md](./authentication-implementation.md); the final routing matrix above remains the target contract.

### 3.1 Login

- Email field (`autocomplete="username"`) และ Password field (`autocomplete="current-password"`, show/hide control)
- Primary “Sign in” button และ product/context text
- Submit validation แสดง field error และ focus error summary; error items linkกลับ field
- Pending: disable duplicate submit, label “Signing in…”, preserve email และไม่ echo password
- Unknown email, wrong password และ inactive account (รวม valid password): แสดง generic error เดียวกัน `Unable to sign in with the provided credentials.` จาก `401 AUTHENTICATION_FAILED`; ไม่แสดงข้อความแยกเพื่อบอกว่าบัญชีมีอยู่หรือ inactive และไม่เข้า authenticated shell
- Network/server failure: alert พร้อม Retry ที่ไม่เก็บ passwordถ้า policy เลือก clear
- Successful login: forced-change ไป Change Password; อื่นไป role home

### 3.2 Mandatory Change Password

- แสดง password rules ก่อนกรอก
- Current Password, New Password, Confirm New Password พร้อม show/hide ที่ keyboard ใช้ได้
- Live rule indicators เป็น supplementary; authoritative validationบน blur และ submit
- Error summary/focus/link patternเหมือน form Lab 2
- Pending/success/failure feedback; สำเร็จไป role home และ shell แสดง identity/role
- Logout ต้องใช้ได้จาก forced-change flow

## 4. Requester Regression Screens

- Create Ticket, My Tickets, Ticket Detail และ AttachmentSection รักษา behavior Lab 2 แต่ identity มาจาก session
- Header ไม่มี selector/Change Requester; loading session ต้องไม่ render ticket dataของ userก่อนหน้า
- Ticket Detail เพิ่ม `Public comments` section: chronological list, author/role/time, textarea, character counter และ Post button
- เพิ่ม `Problem appears resolved` action เฉพาะ status New/Open/In Progress/Waiting for Requester/Reopened พร้อม explanatory textและ confirmation; success แสดง indicationโดยไม่ claim ว่า Ticket ถูก Resolved ส่วน Resolved/Closed/Cancelled ไม่แสดง action และ direct API conflictต้องมี safe feedback
- Requester ไม่เห็น owner editing, IT Priority editing, staff status control หรือ Internal Notes

## 5. IT Staff Ticket Queue

### 5.1 Information architecture

- Page title, short queue purpose และ optional simple count
- Search by Ticket Number, Summary, Requester name/email
- Single-value filters: Status, Requested Priority, IT Priority, Owner (`All`, `Mine`, `Unassigned`, named active IT Staff/Administrator)
- Sort field/order, Clear filters และ pagination
- Row/card fields: Ticket Number, Summary, Requester, Created Date, Status, Requested Priority, IT Priority, Owner, Last Updated และ “View ticket”

Desktopใช้ table ที่มี visible headers; tablet/mobileเปลี่ยนเป็น cards/stacked definition list ไม่ยัด mega-grid และ action กดได้ง่าย

### 5.2 URL and query behavior

Search/filter/sort/page เก็บใน URL query เพื่อ refresh/back/forward ได้ Client ไม่ silently sanitize invalid URL; แสดง invalid-query failure พร้อม “Reset filters” แล้วส่งค่าที่ valid เท่านั้นหลัง user reset Search debounce ได้ แต่ page resetเป็น 1 เมื่อ criteria เปลี่ยน

### 5.3 States

| State | Required feedback/action |
|---|---|
| Loading | skeleton/status text; controlsไม่ส่งซ้ำ |
| Empty system | “No tickets yet” และไม่แสดง filter blame |
| No results | criteria summary พร้อม Clear filters |
| Invalid query | safe error พร้อม Reset filters |
| Forbidden | heading/message และ link role home; ไม่ render rows |
| API failure | alert พร้อม Retry โดยรักษา criteria |
| Success | deterministic results, pagination summary และ focus/announcement เมื่อ pageเปลี่ยน |

Metadata/assignee load failure ต้องแยกจาก legitimate empty choices พร้อม warning และ Retry; ห้ามกลืนเป็น empty array

## 6. IT Staff Ticket Detail

### 6.1 Read-only groups

- Ticket Number, dates, Summary, Description, Category, Related System และ Requester
- Requested Priority, current IT Priority, Status, active Owner และ Final owner history (`lastOwner`) เมื่อ Ticket Closed/Cancelled
- Problem Appears Resolved indication (ถ้ามี)
- Existing attachment metadata พร้อม Download action สำหรับ IT Staff/Administrator ผ่าน `/api/staff/tickets/:id/attachments/:attId/download`; removed attachmentไม่มี action และ UI ไม่สร้าง requester download URL

### 6.2 Operational controls

- `Claim ticket` แสดงเมื่อ unassigned
- Owner select + Assign/Reassign แสดง active IT Staff/Administrator และ current owner
- IT Priority select
- Status select แสดงเฉพาะ permitted next statesจาก current state
- Resolve/Close/Cancel ต้อง confirmation ที่บอกผลกระทบชัดเจน
- แต่ละ mutationมี independent pending state ป้องกัน duplicate และ refetch/merge server result
- `409` แสดง conflictเฉพาะจุด พร้อม Reload latest ticket; `404` แสดง not-found state; safe failure มี Retry
- เมื่อ status เปลี่ยนเป็น Closed/Cancelled UI ต้องแสดง Owner เป็น unassigned และ Final owner เป็น historical read-only valueจาก server; ห้ามเสนอ assign/reassignบน terminal Ticket
- Attachment download pending/failureต้องไม่เปิดเผย storage path และ Retry ต้องเรียก staff routeเดิม

Editable fieldsใช้ form surface/amber cue ส่วน source/requester fieldsใช้ read-only surface เพื่อไม่ให้สับสน

### 6.3 Public Comments versus Internal Notes

สอง section ต้องแยกด้วย heading, descriptive copy, icon/label และสีที่ไม่พึ่งสีอย่างเดียว:

- Public Comments: “Visible to the Requester” ใช้ neutral/green surface
- Internal Notes: “Private to IT Staff and Administrators” ใช้ warning/amber surface

แต่ละ sectionมี chronological list, semantic author/role/time, empty state, textarea, count, validation, pending, success announcement และ failure retry Draft ของสอง sectionต้องไม่แชร์ state ป้องกันโพสต์ผิดช่อง Content renderเป็น plain textและ preserve line breaksอย่างปลอดภัย

## 7. Administrator User Management

หน้าเดียวประกอบด้วย toolbar + user list + create/edit dialogหรือ panel

### 7.1 User list

- Columns/card fields: Name, Email, Role, Status, Edit
- Search name/email และ optional single Role filter
- ไม่มี mandatory pagination หรือ multi-sort
- Loading, empty, no-results, forbidden และ failure/Retry ชัดเจน
- Desktop table; tablet/mobile cardsที่ Edit actionไม่ล้น

### 7.2 Create user

- Fields: Name, Email, one Role, Active state และ Initial Password
- Password rules และ “must change at next login” explanation
- Field validation + summary, pending, success announcement, duplicate-email conflict
- Successไม่แสดง initial passwordกลับจาก serverและ clear sensitive field

### 7.3 Edit user

- Fields: Name, Email, one Role, Active state; separate “Set new initial password” action
- Self-deactivation controlอาจ disableพร้อมคำอธิบาย แต่ backendยังต้อง reject User ที่มี active Ticket assignmentsต้อง reassignหรือปิด/ยกเลิก Ticket ก่อน deactivate/demote; historical Final ownerไม่ขวางและ UI ต้องไม่เรียกร้องให้แก้ historical Ticket
- Last-active-admin conflict แสดงข้อความและคืน focusไป status/role control
- ไม่มี Delete action, multiple-role UI, bulk selection, import/export หรือ account history

### 7.4 Set initial password

- Dedicated confirmation dialog/panel มี password+confirmationและ rules
- สำเร็จประกาศว่าผู้ใช้ต้องเปลี่ยนครั้งหน้า; ไม่ส่ง/แสดงผ่าน email
- Sensitive form stateถูก clearเมื่อ cancel/success

## 8. Screen Mode Matrix

| Screen | View/input modes | Meaningful feedback |
|---|---|---|
| Login | initial, editing, submitting | validation, generic authentication failure (unknown email/wrong password/inactive), rate-limit, safe failure |
| Change Password | editing, submitting | rules, mismatch, reuse, success, safe failure |
| Requester Ticket Detail | view, comment, resolution confirmation | empty, pending, success, forbidden/not found/failure |
| Staff Queue | browse, filter, paginate | loading, empty/no-results, invalid query, forbidden, failure |
| Staff Detail | view, operational edit, confirmations | pending, validation, success, conflict, not found/failure |
| User Management | list, search/filter, create, edit, password dialog | loading, empty/no-results, validation, success, conflict/forbidden/failure |

## 9. Responsive Requirements

ต้องเก็บ real-browser evidence ที่:

- Desktop `1440×900`
- Tablet `834×1112`
- Mobile `390×844`
- Browser zoom 200% ที่ viewportเหมาะสมตาม WCAG reflow check

ทุก major screenต้องไม่มี horizontal page overflow, clipped text, overlapping controls หรือ hidden primary action Inputsใช้ `box-sizing: border-box`, minimum touch targetประมาณ 44×44 CSS pixels และ long ticket/user content wrapได้ ตารางเปลี่ยน representationเมื่ออ่านไม่ได้

Screenshot paths:

```text
artifacts/lab-03/screenshots/
├── authentication/
├── staff-queue/
├── staff-ticket-detail/
└── user-management/
```

## 10. Accessibility Requirements

- Semantic headings/landmarks/labels และ unique accessible names
- Keyboardเข้าถึง navigation, forms, filters, dialogs, comment/note actions และ paginationครบ
- Visible focus; dialogs trap focus, Escape/Cancelได้ และคืน focusให้ trigger
- Validation errorข้าง field + error summary `role="alert"`; focus summaryหลัง failed submit และ linksกลับ fields
- Async statusใช้ `role="status"`/`aria-live`; destructive/important confirmationsมี accessible title/description
- Badge/stateไม่สื่อด้วยสีเพียงอย่างเดียว และ contrastอย่างน้อย WCAG AA
- Loadingไม่ลบ current contextโดยไม่จำเป็น; focusย้ายไป page headingสำหรับ route changeและผลสำคัญ
- Password reveal controlประกาศ stateและไม่เปลี่ยน accessible labelคลุมเครือ

## 11. Visual Evidence Checklist

- [ ] Zen Green tokens/componentsสอดคล้อง Lab 2
- [ ] Authenticated identity/roleและ role navigationถูกต้อง
- [ ] Status, Requested Priority, IT Priorityและ role badgesมี text labels
- [ ] Editable/read-only fieldsแยกชัด
- [ ] Public Comments/Internal Notesไม่สับสน
- [ ] Validation/focus/announcementsผ่าน keyboard inspection
- [ ] Loading/empty/no-results/forbidden/conflict/failure statesมี evidence
- [ ] Desktop/tablet/mobile/200% zoomไม่มี clipping, overlap, horizontal page overflow
- [ ] Screenshotsไม่มี password, token, personal secret หรือ private noteที่ไม่เหมาะสม

Checklist นี้ยังไม่ผ่านจนมี implementationและ evidence จริงใน issue/PR ที่เกี่ยวข้อง
