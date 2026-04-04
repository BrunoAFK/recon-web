import { useState } from "react";
import type { RendererProps } from "./types";
import ImageLightbox from "@/components/ui/ImageLightbox";

export function ScreenshotRenderer({ data }: RendererProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  let imageData: string | undefined;

  if (typeof data === "string") {
    imageData = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    imageData = (obj.image ?? obj.screenshot) as string | undefined;
  }

  if (!imageData) {
    return <span className="text-sm text-muted">No screenshot available</span>;
  }

  const src = imageData.startsWith("data:")
    ? imageData
    : `data:image/png;base64,${imageData}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="block w-full overflow-hidden rounded-xl border border-border/30 bg-surface/40 transition-opacity hover:opacity-95"
      >
        <div className="aspect-video w-full">
          <img
            src={src}
            alt="Screenshot"
            loading="lazy"
            className="h-full w-full object-cover object-top"
          />
        </div>
      </button>
      {lightboxOpen && (
        <ImageLightbox
          src={src}
          alt="Website screenshot"
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
