import { describe, it, expect } from "vitest";
import { readSubs } from "@/lib/web-push";

// readSubs decide a quién se le manda push: debe leer el formato viejo (subscription
// singular) y el nuevo (subscriptions array), y descartar entradas sin endpoint.
describe("readSubs (unifica formato viejo y multi-device)", () => {
  it("doc vacío / sin datos → []", () => {
    expect(readSubs(undefined)).toEqual([]);
    expect(readSubs({})).toEqual([]);
  });
  it("formato viejo: subscription singular", () => {
    const s = { endpoint: "https://a", keys: {} };
    expect(readSubs({ subscription: s })).toEqual([s]);
  });
  it("formato nuevo: array de subscriptions", () => {
    const arr = [{ endpoint: "https://a" }, { endpoint: "https://b" }];
    expect(readSubs({ subscriptions: arr })).toEqual(arr);
  });
  it("prioriza el array nuevo si ambos están presentes", () => {
    const arr = [{ endpoint: "https://new" }];
    expect(readSubs({ subscription: { endpoint: "https://old" }, subscriptions: arr })).toEqual(arr);
  });
  it("descarta entradas sin endpoint", () => {
    const arr = [{ endpoint: "https://a" }, { foo: 1 } as unknown as { endpoint: string }];
    expect(readSubs({ subscriptions: arr })).toEqual([{ endpoint: "https://a" }]);
  });
  it("array vacío cae al singular (retrocompat)", () => {
    const s = { endpoint: "https://a" };
    expect(readSubs({ subscriptions: [], subscription: s })).toEqual([s]);
  });
  it("singular sin endpoint → []", () => {
    expect(readSubs({ subscription: { keys: {} } as unknown as { endpoint: string } })).toEqual([]);
  });
});
