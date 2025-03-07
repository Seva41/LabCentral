export default function Footer() {
  return (
    <footer style={{ position: 'relative', padding: '1rem' }}>
      <div style={{ textAlign: 'center' }}>
        LabCentral © 2025 - Desarrollado por{' '}
        <a
          href="https://github.com/Seva41"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#63b3ed' }}
        >
          Sebastián Dinator
        </a>
      </div>
      <div
        style={{
          position: 'absolute',
          right: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        v0.1 BETA
      </div>
    </footer>
  );
}