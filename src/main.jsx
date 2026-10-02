import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import './NewFeatures.css'
import App from './App.jsx'
// Auto-reload on Vite chunk load errors (e.g. after a new deployment on Vercel)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error, reloading page to get latest chunks...', event);
  window.location.reload(true);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
