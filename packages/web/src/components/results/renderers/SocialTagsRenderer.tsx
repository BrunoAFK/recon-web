import { useState } from "react";
import { KeyValueTable, SectionLabel } from "./primitives";
import type { RendererProps } from "./types";
import ImageLightbox from "@/components/ui/ImageLightbox";

interface SocialTagsData {
  message?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogSiteName?: string;
  twitterCard?: string;
  twitterSite?: string;
  twitterTitle?: string;
  twitterImage?: string;
  title?: string;
  description?: string;
  author?: string;
  keywords?: string;
  canonical?: string;
  favicon?: string;
}

function truncate(s: string | undefined, max = 80): string | undefined {
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function kvIf(label: string, value?: string) {
  return value ? [{ label, value }] : [];
}

export function SocialTagsRenderer({ data }: RendererProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const d = data as SocialTagsData | undefined;
  if (!d) return <span className="text-sm text-muted">No social tags found</span>;

  const ogItems = [
    ...kvIf("Title", truncate(d.ogTitle)),
    ...kvIf("Description", truncate(d.ogDescription)),
    ...kvIf("Site Name", d.ogSiteName),
  ];

  const twitterItems = [
    ...kvIf("Card Type", d.twitterCard),
    ...kvIf("Site", d.twitterSite),
  ];

  const metaItems = [
    ...kvIf("Title", truncate(d.title)),
    ...kvIf("Description", truncate(d.description)),
    ...kvIf("Author", d.author),
    ...kvIf("Favicon", d.favicon),
  ];

  if (!ogItems.length && !twitterItems.length && !metaItems.length) {
    return <span className="text-sm text-muted">{d.message ?? "No social tags found"}</span>;
  }

  // Combine OG & Meta if title and description match
  const ogTitleMatch = d.ogTitle && d.title && d.ogTitle === d.title;
  const ogDescMatch = d.ogDescription && d.description && d.ogDescription === d.description;
  const shouldCombine = ogTitleMatch && ogDescMatch && ogItems.length > 0 && metaItems.length > 0;
  const previewImage = d.ogImage ?? d.twitterImage;

  return (
    <>
      <div>
      {shouldCombine ? (
        <>
          <SectionLabel>OpenGraph & Meta</SectionLabel>
          <KeyValueTable items={ogItems} />
        </>
      ) : (
        <>
          {ogItems.length > 0 && (
            <>
              <SectionLabel>OpenGraph</SectionLabel>
              <KeyValueTable items={ogItems} />
            </>
          )}
          {metaItems.length > 0 && (
            <>
              <SectionLabel>Meta</SectionLabel>
              <KeyValueTable items={metaItems} />
            </>
          )}
        </>
      )}
      {twitterItems.length > 0 && (
        <>
          <SectionLabel>Twitter</SectionLabel>
          <KeyValueTable items={twitterItems} />
        </>
      )}
      {previewImage && (
        <>
          <SectionLabel>Preview Image</SectionLabel>
          <button
            type="button"
            onClick={() => setLightboxSrc(previewImage)}
            className="mt-2 block w-full overflow-hidden rounded-xl border border-border/30 bg-surface/40 transition-opacity hover:opacity-95"
          >
            <img
              src={previewImage}
              alt="Social preview"
              className="h-auto max-h-[260px] w-full object-cover object-top"
              loading="lazy"
            />
          </button>
        </>
      )}
      </div>
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="Social preview"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}
