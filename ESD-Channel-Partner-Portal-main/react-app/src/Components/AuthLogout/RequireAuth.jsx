import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";

export default function RequireAuth() {
  const authUser = useSelector((state) => state.auth.user);

  if (!authUser) {
    return <Navigate to="app/login" replace />;
  }

  return <Outlet />;
}
