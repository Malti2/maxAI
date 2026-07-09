import React from 'react';
import { ModelId, getModel } from '../../lib/models';

interface ModelBadgeProps {
  modelId: ModelId;
  size?: 'xs' | 'sm' | 'md';
  showName?: boolean;
}

export const ModelBadge: React.FC<ModelBadgeProps> = ({ modelId, size = 'sm', showName = true }) => {
  const model = getModel(modelId);
  
  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span className="inline-flex items-center gap-1 font-medium">
      {showName && (
        <span className="text-current opacity-70">{model.name}</span>
      )}
      <span
        className={`inline-flex items-center rounded-full font-semibold ${sizeClasses[size]}`}
        style={{
          background: `${model.color}20`,
          color: model.color,
          border: `1px solid ${model.color}40`,
        }}
      >
        {model.badge}
      </span>
    </span>
  );
};
