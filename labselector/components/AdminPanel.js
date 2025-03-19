import AdminAddExercise from "./admin/AdminAddExercise";
import AdminResetPassword from "./admin/AdminResetPassword";
import BulkUserCreation from "./admin/BulkUserCreation";

function AdminPanel({ refreshExercises }) {
  return (
    <div className="space-y-6">
      <AdminAddExercise refreshExercises={refreshExercises} />
      <AdminResetPassword />
      <BulkUserCreation />
    </div>
  );
}

export default AdminPanel;
