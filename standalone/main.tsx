'use client';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { useRoute } from './router';
import Dashboard from '@/app/dashboard/page';
import LoginPage from '@/app/login/page';
import Editor from '@/components/editor/Editor';
import PresentClient from '@/app/present/[id]/PresentClient';
import PublicClient from '@/app/p/[slug]/PublicClient';

function App() {
  const path = useRoute();
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'login') return <LoginPage />;
  if (parts[0] === 'e' && parts[1]) return <Editor id={parts[1]} />;
  if (parts[0] === 'present' && parts[1]) return <PresentClient id={parts[1]} />;
  if (parts[0] === 'p' && parts[1]) return <PublicClient slug={parts[1]} />;
  return <Dashboard />;
}

const el = document.getElementById('root');
createRoot(el).render(<App />);
