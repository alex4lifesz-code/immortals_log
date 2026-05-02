export function autoTranslateToVietnamese(text: string | null | undefined): string {
  return (text || "").trim();
}

export function resolveVietnameseValue(english: string, preferred?: string | null): string {
  const preferredClean = (preferred || "").trim();
  if (preferredClean && preferredClean.toLowerCase() !== english.trim().toLowerCase()) {
    return preferredClean;
  }
  return english.trim();
}
