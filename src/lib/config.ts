export function validateConfigKey(key: string): string | null {
  if (!/^[a-z][a-z0-9_.-]*$/.test(key)) {
    return "Key must start with a letter and contain only a-z, 0-9, . _ -";
  }
  return null;
}
