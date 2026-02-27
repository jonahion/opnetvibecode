import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
    hoverable?: boolean;
}

export function Card({ children, className = '', onClick, hoverable = false }: CardProps): React.JSX.Element {
    return (
        <div
            className={`
                bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6
                ${hoverable ? 'hover:border-[var(--color-btc-orange)]/50 hover:bg-[var(--color-bg-card-hover)] cursor-pointer transition-all duration-200' : ''}
                ${className}
            `}
            onClick={onClick}
        >
            {children}
        </div>
    );
}
