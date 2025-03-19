import { FaSun, FaMoon } from "react-icons/fa";

function DashboardHeader({ userName, userLast, darkMode, toggleDarkMode, handleLogout }) {
  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold">
          Hola, {userName} {userLast}!
        </h1>
      </div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <FaSun
              className={`text-gray-600 dark:text-gray-300 ${
                darkMode ? "opacity-50" : "opacity-100"
              }`}
            />
            <label className="relative inline-block w-10 h-6 mx-2">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={darkMode}
                onChange={toggleDarkMode}
              />
              <div className="w-10 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition"></div>
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-4 transition"></div>
            </label>
            <FaMoon
              className={`text-gray-600 dark:text-gray-300 ${
                darkMode ? "opacity-100" : "opacity-50"
              }`}
            />
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded text-white bg-red-700 hover:bg-red-800 transition-transform duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
}

export default DashboardHeader;
