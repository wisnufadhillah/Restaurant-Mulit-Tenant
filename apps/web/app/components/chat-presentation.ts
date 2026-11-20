export function menuDescription(description: string): string {
  return description
    .replace(/Menu sintetis untuk demo rumah makan\.\s*Harga dapat diubah pemilik\./gi, "")
    .replace(/Data demo sintetis\.?/gi, "")
    .trim();
}

// Preview masking mirrors the API; the server remains the authoritative boundary.
export function maskedChatPreview(message: string) {
  return message.trim().replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[kontak disamarkan]")
    .replace(/\+?\d[\d ()-]{6,}\d/g, "[nomor disamarkan]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[nilai privat disamarkan]");
}
