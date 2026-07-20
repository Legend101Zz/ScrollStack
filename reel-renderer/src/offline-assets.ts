import type { CompiledReel } from "@scrollstack/reel-components";

const STAGED_ASSET =
  /^assets\/[a-zA-Z0-9_-]{1,128}\/([a-f0-9]{64})\.(?:aac|flac|jpg|json|mp3|ogg|png|wav|webp)$/;

function assertSafeInlineAsset(assetId: string, src: string): void {
  const comma = src.indexOf(",");
  if (comma === -1) throw new Error(`asset ${assetId} has a malformed data URI`);
  const metadata = src.slice(0, comma).toLowerCase();
  const supported =
    metadata.startsWith("data:image/png;") ||
    metadata.startsWith("data:image/jpeg;") ||
    metadata.startsWith("data:image/webp;") ||
    metadata.startsWith("data:audio/") ||
    metadata.startsWith("data:application/json;") ||
    metadata.startsWith("data:image/svg+xml;");
  if (!supported) throw new Error(`asset ${assetId} uses an unsupported data URI`);

  if (metadata.startsWith("data:image/svg+xml;")) {
    let svg: string;
    try {
      svg = decodeURIComponent(src.slice(comma + 1));
    } catch {
      throw new Error(`asset ${assetId} has a malformed inline SVG`);
    }
    if (
      /<(?:foreignObject|image|script)\b/i.test(svg) ||
      /\s(?:href|src)\s*=/i.test(svg) ||
      /(?:@import|url\s*\()/i.test(svg)
    ) {
      throw new Error(`asset ${assetId} inline SVG may not load external content`);
    }
  }
}

export function assertOfflineAssetSources(compiled: CompiledReel): void {
  for (const asset of Object.values(compiled.assets)) {
    if (asset.src.startsWith("data:")) {
      assertSafeInlineAsset(asset.assetId, asset.src);
      continue;
    }
    const staged = STAGED_ASSET.exec(asset.src);
    if (!staged) {
      throw new Error(
        `asset ${asset.assetId} must use a content-addressed staged path; remote and file URLs are forbidden`,
      );
    }
    if (staged[1] !== asset.contentHash) {
      throw new Error(`asset ${asset.assetId} staged path does not match its content hash`);
    }
  }
}
