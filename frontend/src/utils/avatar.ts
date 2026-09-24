/** Foto do perfil: iniciais de reserva e redução da foto antes de enviar. */

// Lado (px) da foto enviada: o maior tamanho em que ela aparece, com folga
export const AVATAR_SIZE = 256;
// Mesmo limite da API; só chega nele se o navegador não conseguir reduzir a foto
export const AVATAR_MAX_BYTES = 1024 * 1024;
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** "Ana Maria Souza" -> "AS"; sem nome, a primeira letra do e-mail. */
export function initials(name: string | null, email: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return email.charAt(0).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/**
 * Recorta o quadrado do centro da foto e reduz para AVATAR_SIZE, em JPEG:
 * uma foto de celular de vários MB vira poucos KB. Se o navegador não
 * conseguir (sem createImageBitmap, arquivo estranho...), devolve o original
 * e a API decide.
 */
export async function shrinkImage(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const size = Math.min(AVATAR_SIZE, side);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return file;
    // JPEG não tem transparência: o fundo transparente de um PNG vira branco, não preto
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    );
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Blob -> data URL, para a prévia da foto antes de salvar. */
export async function readAsDataURL(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  // Em pedaços: String.fromCharCode(...bytes) estoura a pilha com arquivos grandes
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}
