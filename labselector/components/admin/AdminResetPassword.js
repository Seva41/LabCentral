import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function AdminResetPassword() {
  const [resetEmail, setResetEmail] = useState("");
  const [resetTokenGenerated, setResetTokenGenerated] = useState("");

  const handleResetToken = async () => {
    try {
      const response = await fetch(`${API_URL}/api/request_password_reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await response.json();
      if (data.reset_token) {
        setResetTokenGenerated(data.reset_token);
      } else {
        setResetTokenGenerated("");
        alert("No se pudo generar un token (el usuario no existe o error desconocido).");
      }
    } catch (error) {
      console.error("Error generando token de reseteo:", error);
      alert("Error generando token");
    }
  };

  return (
    <div className="card p-4">
      <h2 className="text-lg font-semibold mb-4">Reset de Contraseña (Admin)</h2>
      <p className="text-sm mb-3">
        Ingresa el correo del usuario. Si existe, se generará un token de reseteo para que ese usuario pueda cambiar su contraseña en <strong>/reset-password</strong>.
      </p>
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 sm:gap-4">
        <input
          type="email"
          placeholder="Correo del usuario"
          value={resetEmail}
          onChange={(e) => setResetEmail(e.target.value)}
          className="input"
        />
        <button
          onClick={handleResetToken}
          className="button button-gradient"
        >
          Generar Token
        </button>
      </div>
      {resetTokenGenerated && (
        <div className="mt-4 break-words">
          <strong>Token generado:</strong> {resetTokenGenerated}
          <br />
          <span className="text-xs">
            Entrégaselo al usuario para que lo use en <b>/reset-password</b>
          </span>
        </div>
      )}
    </div>
  );
}

export default AdminResetPassword;
