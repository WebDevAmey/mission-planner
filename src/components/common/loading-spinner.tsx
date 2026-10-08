import { Spinner } from '@/components/ui/spinner';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

const SIZE_PX: Record<Required<LoadingSpinnerProps>['size'], number> = {
  small: 16,
  medium: 28,
  large: 40,
};

export function LoadingSpinner({ size = 'medium', message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Spinner size={SIZE_PX[size]} />
      {message && <p className="font-mono text-[11px] text-text-dim">{message}</p>}
    </div>
  );
}
