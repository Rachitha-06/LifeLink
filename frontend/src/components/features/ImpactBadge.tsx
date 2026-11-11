import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface ImpactBadgeProps {
  donorName: string;
  organType: string;
  date: string;
  onClose: () => void;
}

const WIDTH = 1200;
const HEIGHT = 630; // standard social-share aspect ratio

/** Draws a shareable "I donated" card entirely client-side via Canvas —
 * no image-generation service or backend dependency needed for
 * something this simple. */
function drawBadge(canvas: HTMLCanvasElement, donorName: string, organType: string, date: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#1A1F36';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle accent band
  ctx.fillStyle = '#2C3357';
  ctx.fillRect(0, HEIGHT - 90, WIDTH, 90);

  // Heart glyph (same shape family as the app icon, simplified)
  ctx.fillStyle = '#D24536';
  ctx.beginPath();
  const hx = WIDTH / 2, hy = 190;
  ctx.moveTo(hx, hy + 70);
  ctx.bezierCurveTo(hx - 140, hy - 20, hx - 90, hy - 110, hx - 20, hy - 60);
  ctx.bezierCurveTo(hx - 5, hy - 75, hx + 5, hy - 75, hx + 20, hy - 60);
  ctx.bezierCurveTo(hx + 90, hy - 110, hx + 140, hy - 20, hx, hy + 70);
  ctx.closePath();
  ctx.fill();

  // Pulse line through the heart
  ctx.strokeStyle = '#F9F7F4';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(hx - 55, hy);
  ctx.lineTo(hx - 25, hy);
  ctx.lineTo(hx - 10, hy - 35);
  ctx.lineTo(hx + 10, hy + 35);
  ctx.lineTo(hx + 25, hy);
  ctx.lineTo(hx + 55, hy);
  ctx.stroke();

  // Headline
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F9F7F4';
  ctx.font = '600 44px Georgia, serif';
  ctx.fillText(`${donorName} donated ${organType.toLowerCase()}`, WIDTH / 2, 340);

  ctx.font = '400 26px Arial, sans-serif';
  ctx.fillStyle = '#9CA3AF';
  ctx.fillText(
    `via LifeLink · ${new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`,
    WIDTH / 2,
    390
  );

  // Wordmark in the accent band
  ctx.textAlign = 'left';
  ctx.font = '700 30px Georgia, serif';
  ctx.fillStyle = '#F9F7F4';
  ctx.fillText('Life', WIDTH / 2 - 90, HEIGHT - 35);
  const lifeWidth = ctx.measureText('Life').width;
  ctx.fillStyle = '#D24536';
  ctx.fillText('Link', WIDTH / 2 - 90 + lifeWidth, HEIGHT - 35);
}

export function ImpactBadge({ donorName, organType, date, onClose }: ImpactBadgeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawBadge(canvas, donorName, organType, date);
    setDownloadUrl(canvas.toDataURL('image/png'));
  }, [donorName, organType, date]);

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'lifelink-impact.png', { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'My LifeLink donation' });
        }
      } catch {
        // user cancelled the share sheet — not an error worth surfacing
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="impact-badge-title" className="w-full max-w-lg rounded-brand bg-white p-4 shadow-brand-lg">
        <div className="mb-3 flex items-center justify-between">
          <span id="impact-badge-title" className="text-sm font-semibold text-brand-navy">
            Share your impact
          </span>
          <button onClick={onClose} aria-label="Close" className="text-brand-gray hover:text-brand-navy">✕</button>
        </div>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full rounded-brand-sm" />
        <div className="mt-4 flex gap-2">
          {downloadUrl && (
            <a href={downloadUrl} download="lifelink-impact.png" className="flex-1">
              <Button fullWidth variant="outline">Download</Button>
            </a>
          )}
          {canShare && (
            <Button fullWidth variant="teal" onClick={handleShare}>Share</Button>
          )}
        </div>
      </div>
    </div>
  );
}
