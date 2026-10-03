import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export const metadata: Metadata = {
  title: 'UniMaster Pro — Personal Academic Command Center',
  description: 'Personal Academic Productivity Web App: Courses, Routine, Tasks, Exams, Attendance, Marks & GPA, Materials Vault and AI Study Companion.',
  openGraph: {
    title: 'UniMaster Pro — Personal Academic Command Center',
    description: 'Personal Academic Productivity Web App for University Students.',
    type: 'website',
    siteName: 'UniMaster Pro',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UniMaster Pro — Personal Academic Command Center',
    description: 'Personal Academic Productivity Web App for University Students.',
  },
};

function ThemeInitScript() {
  // Inline blocking script: set .dark before first paint to avoid theme flash
  const code = `(function(){try{var t=localStorage.getItem('unimaster_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body suppressHydrationWarning className="antialiased min-h-screen">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

