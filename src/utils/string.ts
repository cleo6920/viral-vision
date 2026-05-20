export function safeMatch(text: string | undefined | null, regex: RegExp): RegExpMatchArray | null {
  if (!text) return null;
  return text.match(regex);
}
