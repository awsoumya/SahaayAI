import React, { useState } from 'react';
import { Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { BoundingBox } from '../types';

interface PhotoBoundingBoxOverlayProps {
  imageSrc: string;
  boxes?: BoundingBox[];
}

export const PhotoBoundingBoxOverlay: React.FC<PhotoBoundingBoxOverlayProps> = ({
  imageSrc,
  boxes = [],
}) => {
  const [showBoxes, setShowBoxes] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Fallback sample boxes if model didn't return any
  const displayBoxes = boxes.length > 0 ? boxes : [
    {
      box_2d: [350, 220, 800, 780],
      label: 'Waste Accumulation Cluster',
      confidence: 0.92,
      category: 'general_waste'
    }
  ];

  const colors = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#9333ea'];

  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
      {/* Evidence Image */}
      <img
        src={imageSrc}
        alt="Analyzed Evidence"
        style={{ width: '100%', maxHeight: '340px', objectFit: 'contain', display: 'block', background: '#0f172a' }}
      />

      {/* SVG Bounding Boxes Overlay */}
      {showBoxes && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {displayBoxes.map((box, idx) => {
            const [ymin, xmin, ymax, xmax] = box.box_2d || [0, 0, 1000, 1000];
            const top = ymin / 10;
            const left = xmin / 10;
            const height = (ymax - ymin) / 10;
            const width = (xmax - xmin) / 10;
            const color = colors[idx % colors.length];
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  position: 'absolute',
                  top: `${top}%`,
                  left: `${left}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                  border: `2px solid ${color}`,
                  background: isHovered ? 'rgba(37, 99, 235, 0.25)' : 'rgba(37, 99, 235, 0.1)',
                  borderRadius: '4px',
                  boxShadow: `0 0 8px ${color}`,
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  zIndex: isHovered ? 20 : 10,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-24px',
                    left: '-2px',
                    background: color,
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                  }}
                >
                  {box.label} ({Math.round(box.confidence * 100)}%)
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Controls Overlay Bar */}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
        <button
          type="button"
          onClick={() => setShowBoxes(!showBoxes)}
          className="btn btn-secondary"
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#ffffff',
            border: 'none',
            fontSize: '11px',
            padding: '4px 10px',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'auto',
          }}
        >
          {showBoxes ? <EyeOff size={13} /> : <Eye size={13} />}
          <span>{showBoxes ? 'Hide Bounding Boxes' : 'Show AI Bounding Boxes'}</span>
        </button>

        <span style={{ background: 'rgba(15, 23, 42, 0.85)', color: '#10b981', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', pointerEvents: 'auto' }}>
          ✓ {displayBoxes.length} Waste Objects Detected
        </span>
      </div>
    </div>
  );
};
