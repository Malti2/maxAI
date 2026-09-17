import React from 'react';

interface SparkProps {
  size?: number;
  className?: string;
  gradient?: boolean;
  title?: string;
}

export const Spark: React.FC<SparkProps> = ({ size = 24, className, title }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    role={title ? 'img' : 'presentation'}
    aria-label={title}
    aria-hidden={title ? undefined : true}
  >
    <path
      d="M12 2.25c.42 3.33 1.22 5.43 2.62 6.83 1.4 1.4 3.5 2.2 6.83 2.62-3.33.42-5.43 1.22-6.83 2.62-1.4 1.4-2.2 3.5-2.62 6.83-.42-3.33-1.22-5.43-2.62-6.83-1.4-1.4-3.5-2.2-6.83-2.62 3.33-.42 5.43-1.22 6.83-2.62C10.78 7.68 11.58 5.58 12 2.25Z"
      fill="currentColor"
    />
  </svg>
);
