import '../styles/globals.css';
import Footer from '../components/Footer';
import { AuthProvider } from "../context/AuthContext";

export default function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      {/* Un contenedor flexible a lo alto */}
      <div className="flex flex-col min-h-screen">
        {/* Área de contenido crece para llenar el espacio */}
        <main className="flex-1">
          <Component {...pageProps} />
        </main>

        <Footer />
      </div>
    </AuthProvider>
  );
}
