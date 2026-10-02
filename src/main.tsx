import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent spurious React 19 internal developer warning from bubbling
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Expected static flag was missing')
  ) {
    return;
  }
  originalConsoleError(...args);
};

createRoot(document.getElementById('root')!).render(<App />);
