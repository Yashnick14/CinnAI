import { afterEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({user:{uid:"alice",getIdToken:vi.fn(async()=>"id-token")} as {uid:string;getIdToken:()=>Promise<string>}|null}));
vi.mock("../src/services/firebaseAuth",()=>({firebaseAuth:()=>({currentUser:state.user})}));
vi.mock("../src/config/api",()=>({API:{baseUrl:"https://cinnai.example",timeoutMs:100}}));
import { cloudRequest } from "../src/services/cloudApi";
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();state.user={uid:"alice",getIdToken:async()=>"id-token"};});
it("attaches Firebase ID token to the cloud API, never a device credential",async()=>{
 const fetcher=vi.fn(async()=>new Response("[]"));vi.stubGlobal("fetch",fetcher);
 await cloudRequest("/devices");
 expect(fetcher).toHaveBeenCalledWith("https://cinnai.example/cloud/devices",expect.objectContaining({headers:expect.objectContaining({Authorization:"Bearer id-token"})}));
});
it("rejects unauthenticated requests without accessing network",async()=>{
 state.user=null;const f=vi.fn();vi.stubGlobal("fetch",f);
 await expect(cloudRequest("/history")).rejects.toThrow("Sign in");expect(f).not.toHaveBeenCalled();
});
it("does not return old-account data after a sign-out during request",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>{state.user=null;return new Response("[]");}));
 await expect(cloudRequest("/history")).rejects.toThrow("Account changed");
});
it("bounds requests and aborts on timeout",async()=>{
 vi.useFakeTimers();vi.stubGlobal("fetch",vi.fn((_u,{signal})=>new Promise((_r,reject)=>signal.addEventListener("abort",()=>reject(new Error("timeout"))))));
 const p=expect(cloudRequest("/devices")).rejects.toThrow();
 await vi.advanceTimersByTimeAsync(101);await p;
});
it("hides backend error details",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>new Response("private diagnostic",{status:503})));
 await expect(cloudRequest("/history")).rejects.toThrow("Cloud storage is not available yet");
});
