import { useEffect, useRef, useState } from 'react';

interface CaptchaProps {
  onVerify: (token: string | undefined) => void;
}

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void }) => number;
    };
    onRecaptchaLoad?: () => void;
  }
}

/**
 * Renders Google reCAPTCHA v2 if VITE_RECAPTCHA_SITE_KEY is configured;
 * otherwise shows a clearly-labeled disabled placeholder and treats the
 * step as automatically passed — same graceful-degradation philosophy
 * as the backend's captchaService.js mock fallback, so registration
 * isn't blocked in a dev/demo environment without a real Google account.
 */
export function Captcha({ onVerify }: CaptchaProps) {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!siteKey) {
      onVerify(undefined); // nothing to verify — backend treats this as mock-mode pass-through
      return;
    }

    if (window.grecaptcha) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
    script.async = true;
    window.onRecaptchaLoad = () => setScriptLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      delete window.onRecaptchaLoad;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onVerify intentionally not a dep, only runs once per mount
  }, [siteKey]);

  useEffect(() => {
    if (scriptLoaded && containerRef.current && window.grecaptcha && siteKey) {
      window.grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onVerify(token),
        'expired-callback': () => onVerify(undefined),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onVerify intentionally not a dep, render() should only run once
  }, [scriptLoaded, siteKey]);

  if (!siteKey) {
    return (
      <p className="rounded-brand-sm bg-brand-gray-light px-3 py-2 text-[11px] text-brand-gray">
        CAPTCHA disabled in this build (no VITE_RECAPTCHA_SITE_KEY configured).
      </p>
    );
  }

  return <div ref={containerRef} />;
}
