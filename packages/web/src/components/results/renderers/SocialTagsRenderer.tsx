import { useState } from "react";
import { SectionLabel } from "./primitives";
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

function StackedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2 border-b border-border/15 last:border-0">
      <p className="text-[11px] text-muted uppercase tracking-[0.15em] font-semibold mb-0.5">
        {label}
      </p>
      <p className="text-[15px] leading-snug text-foreground break-words">{value}</p>
    </div>
  );
}

export function SocialTagsRenderer({ data }: RendererProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const d = data as SocialTagsData | undefined;
  if (!d) return <span className="text-sm text-muted">No social tags found</span>;

  const ogTitle = d.ogTitle;
  const ogDesc = d.ogDescription;
  const ogSiteName = d.ogSiteName;
  const twitterCard = d.twitterCard;
  const twitterSite = d.twitterSite;
  const metaTitle = d.title;
  const metaDesc = d.description;
  const metaAuthor = d.author;

  const hasOg = !!(ogTitle || ogDesc || ogSiteName);
  const hasTwitter = !!(twitterCard || twitterSite);
  const hasMeta = !!(metaTitle || metaDesc || metaAuthor);

  // Combine OG & Meta when titles and descriptions match
  const ogTitleMatch = ogTitle && metaTitle && ogTitle === metaTitle;
  const ogDescMatch = ogDesc && metaDesc && ogDesc === metaDesc;
  const shouldCombine = ogTitleMatch && ogDescMatch && hasOg && hasMeta;

  const previewImage = d.ogImage ?? d.twitterImage;

  if (!hasOg && !hasTwitter && !hasMeta && !previewImage) {
    return <span className="text-sm text-muted">{d.message ?? "No social tags found"}</span>;
  }

  return (
    <>
      <div>
        {shouldCombine ? (
          <>
            <SectionLabel>OpenGraph & Meta</SectionLabel>
            {ogTitle && <StackedField label="Title" value={ogTitle} />}
            {ogDesc && <StackedField label="Description" value={ogDesc} />}
            {ogSiteName && <StackedField label="Site Name" value={ogSiteName} />}
          </>
        ) : (
          <>
            {hasOg && (
              <>
                <SectionLabel>OpenGraph</SectionLabel>
                {ogTitle && <StackedField label="Title" value={ogTitle} />}
                {ogDesc && <StackedField label="Description" value={ogDesc} />}
                {ogSiteName && <StackedField label="Site Name" value={ogSiteName} />}
              </>
            )}
            {hasMeta && (
              <>
                <SectionLabel>Meta</SectionLabel>
                {metaTitle && <StackedField label="Title" value={metaTitle} />}
                {metaDesc && <StackedField label="Description" value={metaDesc} />}
                {metaAuthor && <StackedField label="Author" value={metaAuthor} />}
              </>
            )}
          </>
        )}

        {hasTwitter && (
          <>
            <SectionLabel>Twitter</SectionLabel>
            {twitterCard && <StackedField label="Card Type" value={twitterCard} />}
            {twitterSite && <StackedField label="Site" value={twitterSite} />}
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
