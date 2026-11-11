import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-display text-4xl font-semibold text-brand-navy">Page not found</h1>
      <p className="text-brand-gray">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/">
        <Button variant="teal">Back to home</Button>
      </Link>
    </div>
  );
}
