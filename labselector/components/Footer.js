export default function Footer() {
  return (
    <footer
      className="footer"
    >
      <div className="relative w-full text-center">
        <span>
          LabCentral © 2025 - Desarrollado por{' '}
          <a
            href="https://github.com/Seva41"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-200 hover:text-blue-100"
          >
            Sebastián Dinator
          </a>
        </span>

        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-sm">
          v0.3.0 BETA
        </div>
      </div>
    </footer>
  );
}
