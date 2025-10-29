import { useTheme } from '../contexts/ThemeContext';
import logoLight from '../assets/logos/masai-white.svg';
import logoDark from '../assets/logos/masai-black.svg';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className = '', size = 'md' }: LogoProps) {
  const { theme } = useTheme();

  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12'
  };

  return (
    <img
      src={theme === 'dark' ? logoLight : logoDark}
      alt="Masai Logo"
      className={`${sizeClasses[size]} w-auto object-contain ${className}`}
    />
  );
}