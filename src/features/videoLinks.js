export function safeWebUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function normalizeVideoUrl(value) {
  const text = String(value || "").trim();
  const withProtocol = /^(?:(?:www|m|music)\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//i.test(text)
    ? `https://${text}`
    : text;
  return safeWebUrl(withProtocol);
}
export function videoLink(value) {
  const safe = normalizeVideoUrl(value);
  if (!safe) return null;
  const url = new URL(safe),
    host = url.hostname.toLowerCase().replace(/^www\./, "");
  let id;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host))
    id =
      url.searchParams.get("v") ||
      url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
  if (id && /^[a-zA-Z0-9_-]{11}$/.test(id))
    return {
      kind: "embed",
      src: `https://www.youtube-nocookie.com/embed/${id}`,
      label: "YouTube video",
    };
  if (["vimeo.com", "player.vimeo.com"].includes(host)) {
    const match = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/);
    if (match)
      return {
        kind: "embed",
        src: `https://player.vimeo.com/video/${match[1]}`,
        label: "Vimeo video",
      };
  }
  if (/\.(mp4|webm|ogg|ogv)$/i.test(url.pathname))
    return { kind: "video", src: safe, label: "Video" };
  return null;
}
export function safeEmbed(value) {
  const link = videoLink(value);
  return link?.kind === "embed" ? link.src : "";
}
