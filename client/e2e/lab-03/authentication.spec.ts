import { test, expect } from "@playwright/test";

test("E2E-01 auth foundation: login, forced change, account shell, logout and direct access",async({page})=>{
  if(!process.env.E2E_AUTH_PASSWORD)throw new Error("Use npm run test:auth:e2e to create isolated fixtures.");
  await page.goto("/account");
  await expect(page.getByRole("heading",{name:"Sign in"})).toBeVisible();
  await page.getByLabel("Email",{exact:false}).fill("auth-browser@example.test");
  await page.getByLabel("Password",{exact:false}).fill(process.env.E2E_AUTH_PASSWORD);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/\/change-password$/);
  await page.goto("/account");
  await expect(page.getByRole("heading",{name:"Change your initial password"})).toBeVisible();
  await page.getByLabel("Current Password",{exact:false}).fill(process.env.E2E_AUTH_PASSWORD);
  await page.getByLabel("New Password",{exact:false}).first().fill("New-browser-password2!");
  await page.getByLabel("Confirm New Password",{exact:false}).fill("New-browser-password2!");
  await page.getByRole("button",{name:"Save password"}).click();
  await expect(page.getByRole("heading",{name:"Create Ticket"})).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("Auth Browser User");
  for(const viewport of [{width:1440,height:900},{width:834,height:1112},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await expect(page.getByRole("button",{name:"Logout",exact:true})).toBeVisible();
  }
  await page.getByRole("button",{name:"Logout",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Sign in"})).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Auth Browser User")).toHaveCount(0);
  expect((await page.request.get(`${process.env.E2E_API_URL}/api/auth/me`)).status()).toBe(401);
});
