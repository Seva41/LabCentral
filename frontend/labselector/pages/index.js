import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirige al login por defecto
    router.replace("/login");
  }, [router]);

  return (
    <div className="layout min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">LabCentral</h1>
      <p className="text-base">Cargando...</p>
    </div>
  );
}
