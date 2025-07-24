import AdminAddExercise from "./admin/AdminAddExercise";
import AdminResetPassword from "./admin/AdminResetPassword";
import BulkUserCreation from "./admin/BulkUserCreation";
import CollapsibleCard from "./CollapsibleCard";

function AdminPanel({ refreshExercises }) {
  return (
    <div className="space-y-6">
      <CollapsibleCard title="Agregar Ejercicio" defaultOpen={false}>
        <AdminAddExercise refreshExercises={refreshExercises} />
      </CollapsibleCard>

      <CollapsibleCard title="Reset de Contraseña" defaultOpen={false}>
        <AdminResetPassword />
      </CollapsibleCard>

      <CollapsibleCard title="Creación Masiva de Usuarios" defaultOpen={false}>
        <BulkUserCreation />
      </CollapsibleCard>
    </div>
  );
}

export default AdminPanel;
