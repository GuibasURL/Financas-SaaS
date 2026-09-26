import { afterEach, describe, expect, it, vi } from "vitest";
import { AVATAR_SIZE, initials, readAsDataURL, shrinkImage } from "./avatar";

describe("initials", () => {
  it.each([
    ["Ana Maria Souza", "AS"],
    ["  ana  ", "A"],
    ["Élio da Silva", "ÉS"],
    [null, "N"],
    ["   ", "N"],
  ])("%s -> %s", (name, expected) => {
    expect(initials(name, "nova@teste.com")).toBe(expected);
  });
});

describe("readAsDataURL", () => {
  it("vira data URL com o tipo do arquivo", async () => {
    expect(await readAsDataURL(new Blob(["oi"], { type: "image/png" }))).toBe(
      "data:image/png;base64,b2k="
    );
  });

  it("sem tipo, usa o genérico", async () => {
    expect(await readAsDataURL(new Blob(["oi"]))).toBe("data:application/octet-stream;base64,b2k=");
  });

  it("aguenta arquivos grandes (vários pedaços)", async () => {
    const url = await readAsDataURL(new Blob([new Uint8Array(100_000)]));
    expect(atob(url.split(",")[1])).toHaveLength(100_000);
  });
});

describe("shrinkImage", () => {
  const original = new Blob(["foto"], { type: "image/png" });

  function fakeCanvas(result: Blob | null, context: object | null = {}) {
    const ctx = context && { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "", ...context };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback) {
      callback(result);
    });
    return ctx as { drawImage: ReturnType<typeof vi.fn> } | null;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sem createImageBitmap (navegador antigo), manda o original", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    expect(await shrinkImage(original)).toBe(original);
  });

  it("recorta o quadrado do centro e reduz para o tamanho da foto", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1200, height: 800, close }));
    const small = new Blob(["pequena"], { type: "image/jpeg" });
    const ctx = fakeCanvas(small);

    expect(await shrinkImage(original)).toBe(small);
    // quadrado de 800 no meio da largura de 1200 -> AVATAR_SIZE x AVATAR_SIZE
    expect(ctx!.drawImage).toHaveBeenCalledWith(
      expect.anything(), 200, 0, 800, 800, 0, 0, AVATAR_SIZE, AVATAR_SIZE
    );
    expect(close).toHaveBeenCalled();
  });

  it("foto menor que o tamanho padrão não é ampliada", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 100, height: 150, close() {} }));
    const ctx = fakeCanvas(new Blob(["x"]));

    await shrinkImage(original);

    expect(ctx!.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 25, 100, 100, 0, 0, 100, 100);
  });

  it("se o canvas não gerar a imagem, manda o original", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 10, height: 10, close() {} }));
    fakeCanvas(null);
    expect(await shrinkImage(original)).toBe(original);
  });

  it("sem contexto 2D, manda o original", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 10, height: 10, close() {} }));
    fakeCanvas(null, null);
    expect(await shrinkImage(original)).toBe(original);
  });

  it("arquivo que não abre como imagem: manda o original e a API recusa", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("imagem inválida")));
    expect(await shrinkImage(original)).toBe(original);
  });
});
