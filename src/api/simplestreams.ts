export const SIMPLE_STREAMS_DEFAULT = "https://images.linuxcontainers.org";

export interface SimplestreamsProduct {
  os: string;
  release: string;
  version: string;
  variant: string;
  arch: string;
  itemTypes: string[];
  size: number;
  path: string;
  fingerprints?: string[];
}

export interface SimplestreamsCatalog {
  products: Record<string, SimplestreamsProduct>;
}

interface SimplestreamsItem {
  path?: string;
  size?: number;
  fingerprint?: string;
}

interface SimplestreamsProductRaw {
  os?: string;
  release?: string;
  version?: string;
  variant?: string;
  arch?: string;
  variants?: Record<string, { items?: Record<string, SimplestreamsItem> }>;
  versions?: Record<string, SimplestreamsItem>;
}

interface SimplestreamsImagesJson {
  products?: Record<string, SimplestreamsProductRaw>;
}

interface SimplestreamsIndexJson {
  index?: Record<string, { path?: string }>;
}

function parseProduct(key: string, raw: SimplestreamsProductRaw): SimplestreamsProduct {
  const keyParts = key.split("-");
  const keyFallback = {
    os: keyParts[0] || "",
    release: keyParts.slice(1, keyParts.length - 2).join("-"),
    variant: keyParts[keyParts.length - 2] || "",
    arch: keyParts[keyParts.length - 1] || "",
  };

  const variantNames = Object.keys(raw.variants ?? {});
  const variant = raw.variant ?? variantNames[0] ?? keyFallback.variant;
  const legacyItems = variant ? (raw.variants?.[variant]?.items ?? {}) : {};
  const items = Object.keys(raw.versions ?? {}).length > 0 ? raw.versions! : legacyItems;
  const itemKeys = Object.keys(items);
  const firstItem = itemKeys[0] ? items[itemKeys[0]] : undefined;
  const fingerprints = itemKeys
    .map((itemKey) => items[itemKey]?.fingerprint)
    .filter((fingerprint): fingerprint is string => fingerprint !== undefined);

  return {
    os: raw.os || keyFallback.os,
    release: raw.release || keyFallback.release,
    version: raw.version || raw.release || keyFallback.release,
    variant,
    arch: raw.arch || keyFallback.arch,
    itemTypes: itemKeys,
    size: firstItem?.size ?? 0,
    path: firstItem?.path ?? "",
    ...(fingerprints.length > 0 ? { fingerprints } : {}),
  };
}

export async function fetchCatalog(baseUrl: string): Promise<SimplestreamsCatalog> {
  const indexRes = await fetch(`${baseUrl}/streams/v1/index.json`);
  if (!indexRes.ok) {
    throw new Error(`Failed to fetch simplestreams index: ${indexRes.status}`);
  }
  const index = (await indexRes.json()) as SimplestreamsIndexJson;

  const imagesEntry = index.index?.images ?? Object.values(index.index ?? {}).find((entry) => entry?.path);
  const imagesPath = imagesEntry?.path;
  if (!imagesPath) {
    throw new Error("Simplestreams index contains no images path");
  }

  const imagesRes = await fetch(`${baseUrl}/${imagesPath}`);
  if (!imagesRes.ok) {
    throw new Error(`Failed to fetch simplestreams images: ${imagesRes.status}`);
  }
  const images = (await imagesRes.json()) as SimplestreamsImagesJson;

  const products: Record<string, SimplestreamsProduct> = {};
  for (const [productKey, raw] of Object.entries(images.products ?? {})) {
    products[productKey] = parseProduct(productKey, raw);
  }
  return { products };
}
