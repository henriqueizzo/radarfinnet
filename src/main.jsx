import React from 'react'
import { createRoot } from 'react-dom/client'
import './finnet-ux.css'
import './radar.css'
import App from './App.jsx'
import { ProvedorAvisos } from './componentes/Avisos.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ProvedorAvisos>
      <App />
    </ProvedorAvisos>
  </React.StrictMode>,
)
