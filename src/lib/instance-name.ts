const NAME_RE = /^[a-zA-Z0-9-]+$/;
const MAX_LENGTH = 63;

export function validateInstanceName(name: string): string | null {
  const value = name.trim();
  if (value.length === 0) return "Name is required";
  if (value.length > MAX_LENGTH) return "Name must be 63 characters or fewer";
  if (!NAME_RE.test(value)) return "Name must contain only letters, numbers, and hyphens";
  if (/^[0-9-]/.test(value)) return "Name must start with a letter";
  if (value.endsWith("-")) return "Name must not end with a hyphen";
  return null;
}
