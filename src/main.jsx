import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { installDemo } from './demo.js';
import './styles.css';

// Outside Electron (npm run preview) a keyboard-driven demo stands in for the knob.
if (!window.orbit) installDemo();

createRoot(document.getElementById('root')).render(<App />);
