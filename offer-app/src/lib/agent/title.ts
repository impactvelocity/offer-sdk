/** First line of a chat's opening message, as its title until a better one is generated. */
export function titleFromText(text: string) {
  const line = text.trim().split("\n")[0].replace(/\s+/g, " ");
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line || "New chat";
}
