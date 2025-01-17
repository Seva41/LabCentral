import '../styles/globals.css';
import Footer from '../components/Footer';

export default function MyApp({ Component, pageProps }) {
  return (
    <div className="layout">
      {/* Main content */}
      <main className="content">
        <Component {...pageProps} />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
