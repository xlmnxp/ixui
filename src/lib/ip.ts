const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function isIPv6(text: string): boolean {
  if (!text.includes(":") || /[^0-9a-fA-F:.]/.test(text)) return false;
  try {
    // The URL parser validates IPv6 literals (including :: compression and embedded IPv4).
    new URL(`http://[${text}]/`);
    return true;
  } catch {
    return false;
  }
}

/** True for an IPv4/IPv6 address with an optional /prefix length (e.g. 10.0.0.0/24, fd00::/8). */
export function isValidAddressOrCidr(value: string): boolean {
  const v = value.trim();
  const [addr, prefix, ...rest] = v.split("/");
  if (!addr || rest.length > 0) return false;
  const v4 = IPV4.test(addr);
  const v6 = !v4 && isIPv6(addr);
  if (!v4 && !v6) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  return Number(prefix) <= (v4 ? 32 : 128);
}
