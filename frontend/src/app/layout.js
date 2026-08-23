import './globals.css';

export const metadata = {
  title: 'CampusWatch — Distributed Attendance & Booking',
  description: 'Raft-based replicated attendance and resource booking system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
