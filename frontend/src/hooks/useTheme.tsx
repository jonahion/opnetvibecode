import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'dark',
    toggleTheme: () => {},
});

function getInitialTheme(): Theme {
    try {
        const stored = localStorage.getItem('oprophet-theme');
        if (stored === 'light' || stored === 'dark') return stored;
    } catch {
        // localStorage unavailable
    }
    return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('oprophet-theme', theme);
        } catch {
            // ignore
        }
    }, [theme]);

    const toggleTheme = (): void => {
        setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    return useContext(ThemeContext);
}
