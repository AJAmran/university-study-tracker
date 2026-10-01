import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'UniMaster Pro — Personal Academic Command Center',
  description: 'Personal Academic Productivity Web App: Courses, Routine, Tasks, Exams, Attendance, Marks & GPA, Materials Vault and AI Study Companion.',
  openGraph: {
    title: 'UniMaster Pro — Personal Academic Command Center',
    description: 'Personal Academic Productivity Web App for University Students.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UniMaster Pro — Personal Academic Command Center',
    description: 'Personal Academic Productivity Web App for University Students.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="antialiased min-h-screen">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

