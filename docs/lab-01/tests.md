# Lab 1 — Test Plan and Evidence  (fill this in)

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok |passed|
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | passed|
| 3 | Vitest | Heading renders |passed |
| 4 | Vitest | Success state shows Online + category list | passed|
| 5 | Vitest | Error state shows Offline + message |passed |

Paste your passing terminal output / screenshot below.
ฝั่ง server 
supertest
![alt text](image.png)
GET /api/health
![alt text](image-1.png)
GET /api/categories
![alt text](image-2.png)

ฝั่ง client
supertest
![alt text](image-3.png)
Heading renders
![alt text](image-4.png)
Success state shows Online + category list
![alt text](image-5.png)
Error state shows Offline + message
![alt text](image-6.png)