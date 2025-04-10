import { APP_CONFIG } from '../config';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="relative w-full text-center">
        <span>
          LabCentral © 2025 - Desarrollado por{' '}
          <a
            href="https://sebadinator.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-200 hover:text-blue-100"
          >
            Sebastián Dinator
          </a>
        </span>

        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-sm version-label">
          v{APP_CONFIG.version}
        </div>
      </div>
    </footer>
  );
}
