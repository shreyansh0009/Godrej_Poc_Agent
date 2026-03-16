import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#ffffff',
                        color: '#0f172a',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '13.5px',
                    },
                    success: { iconTheme: { primary: '#059669', secondary: '#ffffff' } },
                    error: { iconTheme: { primary: '#e11d48', secondary: '#ffffff' } },
                }}
            />
        </BrowserRouter>
    </React.StrictMode>,
);
