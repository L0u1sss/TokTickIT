# Lab 3 — AI Use and Reflection

- **Developer:** [L0u1sss](https://github.com/L0u1sss)
- **LLM/agent used:** OpenAI Codex
- **Current scope:** Lab 3 planning, engineering contract, traceability and documentation setup
- **Disclosure status:** Updated for Issue [#29](https://github.com/L0u1sss/TokTickIT/issues/29); implementation prompts/evidence will be appended as work proceeds

## Selected Key Prompts

ข้อความด้านล่างสรุปจาก prompts ที่ใช้จริงในบทสนทนา โดยรักษาเจตนาเดิมและไม่ claim งานที่ยังไม่เกิดขึ้น

| # | Prompt (summarised) | AI contribution | My verification / decision |
|---:|---|---|---|
| 1 | Read `Lab_3_sheet.pdf` and propose Lab 3 issues and descriptions | Extracted required roles, features, evidence and possible decomposition | Checked numbering against this repository and corrected the starting issue sequence |
| 2 | Look only at open GitHub issues and provide branch names | Mapped issue scopes to branch naming suggestions | Kept one feature branch per bounded issue and a separate `lab3-staging` integration branch |
| 3 | Map IT Staff queue and ticket-operations issues to branch names | Distinguished `feat/lab3-staff-ticket-queue` from `feat/lab3-staff-ticket-operations` | Confirmed queue and operational detail are separate deliverables |
| 4 | Decide whether user migration and role authorization should be combined | Compared coupling and review trade-offs | Kept contracts distinct but allowed implementation sequencing based on migration dependency |
| 5 | Create clean Lab 3 Markdown documents from the Lab 2 documentation set | Created the required Lab 3 document structure without copying Lab 2 completion claims | Reviewed files to ensure Lab 2 SHAs, test counts and reviewer verdicts were removed |
| 6 | Add a Lab 3 section to README based on the labsheet | Summarised roles, required repository increment, branch flow and submission headings | Checked that README describes requirements, not fabricated implementation evidence |
| 7 | Write the Issue #29 title/description and branch scope | Produced a docs-only engineering-contract issue definition | Confirmed exact issue body from GitHub and used branch `docs/lab3-engineering-contract` |
| 8 | Implement Issue #29 using the Lab 3 reference | Drafted numbered FR/BR/AC, matrices, migration, API/UI contracts and pre-implementation tests | Chose session/password/workflow decisions, removed ambiguous TBDs and kept every test status Planned |

## Important Decisions I Retained or Changed

- Retained the labsheet requirement to replace the Development Requester selector with authenticated identity.
- Chose an opaque database-backed HttpOnly session cookie and Argon2id rather than asking the AI to leave auth decisions unspecified.
- Explicitly permitted Administrator Ticket operations in the approved matrix to satisfy owner/IT Priority rules, while keeping User Management exclusive to Administrator.
- Defined exact status transitions, queue defaults, password/content limits and error behavior so implementation tests have observable boundaries.
- Required migration tests on both an empty database and populated Lab 2 data before removing the old requester model.
- Rejected any suggestion to mark tests, CI, screenshots, reviews or approvals as complete before evidence exists.

## My Reflection

AI ช่วยลดเวลาการแตก labsheet ที่ยาวให้เป็น requirement IDs, authorization/status matrices และ test traceability ได้มาก โดยเฉพาะการมองหาจุดที่มักกำกวม เช่น identity source, safe `404`, concurrent claim และ last-active-admin protection อย่างไรก็ตาม output แรกยังเป็นเพียง template และมี `TBD` มากเกินไป จึงต้องตรวจกลับกับ labsheet และ contract ของ Lab 2 แล้วตัดสินใจรายละเอียดเองก่อนใช้เป็นฐาน implementation

สิ่งสำคัญที่ได้เรียนรู้คือ “เอกสารครบ” ไม่ใช่แค่มีชื่อหัวข้อ แต่ทุก requirement ต้องมี behavior ที่สังเกตได้ มี API/UI ที่สอดคล้อง และ trace ไป test ได้ อีกทั้งต้องแยก planned evidence ออกจาก passed evidence อย่างเคร่งครัด เพื่อไม่ให้ PR description หรือรายงานอ้างผลที่ยังไม่ได้รัน

## Evidence Maintenance Rule

หลังแต่ละ implementation PR ให้เพิ่มเฉพาะ prompt ที่มีผลต่อ design/code/test อย่างมีนัยสำคัญ พร้อมบันทึกสิ่งที่ผู้พัฒนาตรวจสอบหรือแก้เอง Final submission เลือก 6–10 prompts ที่เป็นตัวแทน ไม่จำเป็นต้องคัดลอก transcript ทั้งหมด และต้อง sync exact final SHA/CI กับ [tests.md](./tests.md) และ [reviewer.md](./reviewer.md)
