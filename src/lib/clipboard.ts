export type ShareOutcome = "shared" | "copied" | "failed";

/** Opens the native share sheet on touch devices, otherwise copies the text. */
export async function shareText(text: string): Promise<ShareOutcome> {
  try {
    if (typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ text });
      return "shared";
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "failed";
    // Any other failure falls through to the clipboard.
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
