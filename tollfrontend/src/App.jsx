import { useState, useEffect } from "react";
import "./App.css";
import { loginUser, getVehicles, registerUser } from "./services/api";

function App() {
  // ── Auth state ──
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [loggedInUser, setLoggedInUser] = useState(() => localStorage.getItem("username") || (localStorage.getItem("token") ? "admin1" : ""));

  // ── Login / Signup form state ──
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [signupMessage, setSignupMessage] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Dashboard state ──
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeNav, setActiveNav] = useState("Dashboard");

  // ── Load vehicles whenever token changes ──
  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    async function loadVehicles() {
      try {
        const data = await getVehicles(token);
        setVehicles(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadVehicles();
  }, [token]);

  // ── Login handler ──
  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const data = await loginUser(username, password);
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      setToken(data.token);
      setLoggedInUser(data.username);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Signup handler ──
  async function handleSignup(event) {
    event.preventDefault();
    setSignupMessage("");
    if (password !== confirmPassword) {
      setSignupMessage("Passwords do not match");
      return;
    }
    setSignupLoading(true);
    try {
      await registerUser(username, email, password);
      setSignupMessage("Account created! You can now sign in.");
      setPassword("");
      setConfirmPassword("");
      setShowSignup(false);
    } catch (err) {
      setSignupMessage(err.message);
    } finally {
      setSignupLoading(false);
    }
  }

  // ── Logout handler ──
  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken("");
    setLoggedInUser("");
    setVehicles([]);
    setError("");
  }

  const activeVehicles = vehicles.filter((v) => v.is_active).length;

  // ────────────────────────────────────────
  // LOGIN / SIGNUP PAGE (shown when not authenticated)
  // ────────────────────────────────────────
  if (!token) {
    return (
      <div className="app login-page">
        {showSignup ? (
          <form className="login-card" onSubmit={handleSignup}>
            <h2>Create your account</h2>

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>

            {signupMessage && <p className="error">{signupMessage}</p>}

            <button type="submit" className="btn-primary" disabled={signupLoading}>
              {signupLoading ? (
                <>
                  <span className="btn-spinner" /> Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>

            <p className="login-toggle">
              Already have an account?{" "}
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setShowSignup(false);
                  setSignupMessage("");
                }}
              >
                Sign in
              </button>
            </p>
          </form>
        ) : (
          <form className="login-card" onSubmit={handleLogin} id="login-form">
            <div className="login-brand">
              <span className="brand-icon">⬡</span>
              <h1>TollFlow</h1>
            </div>
            <p className="login-sub">Sign in to your account</p>

            {signupMessage && (
              <div className="alert alert--success" style={{ marginBottom: 16 }}>
                <span>✅</span> {signupMessage}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {loginError && (
              <div className="alert alert--error" role="alert">
                <span>⚠️</span> {loginError}
              </div>
            )}

            <button
              id="login-btn"
              type="submit"
              className="btn-primary"
              disabled={loginLoading}
            >
              {loginLoading ? (
                <>
                  <span className="btn-spinner" /> Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>

            <p className="login-toggle">
              Don't have an account?{" "}
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setShowSignup(true);
                  setLoginError("");
                }}
              >
                Sign up
              </button>
            </p>
          </form>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────
  // DASHBOARD (shown when authenticated)
  // ────────────────────────────────────────
  return (
    <div className="app">
      {/* ── Navbar ── */}
      <header className="navbar">
        <div className="navbar-brand">
          <span className="brand-icon">⬡</span>
          <h1>TollFlow</h1>
        </div>
        <nav>
          {["Dashboard", "Vehicle", "Transaction"].map((item) => (
            <a
              key={item}
              href="#"
              className={activeNav === item ? "nav-link active" : "nav-link"}
              onClick={(e) => { e.preventDefault(); setActiveNav(item); }}
            >
              {item}
            </a>
          ))}
        </nav>
        <div className="navbar-right">
          <span className="navbar-user">👤 {loggedInUser || "admin1"}</span>
          <button id="logout-btn" className="btn-logout" onClick={handleLogout}>
            Sign out
          </button>
          <div className="navbar-badge">Live</div>
        </div>
      </header>

      <main className="dashboard">
        {/* ── Hero ── */}
        <section className="hero">
          <div className="hero-text">
            <p className="hero-label">Smart Infrastructure</p>
            <h2>Welcome, <span className="gradient-text">{loggedInUser || "admin1"}</span></h2>
            <p className="hero-sub">Automated toll collection &amp; real-time vehicle management</p>
          </div>
          <div className="hero-glow" aria-hidden="true" />
        </section>

        {/* ── Stat Cards ── */}
        <section className="cards" aria-label="Statistics">
          <div className="card card--vehicles">
            <div className="card-icon">🚗</div>
            <div className="card-info">
              <h3>Registered Vehicles</h3>
              <p className="card-value">{loading ? "—" : vehicles.length}</p>
            </div>
            <div className="card-shine" />
          </div>

          <div className="card card--active">
            <div className="card-icon">✅</div>
            <div className="card-info">
              <h3>Active Vehicles</h3>
              <p className="card-value">{loading ? "—" : activeVehicles}</p>
            </div>
            <div className="card-shine" />
          </div>

          <div className="card card--wallet">
            <div className="card-icon">💳</div>
            <div className="card-info">
              <h3>Wallet Balance</h3>
              <p className="card-value">₹1</p>
            </div>
            <div className="card-shine" />
          </div>

          <div className="card card--transaction">
            <div className="card-icon">📊</div>
            <div className="card-info">
              <h3>Transactions</h3>
              <p className="card-value card-soon">Soon</p>
            </div>
            <div className="card-shine" />
          </div>
        </section>

        {/* ── Vehicles Section ── */}
        <section className="vehicles-section" id="vehicles">
          <div className="section-header">
            <h2>Your Vehicles</h2>
            {!loading && (
              <span className="section-count">{vehicles.length} total</span>
            )}
          </div>

          {loading && (
            <div className="loader-wrap">
              <div className="spinner" />
              <p>Fetching vehicles…</p>
            </div>
          )}

          {error && (
            <div className="alert alert--error">
              <span>⚠️</span> {error}
            </div>
          )}

          {!loading && !error && vehicles.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">🚦</span>
              <p>No vehicles registered yet.</p>
            </div>
          )}

          {!loading && !error && vehicles.length > 0 && (
            <div className="vehicle-grid">
              {vehicles.map((vehicle) => (
                <article className="vehicle-card" key={vehicle.id}>
                  <div className="vehicle-card-top">
                    <span className="vehicle-icon">🚘</span>
                    <span className={`status-badge ${vehicle.is_active ? "badge--active" : "badge--inactive"}`}>
                      {vehicle.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <h3 className="vehicle-reg">{vehicle.registration_number}</h3>
                  <div className="vehicle-meta">
                    <div className="meta-row">
                      <span className="meta-label">Type</span>
                      <span className="meta-value">{vehicle.vehicle_type}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">RFID</span>
                      <span className="meta-value meta-mono">{vehicle.rfid_tag}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>© 2025 TollFlow · Automated Toll Management System</p>
      </footer>
    </div>
  );
}

export default App;