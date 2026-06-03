import { Link } from 'react-router-dom';

// FI Digital logo (full colour, transparent bg — shows on white, no container needed).
// CRA serves public assets under PUBLIC_URL (/app).
export default function Brand({ to = '/' }) {
  return (
    <Link to={to} className="flex items-center">
      <img
        src={`${process.env.PUBLIC_URL || ''}/fi-logo.png`}
        alt="FI Digital"
        className="h-8 w-auto"
      />
    </Link>
  );
}
