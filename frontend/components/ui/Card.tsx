import React from "react";

interface CardProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Reusable Card UI component for consistent layout and design.
 * Used in dashboard or data summary blocks.
 *
 * Props:
 * - title: string – Title shown at the top of the card
 * - children: ReactNode – Main content area
 * - footer: ReactNode (optional) – Optional footer section (e.g., buttons)
 * - className: string (optional) – Custom Tailwind class overrides
 */
const Card: React.FC<CardProps> = ({ title, children, footer, className }) => {
  return (
    <div className={`card bg-base-100 shadow-xl ${className || ""}`}>
      <div className="card-body">
        <h2 className="card-title">{title}</h2>
        <div className="mt-2">{children}</div>
        {footer && <div className="card-actions justify-end mt-4">{footer}</div>}
      </div>
    </div>
  );
};

export default Card;
