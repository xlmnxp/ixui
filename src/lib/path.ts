export function joinPath(dir: string, name: string): string {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

export function parentOf(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  if (trimmed === "" || trimmed === "/") return "/";
  const idx = trimmed.lastIndexOf("/");
  return idx <= 0 ? "/" : trimmed.slice(0, idx);
}

export function basenameOf(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.split("/").pop() ?? "";
}

/** Normalize a user-typed path: absolute, no trailing slashes except root. */
export function normalizeTypedPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "/";
  let path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  path = path.replace(/\\+/g, "/").replace(/\/+/g, "/");
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}
