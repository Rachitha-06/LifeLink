import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface FileUploadProps {
  onUpload: (file: File) => Promise<unknown>;
  accept?: string;
  label?: string;
}

/** Optional-step file upload used in the donation/request forms and
 * post-submission document attach flows. Intentionally not required to
 * complete the surrounding form — a missing report shouldn't block
 * someone from registering as a donor. */
export function FileUpload({ onUpload, accept = '.pdf,.jpg,.jpeg,.png,.webp', label = 'Upload supporting document' }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setError(null);
    try {
      await onUpload(file);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  return (
    <div className="rounded-brand-sm border border-dashed border-brand-gray-border p-4">
      <label className="mb-2 block text-xs font-medium text-brand-navy">{label}</label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setStatus('idle');
          }}
          className="flex-1 text-xs text-brand-gray file:mr-3 file:rounded-brand-sm file:border-0 file:bg-brand-gray-light file:px-3 file:py-1.5 file:text-xs file:font-medium"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!file || status === 'uploading'}
          onClick={handleUpload}
        >
          {status === 'uploading' ? 'Uploading…' : status === 'done' ? 'Uploaded ✓' : 'Upload'}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-brand-red-mid">{error}</p>}
      <p className="mt-2 text-[11px] text-brand-gray">
        PDF, JPEG, PNG, or WEBP — optional, up to 10MB. You can skip this and add it later.
      </p>
    </div>
  );
}
