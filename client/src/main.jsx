import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App.jsx';
import './styles/index.css';
import { CROSS_APP_ID } from './lib/privy';

const router = createBrowserRouter([{ path: '*', element: <App /> }]);

const appId = import.meta.env.VITE_PRIVY_APP_ID;

ReactDOM.createRoot(document.getElementById('root')).render(
  <PrivyProvider
    appId={appId}
    config={{
      appearance: { theme: 'dark', accentColor: '#a855f7' },
      // Privy will create the MGID embedded wallet automatically
      embeddedWallets: { createOnLogin: 'all-users' },

      // CRITICAL: This makes the modal show a dedicated "Monad Games ID" login
      loginMethodsAndOrder: {
        primary: [`privy:${CROSS_APP_ID}`], // cmd8euall0037le0my79qpz42
      },

      // DO NOT set `loginMethods` here; it can override and cause "no login method" error
    }}
  >
    <RouterProvider router={router} />
  </PrivyProvider>
);
