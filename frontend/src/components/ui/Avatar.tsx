import React from 'react';

interface AvatarProps {
  name: string | null;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({ name, color = '#0a84ff', size = 'md' }) => {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const sizes = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  };

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white shrink-0 select-none`}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
    >
      {initials}
    </div>
  );
};
