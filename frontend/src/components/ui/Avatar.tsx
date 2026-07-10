import React from 'react';

interface AvatarProps {
  name: string | null;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({ name, color = '#6366f1', size = 'md' }) => {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const sizes = {
    xs: 'w-5 h-5 text-[9px] rounded-md',
    sm: 'w-7 h-7 text-xs rounded-lg',
    md: 'w-8 h-8 text-sm rounded-xl',
    lg: 'w-10 h-10 text-sm rounded-xl',
  };

  return (
    <div
      className={`${sizes[size]} flex items-center justify-center font-semibold text-white shrink-0 select-none`}
      style={{ background: color }}
    >
      {initials}
    </div>
  );
};
