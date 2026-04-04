import Modal from "@/components/ui/Modal";

interface RawDataModalProps {
  title: string;
  data: unknown;
  onClose: () => void;
}

export default function RawDataModal({
  title,
  data,
  onClose,
}: RawDataModalProps) {
  const json = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(json).catch(() => {});
  };

  return (
    <Modal title={`${title} — Raw Data`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex justify-end mb-4">
        <button
          onClick={handleCopy}
          className="text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5 rounded-xl border border-border/30 hover:border-border"
        >
          Copy JSON
        </button>
      </div>
      <pre className="text-sm font-mono whitespace-pre-wrap break-all text-foreground bg-background rounded-2xl p-5 border border-border/30 max-h-[60vh] overflow-y-auto leading-6">
        {json}
      </pre>
    </Modal>
  );
}
