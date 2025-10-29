import Lottie from 'lottie-react';
import GuardRailLoader from '../assets/loaders/Guard Railing Loader.json';
import FileLoader from '../assets/loaders/File loader lottie.json';

type LoaderType = 'guardrail' | 'file';

interface LoaderProps {
  type?: LoaderType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 80,
  md: 120,
  lg: 200,
};

export function Loader({ type = 'guardrail', size = 'md', className = '' }: LoaderProps) {
  const animationData = type === 'guardrail' ? GuardRailLoader : FileLoader;
  const pixelSize = sizeMap[size];

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
        style={{ width: pixelSize, height: pixelSize }}
      />
    </div>
  );
}

// Full-screen loader overlay
export function LoaderOverlay({ type = 'guardrail', size = 'lg' }: Omit<LoaderProps, 'className'>) {
  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 bg-opacity-90 dark:bg-opacity-90 flex items-center justify-center z-50">
      <Loader type={type} size={size} />
    </div>
  );
}
