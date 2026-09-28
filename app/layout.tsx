import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ORBIT · Your personal workspace',
  description: 'A calm, user-controlled workspace for your projects, notes, and AI assistant.',
  applicationName: 'ORBIT',
  appleWebApp: { capable: true, title: 'ORBIT', statusBarStyle: 'default' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
