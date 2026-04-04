import { ExternalLink } from "lucide-react";
import Modal from "@/components/ui/Modal";

interface InfoModalProps {
  name: string;
  description: string;
  detail?: string;
  examples?: string[];
  links?: { label: string; url: string }[];
  onClose: () => void;
}

export default function InfoModal({
  name,
  description,
  detail,
  examples,
  links,
  onClose,
}: InfoModalProps) {
  return (
    <Modal title={name} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-6">
        <p className="text-foreground font-medium text-lg leading-7">{description}</p>
        {detail && (
          <p className="text-muted leading-7 text-[15px]">{detail}</p>
        )}
        {examples && examples.length > 0 && (
          <div>
            <p className="text-muted/70 text-sm font-semibold uppercase tracking-[0.18em] mb-3">
              Why it matters
            </p>
            <ul className="space-y-3">
              {examples.map((ex, i) => (
                <li key={i} className="text-muted text-[15px] leading-7 flex gap-3">
                  <span className="text-accent shrink-0 mt-0.5">&#8250;</span>
                  <span>{ex}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {links && links.length > 0 && (
          <div>
            <p className="text-muted/70 text-sm font-semibold uppercase tracking-[0.18em] mb-3">
              Learn more
            </p>
            <ul className="space-y-2.5">
              {links.map((link, i) => (
                <li key={i}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent text-[15px] hover:underline inline-flex items-center gap-2"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
