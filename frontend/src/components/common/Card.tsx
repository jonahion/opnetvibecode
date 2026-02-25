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
                bg-[#111118] border border-[#2a2a3a] rounded-2xl p-6
                ${hoverable ? 'hover:border-[#f7931a]/50 hover:bg-[#1a1a24] cursor-pointer transition-all duration-200' : ''}
                ${className}
            `}
            onClick={onClick}
        >
            {children}
        </div>
    );
}
