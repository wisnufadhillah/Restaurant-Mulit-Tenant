// Preview masking mirrors the API; the server remains the authoritative boundary.
export function maskedChatPreview(message: string) {
  return message.trim().replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[kontak disamarkan]")
    .replace(/\+?\d[\d ()-]{6,}\d/g, "[nomor disamarkan]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[nilai privat disamarkan]");
}
