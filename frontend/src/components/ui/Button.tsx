import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'teal' | 'outline';
type Size = 'default' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-red-mid text-white hover:bg-brand-red',
  teal: 'bg-brand-teal-mid text-white hover:bg-brand-teal',
  outline: 'bg-white text-brand-navy border border-brand-gray-border hover:border-brand-teal-mid hover:text-brand-teal',
};

const sizeClasses: Record<Size, string> = {
  default: 'px-5 py-2.5 text-sm',
  sm: 'px-3.5 py-1.5 text-xs',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'default', fullWidth, className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-brand-sm font-medium transition-colors duration-150',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';
