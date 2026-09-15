import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthApp from "../../src/AuthApp.js";

const identity={id:1,displayName:"Person",email:"person@example.test",role:"REQUESTER",mustChangePassword:true};
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},"","/");});
describe("UI-02 mandatory password change",()=>{
  it("validates on blur and submit with Unicode code points and matching confirmation",async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({user:identity})));vi.stubGlobal("fetch",fetchMock);
    const user=userEvent.setup();render(<AuthApp/>);await screen.findByRole("heading",{name:"Change your initial password"});
    await user.type(screen.getByLabelText(/^New Password/),"short");await user.tab();
    expect(screen.getByLabelText(/^New Password/)).toHaveAttribute("aria-invalid","true");
    expect(screen.getByLabelText(/^New Password/)).not.toHaveAttribute("maxlength");
    await user.type(screen.getByLabelText(/^Current Password/),"Initial-password1!");
    await user.clear(screen.getByLabelText(/^New Password/));
    fireEvent.change(screen.getByLabelText(/^New Password/),{target:{value:"Aa1"+"😀".repeat(125)}});
    await user.type(screen.getByLabelText(/^Confirm New Password/),"different");
    await user.click(screen.getByRole("button",{name:"Save password"}));
    expect(screen.getByRole("alert")).toHaveFocus();expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("saves password and shows authenticated name/role without the selector",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({user:identity})))
      .mockResolvedValueOnce(new Response(JSON.stringify({user:{...identity,mustChangePassword:false}}))));
    const user=userEvent.setup();render(<AuthApp/>);await screen.findByRole("heading",{name:"Change your initial password"});
    await user.type(screen.getByLabelText(/^Current Password/),"Initial-password1!");
    await user.type(screen.getByLabelText(/^New Password/),"New-password2!");
    await user.type(screen.getByLabelText(/^Confirm New Password/),"New-password2!");
    await user.click(screen.getByRole("button",{name:"Save password"}));
    await screen.findByRole("heading",{name:"Your account is ready"});
    expect(screen.getByText("Person")).toBeInTheDocument();expect(screen.getByText("REQUESTER")).toBeInTheDocument();
    expect(screen.queryByText("Change Requester")).toBeNull();
  });
});
