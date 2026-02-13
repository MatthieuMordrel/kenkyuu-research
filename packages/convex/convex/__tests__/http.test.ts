import { describe, it, expect } from "vitest";
import { base64Decode, uint8ArrayToBase64 } from "../http";

describe("base64Decode", () => {
  it("decodes a simple base64 string", () => {
    // "hello" in base64 is "aGVsbG8="
    const result = base64Decode("aGVsbG8=");
    expect(result).toEqual(
      new Uint8Array([104, 101, 108, 108, 111]),
    );
  });

  it("decodes an empty string", () => {
    const result = base64Decode("");
    expect(result).toEqual(new Uint8Array([]));
  });

  it("decodes binary data", () => {
    // Base64 of bytes [0, 1, 2, 255]
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const b64 = uint8ArrayToBase64(bytes);
    const decoded = base64Decode(b64);
    expect(decoded).toEqual(bytes);
  });
});

describe("uint8ArrayToBase64", () => {
  it("encodes bytes to base64", () => {
    // "hello" bytes
    const bytes = new Uint8Array([104, 101, 108, 108, 111]);
    expect(uint8ArrayToBase64(bytes)).toBe("aGVsbG8=");
  });

  it("encodes empty array", () => {
    expect(uint8ArrayToBase64(new Uint8Array([]))).toBe("");
  });

  it("roundtrips correctly", () => {
    const original = new Uint8Array([0, 127, 128, 255, 64, 32]);
    const encoded = uint8ArrayToBase64(original);
    const decoded = base64Decode(encoded);
    expect(decoded).toEqual(original);
  });

  it("handles single byte", () => {
    const bytes = new Uint8Array([65]); // 'A'
    expect(uint8ArrayToBase64(bytes)).toBe("QQ==");
  });
});
