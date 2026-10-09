import { describe, expect, it } from "vitest";
import { authorGate } from "../src/worker/auth.ts";

const prod = new URL("https://acu-primer.example.workers.dev/api/author/courses");
const local = new URL("http://localhost:5173/api/author/courses");

describe("authorGate", () => {
  it("lets the right passphrase in", async () => {
    expect(await authorGate(prod, "correct horse", "correct horse")).toEqual({ ok: true });
  });

  it("refuses a wrong or missing passphrase", async () => {
    expect((await authorGate(prod, "correct hors", "correct horse")).ok).toBe(false);
    expect(await authorGate(prod, null, "correct horse")).toMatchObject({ ok: false, status: 401 });
  });

  it("still asks for the passphrase on localhost once one is set", async () => {
    expect(await authorGate(local, null, "correct horse")).toMatchObject({ ok: false, status: 401 });
  });

  it("is open on localhost when no passphrase is set, and closed anywhere else", async () => {
    expect(await authorGate(local, null, undefined)).toEqual({ ok: true });
    expect(await authorGate(prod, null, undefined)).toMatchObject({ ok: false, status: 503 });
  });
});
