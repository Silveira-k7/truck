import { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  size?: 'sm' | 'md';
}

export default function Badge({ className = '', variant = 'gray', size = 'sm', children, ...props }: BadgeProps) {
  const variants = {
    primary: 'bg-primary-100 text-primary-700',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    danger: 'bg-danger-100 text-danger-700',
    gray: 'bg-gray-100 text-gray-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full whitespace-nowrap ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'danger' | 'gray' }> = {
    active: { label: 'Ativo', variant: 'success' },
    stopped: { label: 'Parado', variant: 'gray' },
    maintenance: { label: 'Em Manutenção', variant: 'warning' },
    planned: { label: 'Planejada', variant: 'gray' },
    in_progress: { label: 'Em Andamento', variant: 'primary' },
    completed: { label: 'Finalizada', variant: 'warning' },
    approved: { label: 'Aprovada', variant: 'success' },
    cancelled: { label: 'Cancelada', variant: 'danger' },
  };

  const config = statusConfig[status] || { label: status, variant: 'gray' as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
