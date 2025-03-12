import '../styles/globals.css';
import Footer from '../components/Footer';
import { AuthProvider } from "../context/AuthContext";

export default function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <div className="h-screen overflow-y-auto pb-16">
        <Component {...pageProps} />
      </div>

      <Footer />
    </AuthProvider>
  );
}
