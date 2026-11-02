import { test } from "node:test";
import assert from "node:assert/strict";
import { queryClient, clearPrivateCache } from "../client/src/lib/queryClient";

test("sign-out cache clearing aborts pending private fetches and prevents late data restoring the cache", async () => {
  const original = globalThis.fetch;
  let signal: AbortSignal | undefined, finish!: (response: Response) => void;
  globalThis.fetch = ((_url: unknown, init: RequestInit) => {
    signal = init.signal as AbortSignal;
    return new Promise<Response>(resolve => { finish = resolve; });
  }) as typeof fetch;
  try {
    queryClient.setQueryData(["/api/user/profile"], { private: "previous owner" });
    const pending = queryClient.fetchQuery({ queryKey: ["/api/user-facts"] }).catch(() => null);
    await clearPrivateCache();
    assert.equal(signal?.aborted, true);
    finish(new Response(JSON.stringify([{ private: "late private result" }])));
    await pending;
    assert.equal(queryClient.getQueryData(["/api/user/profile"]), undefined);
    assert.equal(queryClient.getQueryData(["/api/user-facts"]), undefined);
  } finally { globalThis.fetch = original; queryClient.clear(); }
});
