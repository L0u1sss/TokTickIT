import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthApp from "../../src/AuthApp.js";
vi.mock("../../src/components/StaffTicketQueue.js", () => ({ default: () => <h1>Ticket Queue</h1> }));
const identity={id:1,displayName:"Person",email:"person@example.test",role:"IT_STAFF",mustChangePassword:false};
afterEach(()=>{cleanup();vi.unstubAllGlobals();sessionStorage.clear();window.history.replaceState({},"","/");});
describe("UI-03 authentication shell subset",()=>{
  it("does not expose identity while session restore is loading or failed, and supports retry",async()=>{
    const fetchMock=vi.fn().mockRejectedValueOnce(new Error("network secret")).mockResolvedValueOnce(new Response(JSON.stringify({user:identity})));
    vi.stubGlobal("fetch",fetchMock);render(<AuthApp/>);
    expect(screen.getByRole("status")).toHaveTextContent("Checking your session");expect(screen.queryByText("Person")).toBeNull();
    await screen.findByRole("alert");await userEvent.click(screen.getByRole("button",{name:"Retry"}));
    await screen.findByRole("heading",{name:"Ticket Queue"});expect(screen.getByText("IT STAFF")).toBeInTheDocument();
  });
  it("removes legacy identity and keeps protected account hidden after logout and browser back",async()=>{
    sessionStorage.setItem("toktickit.requesterId","999");window.history.replaceState({},"","/account");
    vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({user:identity})))
      .mockResolvedValueOnce(new Response(null,{status:204})));
    render(<AuthApp/>);await screen.findByRole("heading",{name:"Ticket Queue"});
    await userEvent.click(screen.getByRole("button",{name:"Logout"}));await screen.findByRole("heading",{name:"Sign in"});
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
    act(()=>{window.history.pushState({},"","/account");window.dispatchEvent(new PopStateEvent("popstate"));});
    expect(screen.queryByText("Person")).toBeNull();expect(screen.getByRole("heading",{name:"Sign in"})).toBeInTheDocument();
  });
  it("keeps failed logout hidden and offers a server logout retry",async()=>{
    const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({user:identity})))
      .mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(new Response(null,{status:204}));
    vi.stubGlobal("fetch",fetchMock);render(<AuthApp/>);await screen.findByRole("heading",{name:"Ticket Queue"});
    await userEvent.click(screen.getByRole("button",{name:"Logout"}));
    await screen.findByRole("button",{name:"Retry logout"});expect(screen.queryByText("Person")).toBeNull();
    await userEvent.click(screen.getByRole("button",{name:"Retry logout"}));
    await screen.findByRole("heading",{name:"Sign in"});
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(3));
  });
});
