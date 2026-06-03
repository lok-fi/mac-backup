import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../Loader/Loader";
import "./Login.css";
import logo from '../assets/logo.png';

function Login() {
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await window.catalyst.auth.isUserAuthenticated();

        if (result && result.content) {
          // ✅ Already logged in → go to dashboard
          navigate("/module");
        } else {
          // ❌ Not logged in → embedded Catalyst login with custom CSS
          if (window.catalyst && window.catalyst.auth) {
            window.catalyst.auth.signIn("loginDivElementId", {
  css_url:
    "https://esd-channel-partner-60040289923.development.catalystserverless.in/app/embedded_signin.css",
});

          }
        }
      } catch (error) {
        // ❌ On error → still load embedded login
        if (window.catalyst && window.catalyst.auth) {
          window.catalyst.auth.signIn("loginDivElementId", {
  css_url:
    "https://esd-channel-partner-60040289923.development.catalystserverless.in/app/embedded_signin.css",
});

        }
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [navigate]);

  // 🔄 Loader while checking authentication
  if (isChecking) {
    return <Loader />;
  }

 return (
    <div className="loginWrapper">
      {/* LEFT SIDE */}
      <div className="leftSide">
        <div className="overlay">
          <img src={logo} alt="Company Logo" className="logo-img" />
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="rightSide">
        <div className="formContainer">
          <h2><b>Welcome Back!</b></h2>

          {/* 🔐 Embedded Catalyst Login */}
          <div
            id="loginDivElementId"
            className="login-iframe-container"
          />

          {!window.catalyst && (
            <p style={{ marginTop: "15px", color: "#666", fontSize: "14px" }}>
              Catalyst login will appear only when served via Catalyst.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}



export default Login;
