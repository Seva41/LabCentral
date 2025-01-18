import '../styles/globals.css';
import Footer from '../components/Footer';
import { AuthProvider } from "../context/AuthContext"; // Importa AuthProvider desde la ruta correcta


export default function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
    <div className="layout">
      {/* Main content */}
      <main className="content">
        <Component {...pageProps} />
      </main>

      {/* Footer */}
      <Footer />
    </div>
    </AuthProvider>
  );
}
