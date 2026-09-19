import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthApp from "../../src/AuthApp.js";

afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},"","/");});
const response=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status});
describe("UI-01 Login",()=>{
  it("restores no session, validates fields and focuses linked errors",async()=>{
    const fetchMock=vi.fn().mockResolvedValue(response(401,{error:{code:"AUTHENTICATION_REQUIRED"}}));vi.stubGlobal("fetch",fetchMock);
    const user=userEvent.setup();render(<AuthApp/>);
    await screen.findByRole("heading",{name:"Sign in"});
    await user.click(screen.getByRole("button",{name:"Sign in"}));
    expect(screen.getByRole("alert")).toHaveFocus();
    await user.click(screen.getByRole("link",{name:/Email: This field/}));
    expect(screen.getByLabelText(/Email/)).toHaveFocus();expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/login");
  });
  it("shows generic safe failure, preserves email, clears password and sends cookies",async()=>{
    const fetchMock=vi.fn().mockResolvedValueOnce(response(401,{error:{code:"AUTHENTICATION_REQUIRED"}}))
      .mockResolvedValueOnce(response(401,{error:{code:"AUTHENTICATION_FAILED",message:"Account inactive"}}));
    vi.stubGlobal("fetch",fetchMock);const user=userEvent.setup();render(<AuthApp/>);
    await screen.findByRole("heading",{name:"Sign in"});
    await user.type(screen.getByLabelText(/Email/),"person@example.test");
    await user.type(screen.getByLabelText(/^Password/),"Initial-password1!");
    await user.click(screen.getByRole("button",{name:"Sign in"}));
    await screen.findByText("Unable to sign in with the provided credentials.");
    expect(screen.queryByText("Account inactive")).toBeNull();
    expect(screen.getByLabelText(/Email/)).toHaveValue("person@example.test");expect(screen.getByLabelText(/^Password/)).toHaveValue("");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({credentials:"include",method:"POST"});
    expect(screen.getByRole("alert")).toHaveFocus();
  });
  it("disables duplicate submit while login is pending then routes to forced change",async()=>{
    let resolveLogin!:(r:Response)=>void;
    const fetchMock=vi.fn().mockResolvedValueOnce(response(401,{error:{code:"AUTHENTICATION_REQUIRED"}}))
      .mockImplementationOnce(()=>new Promise<Response>(resolve=>{resolveLogin=resolve;}));
    vi.stubGlobal("fetch",fetchMock);const user=userEvent.setup();render(<AuthApp/>);
    await screen.findByRole("heading",{name:"Sign in"});
    await user.type(screen.getByLabelText(/Email/),"person@example.test");await user.type(screen.getByLabelText(/^Password/),"Initial-password1!");
    await user.dblClick(screen.getByRole("button",{name:"Sign in"}));
    expect(screen.getByRole("button",{name:"Signing in…"})).toBeDisabled();expect(fetchMock).toHaveBeenCalledTimes(2);
    resolveLogin(response(200,{user:{id:1,displayName:"Person",email:"person@example.test",role:"REQUESTER",mustChangePassword:true}}));
    await screen.findByRole("heading",{name:"Change your initial password"});
    await waitFor(()=>expect(window.location.pathname).toBe("/change-password"));
  });
});
