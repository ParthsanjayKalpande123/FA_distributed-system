import './globals.css';

export const metadata = {
  title: 'CampusWatch — Distributed Attendance & Booking',
  description: 'Raft-based replicated attendance and resource-booking system for campuses',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
