import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'yes' | 'no' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    children: ReactNode;
}

const variantClasses: Record<string, string> = {
    primary: 'bg-[#f7931a] hover:bg-[#fbb040] text-black font-semibold',
    yes: 'bg-green-500 hover:bg-green-400 text-white font-semibold',
    no: 'bg-red-500 hover:bg-red-400 text-white font-semibold',
    ghost: 'bg-transparent border border-[#2a2a3a] hover:border-[#f7931a] text-[#e4e4ec]',
};

const sizeClasses: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-5 py-2.5 text-base rounded-xl',
    lg: 'px-8 py-3.5 text-lg rounded-xl',
};

export function Button({
    variant = 'primary',
    size = 'md',
    children,
    className = '',
    disabled,
    ...props
}: ButtonProps): React.JSX.Element {
    return (
        <button
            className={`
                ${variantClasses[variant]}
                ${sizeClasses[size]}
                transition-all duration-200 cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
                ${className}
            `}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    );
}
