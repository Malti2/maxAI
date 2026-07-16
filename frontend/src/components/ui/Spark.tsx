import React from 'react';

/* maxAI's own brand mark — a soft four-point "spark" with a rounded core.
   Deliberately distinct from any other assistant's logo: rounded, blooming
   points rather than a thin asterisk. Rendered from a gradient so it carries
   the product's iris identity. */
interface SparkProps {
  size?: number;
  className?: string;
  gradient?: boolean;
  title?: string;
}

let uid = 0;

export const Spark: React.FC<SparkProps> = ({ size = 24, className, gradient = true, title }) => {
  const id = React.useMemo(() => `spark-grad-${uid++}`, []);
  const fill = gradient ? `url(#${id})` : 'currentColor';
  return (
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
      {gradient && (
        <defs>
          <linearGradient id={id} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--brand-a)" />
            <stop offset="1" stopColor="var(--brand-b)" />
          </linearGradient>
        </defs>
      )}
      {/* Four blooming points meeting at a soft core */}
      <path
        d="M12 1.6c.5 3.9 1.4 6.3 3 7.9 1.6 1.6 4 2.5 7.9 3-3.9.5-6.3 1.4-7.9 3-1.6 1.6-2.5 4-3 7.9-.5-3.9-1.4-6.3-3-7.9-1.6-1.6-4-2.5-7.9-3 3.9-.5 6.3-1.4 7.9-3 1.6-1.6 2.5-4 3-7.9Z"
        fill={fill}
      />
    </svg>
  );
};
