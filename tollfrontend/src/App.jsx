import { useState, useEffect, useCallback } from "react";
import "./App.css";
import {
  getVehicles,
  loginUser,
  registerUser,
  addVehicle,
  getWallet,
  getTollTransactions,
  demoTopUp,
  processToll,
  getTollPlazas,
  getMe,
  toggleVehicleActive,
  getAdminStats,
  getAdminUsers,
  updateAdminUser,
  getAdminVehicles,
  updateAdminVehicle,
  getAdminPlazas,
  createAdminPlaza,
  updateAdminPlaza,
  getAdminRules,
  createAdminRule,
  updateAdminRule,
  deleteAdminRule,
  getAdminTransactions,
  updateVehicle,
  getAdminReports,
  exportAdminTransactionsCSV,
  logoutUser,
  updateProfile,
  changePassword,
  setAuthErrorHandler,
} from "./services/api";

// ─────────────────────────────────────────────
// Small reusable components
// ─────────────────────────────────────────────

function Alert({ type = "error", children }) {
  const cls = { error: "alert--error", success: "alert--success", info: "alert--info" }[type] || "alert--info";
  return <div className={`alert ${cls}`} role="alert">{children}</div>;
}

function Spinner({ text = "Loading…" }) {
  return (
    <div className="loader-wrap">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  );
}

function Badge({ active }) {
  return (
    <span className={`status-badge ${active ? "badge--active" : "badge--inactive"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="summary-card">
      <p>{label}</p>
      <h2>{value}</h2>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  );
}

function UserActivityChart({ transactions = [] }) {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
    days.push({ date: dateStr, label: dayLabel, success: 0, failed: 0, totalSpent: 0 });
  }

  transactions.forEach((tx) => {
    if (!tx.created_at) return;
    const txDate = tx.created_at.slice(0, 10);
    const dayObj = days.find((d) => d.date === txDate);
    if (dayObj) {
      if (tx.status === "SUCCESS") {
        dayObj.success += 1;
        dayObj.totalSpent += Number(tx.amount || 0);
      } else {
        dayObj.failed += 1;
      }
    }
  });

  const [hoveredDay, setHoveredDay] = useState(null);
  const maxPassages = Math.max(...days.map((d) => Math.max(d.success, d.failed)), 4);

  const svgWidth = 640;
  const svgHeight = 190;
  const padLeft = 32;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 28;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const slotWidth = plotWidth / days.length;
  const barWidth = 14;

  const ticks = [0, Math.ceil(maxPassages * 0.5), maxPassages];

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {ticks.map((tickVal, idx) => {
          const y = padTop + plotHeight - (tickVal / maxPassages) * plotHeight;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={svgWidth - padRight}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 4"
              />
              <text
                x={padLeft - 6}
                y={y + 4}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize="10"
              >
                {tickVal}
              </text>
            </g>
          );
        })}

        {days.map((d, i) => {
          const slotX = padLeft + i * slotWidth;
          const centerX = slotX + slotWidth / 2;

          const sCount = d.success;
          const fCount = d.failed;
          const sHeight = Math.max((sCount / maxPassages) * plotHeight, sCount > 0 ? 3 : 0);
          const fHeight = Math.max((fCount / maxPassages) * plotHeight, fCount > 0 ? 3 : 0);

          const sY = padTop + plotHeight - sHeight;
          const fY = padTop + plotHeight - fHeight;
          const sX = centerX - barWidth - 1;
          const fX = centerX + 1;

          const isHovered = hoveredDay && hoveredDay.date === d.date;

          return (
            <g key={d.date || i}>
              {isHovered && (
                <rect
                  x={slotX + 2}
                  y={padTop}
                  width={slotWidth - 4}
                  height={plotHeight}
                  fill="rgba(40, 30, 20, 0.04)"
                  rx="4"
                />
              )}

              {sCount > 0 && (
                <rect
                  x={sX}
                  y={sY}
                  width={barWidth}
                  height={sHeight}
                  fill="#10b981"
                  rx="2"
                />
              )}

              {fCount > 0 && (
                <rect
                  x={fX}
                  y={fY}
                  width={barWidth}
                  height={fHeight}
                  fill="#ef4444"
                  rx="2"
                />
              )}

              <text
                x={centerX}
                y={svgHeight - 10}
                textAnchor="middle"
                fill={isHovered ? "var(--text)" : "var(--text-muted)"}
                fontSize="10"
                fontWeight={isHovered ? "600" : "400"}
              >
                {d.label}
              </text>

              <rect
                x={slotX}
                y={padTop}
                width={slotWidth}
                height={plotHeight + 25}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
              />
            </g>
          );
        })}
      </svg>

      {hoveredDay && (
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 8,
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "5px 12px",
            fontSize: "12px",
            boxShadow: "0 4px 12px rgba(40, 30, 20, 0.08)",
            pointerEvents: "none",
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--text)" }}>{hoveredDay.label}</span>
          <span style={{ color: "var(--success)" }}>✓ {hoveredDay.success}</span>
          {hoveredDay.failed > 0 && (
            <span style={{ color: "var(--danger)" }}>✗ {hoveredDay.failed}</span>
          )}
          <span style={{ color: "var(--accent)", fontWeight: 700 }}>₹{hoveredDay.totalSpent.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

function AdminAnalyticsChart({ data = [], range = "7d", onHoverDay, hoveredDay }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "40px 20px" }}>
        <span className="empty-icon">📈</span>
        <p>No transaction history recorded yet.</p>
      </div>
    );
  }

  const allZero = data.every((d) => Number(d.success) === 0 && Number(d.failed) === 0);

  const maxVal = Math.max(
    ...data.map((d) => Math.max(Number(d.success || 0), Number(d.failed || 0))),
    5
  );

  const svgWidth = 720;
  const svgHeight = 240;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const n = data.length;
  const slotWidth = plotWidth / n;
  const is30d = range === "30d" || n > 15;
  const barWidth = Math.max(Math.min(slotWidth * 0.36, 18), 3);

  const ticks = [0, Math.ceil(maxVal * 0.25), Math.ceil(maxVal * 0.5), Math.ceil(maxVal * 0.75), maxVal];

  return (
    <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: "100%", height: "auto", display: "block", minWidth: is30d ? "600px" : "auto" }}
      >
        {ticks.map((tickVal, idx) => {
          const y = padTop + plotHeight - (tickVal / maxVal) * plotHeight;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={svgWidth - padRight}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 4"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize="11"
              >
                {tickVal}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const slotX = padLeft + i * slotWidth;
          const centerX = slotX + slotWidth / 2;

          const sCount = Number(d.success || 0);
          const fCount = Number(d.failed || 0);

          const sHeight = Math.max((sCount / maxVal) * plotHeight, sCount > 0 ? 3 : 0);
          const fHeight = Math.max((fCount / maxVal) * plotHeight, fCount > 0 ? 3 : 0);

          const sY = padTop + plotHeight - sHeight;
          const fY = padTop + plotHeight - fHeight;

          const sX = centerX - barWidth - 1;
          const fX = centerX + 1;

          const showLabel = !is30d || i % 5 === 0 || i === n - 1;
          const isHovered = hoveredDay && hoveredDay.date === d.date;

          return (
            <g key={d.date || i}>
              {isHovered && (
                <rect
                  x={slotX}
                  y={padTop}
                  width={slotWidth}
                  height={plotHeight}
                  fill="rgba(40, 30, 20, 0.04)"
                  rx="4"
                />
              )}

              {sCount > 0 && (
                <rect
                  x={sX}
                  y={sY}
                  width={barWidth}
                  height={sHeight}
                  fill="#10b981"
                  rx="2"
                />
              )}

              {fCount > 0 && (
                <rect
                  x={fX}
                  y={fY}
                  width={barWidth}
                  height={fHeight}
                  fill="#ef4444"
                  rx="2"
                />
              )}

              {showLabel && (
                <text
                  x={centerX}
                  y={svgHeight - 12}
                  textAnchor="middle"
                  fill={isHovered ? "var(--text)" : "var(--text-muted)"}
                  fontSize="10"
                  fontWeight={isHovered ? "600" : "400"}
                >
                  {d.label || d.date?.slice(5)}
                </text>
              )}

              <rect
                x={slotX}
                y={padTop}
                width={slotWidth}
                height={plotHeight + 25}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => onHoverDay && onHoverDay(d)}
                onMouseLeave={() => onHoverDay && onHoverDay(null)}
              />
            </g>
          );
        })}
      </svg>

      {hoveredDay && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "16px",
            background: "rgba(15, 22, 41, 0.95)",
            border: "1px solid var(--border-h)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 12px",
            fontSize: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            minWidth: "150px",
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--text)", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>
            {hoveredDay.date}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--success)" }}>
            <span>✓ Successful:</span>
            <strong>{hoveredDay.success}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--danger)" }}>
            <span>✕ Failed:</span>
            <strong>{hoveredDay.failed}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--accent-3)" }}>
            <span>₹ Revenue:</span>
            <strong>₹{Number(hoveredDay.revenue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>
      )}

      {allZero && (
        <div style={{ textAlign: "center", padding: "10px 0 6px", color: "var(--text-soft)", fontSize: "12px" }}>
          No transactions recorded in the selected period.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Profile & Security View (Level 3)
// ─────────────────────────────────────────────

function ProfileView({
  userProfileData,
  onProfileUpdated,
  token,
  role,
  loggedInUser,
  onLogout,
  walletBalance,
  vehicles,
  totalTollSpent,
}) {
  const [email, setEmail] = useState(userProfileData?.email || "");
  const [firstName, setFirstName] = useState(userProfileData?.first_name || "");
  const [lastName, setLastName] = useState(userProfileData?.last_name || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ text: "", type: "" });
  const [profileErrors, setProfileErrors] = useState({});

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ text: "", type: "" });
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => {
    if (userProfileData) {
      setEmail(userProfileData.email || "");
      setFirstName(userProfileData.first_name || "");
      setLastName(userProfileData.last_name || "");
    }
  }, [userProfileData]);

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setProfileMsg({ text: "", type: "" });
    setProfileErrors({});

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setProfileErrors({ email: "Email address cannot be empty." });
      return;
    }

    setProfileLoading(true);
    try {
      const updated = await updateProfile(
        { email: cleanEmail, first_name: firstName.trim(), last_name: lastName.trim() },
        token
      );
      setProfileMsg({ text: "Profile updated successfully!", type: "success" });
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      setProfileMsg({ text: err.message, type: "error" });
      if (err.fieldErrors) {
        setProfileErrors(err.fieldErrors);
      }
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordMsg({ text: "", type: "" });
    setPasswordErrors({});

    const errs = {};
    if (!currentPassword) errs.current_password = "Enter your current password.";
    if (!newPassword) errs.new_password = "Enter a new password.";
    else if (newPassword.length < 8) errs.new_password = "Password must be at least 8 characters.";
    if (newPassword !== confirmPassword) errs.confirm_password = "New passwords do not match.";

    if (Object.keys(errs).length > 0) {
      setPasswordErrors(errs);
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword, confirmPassword, token);
      setPasswordMsg({ text: "Password changed successfully! Session secured.", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (res?.token) {
        localStorage.setItem("token", res.token);
      }
    } catch (err) {
      setPasswordMsg({ text: err.message, type: "error" });
      if (err.fieldErrors) {
        setPasswordErrors(err.fieldErrors);
      }
    } finally {
      setPasswordLoading(false);
    }
  }

  const username = userProfileData?.username || loggedInUser || "User";
  const userRole = userProfileData?.role || role || "OWNER";
  const isActive = userProfileData?.is_active !== false;
  const dateJoinedFormatted = userProfileData?.date_joined
    ? new Date(userProfileData.date_joined).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="profile-container" id="user-profile-view">
      <div className="profile-header-card">
        <div className="profile-identity-group">
          <div className="profile-avatar-badge" aria-label="User avatar">
            {initials}
          </div>
          <div className="profile-identity-text">
            <h2>{username}</h2>
            <div className="profile-badges-row">
              <span className={`role-badge ${userRole === "ADMIN" ? "role-admin" : "role-owner"}`}>
                {userRole === "ADMIN" ? "ADMINISTRATOR" : "VEHICLE OWNER"}
              </span>
              <span className={`status-badge ${isActive ? "badge--active" : "badge--inactive"}`}>
                {isActive ? "Account Active" : "Inactive"}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-soft)" }}>
                Member since {dateJoinedFormatted}
              </span>
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            className="btn-logout"
            id="profile-signout-btn"
            onClick={onLogout}
            style={{ padding: "10px 20px" }}
          >
            🚪 Sign Out Securely
          </button>
        </div>
      </div>

      <div className="profile-grid-two-col">
        <div className="profile-card">
          <div className="profile-card-header">
            <h3>👤 Account Overview</h3>
          </div>
          <div className="vehicle-meta" style={{ gap: 14 }}>
            <div className="meta-row">
              <span className="meta-label">Username</span>
              <span className="meta-value" style={{ fontWeight: 600 }}>{username}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Email Address</span>
              <span className="meta-value">{userProfileData?.email || "—"}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Assigned Role</span>
              <span className="meta-value">
                {userRole === "ADMIN" ? "Administrator (Full System Access)" : "Vehicle Owner"}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Account Status</span>
              <span className="meta-value" style={{ color: isActive ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                {isActive ? "Active / In Good Standing" : "Deactivated"}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Registration Date</span>
              <span className="meta-value">{dateJoinedFormatted}</span>
            </div>

            {userRole === "OWNER" && (
              <>
                <div className="meta-row" style={{ borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
                  <span className="meta-label">Wallet Balance</span>
                  <span className="meta-value" style={{ color: "var(--success)", fontWeight: 700 }}>
                    ₹{walletBalance || "0.00"}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Registered Vehicles</span>
                  <span className="meta-value">{vehicles?.length || 0}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Lifetime Toll Spent</span>
                  <span className="meta-value">₹{(totalTollSpent || 0).toFixed(2)}</span>
                </div>
              </>
            )}

            {userRole === "ADMIN" && (
              <div className="security-summary-box" style={{ marginTop: 10 }}>
                🛡️ <strong>Admin Authority:</strong> This account holds complete administrative rights over users, vehicles, toll plazas, rules, and system transaction monitoring.
              </div>
            )}
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-card-header">
            <h3>✏️ Edit Profile Information</h3>
          </div>

          <form onSubmit={handleUpdateProfile}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label htmlFor="profile-username">Username (System Identifier)</label>
              <input
                id="profile-username"
                type="text"
                value={username}
                disabled
                className="profile-input-readonly"
              />
              <div className="profile-field-desc">Username cannot be modified to preserve audit and transaction history.</div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label htmlFor="profile-email">Email Address</label>
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@domain.com"
              />
              {profileErrors.email && <div className="field-error-text">{Array.isArray(profileErrors.email) ? profileErrors.email.join(", ") : profileErrors.email}</div>}
              <div className="profile-field-desc">Used for toll debit receipts and account security notices.</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label htmlFor="profile-first-name">First Name</label>
                <input
                  id="profile-first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label htmlFor="profile-last-name">Last Name</label>
                <input
                  id="profile-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            {profileMsg.text && (
              <div style={{ marginBottom: 16 }}>
                <Alert type={profileMsg.type}>{profileMsg.text}</Alert>
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              id="save-profile-btn"
              disabled={profileLoading}
              style={{ width: "100%" }}
            >
              {profileLoading ? "Saving Changes…" : "Save Profile Details"}
            </button>
          </form>
        </div>
      </div>

      <div className="profile-card" style={{ maxWidth: 640 }}>
        <div className="profile-card-header">
          <h3>🔒 Change Password</h3>
        </div>

        <form onSubmit={handleChangePassword}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label htmlFor="current-password-input">Current Password</label>
            <input
              id="current-password-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
            {passwordErrors.current_password && (
              <div className="field-error-text">
                {Array.isArray(passwordErrors.current_password) ? passwordErrors.current_password.join(", ") : passwordErrors.current_password}
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label htmlFor="new-password-input">New Password</label>
            <input
              id="new-password-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
            />
            {passwordErrors.new_password && (
              <div className="field-error-text">
                {Array.isArray(passwordErrors.new_password) ? passwordErrors.new_password.join(", ") : passwordErrors.new_password}
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 18 }}>
            <label htmlFor="confirm-new-password-input">Confirm New Password</label>
            <input
              id="confirm-new-password-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
            {passwordErrors.confirm_password && (
              <div className="field-error-text">
                {Array.isArray(passwordErrors.confirm_password) ? passwordErrors.confirm_password.join(", ") : passwordErrors.confirm_password}
              </div>
            )}
          </div>

          {passwordMsg.text && (
            <div style={{ marginBottom: 16 }}>
              <Alert type={passwordMsg.type}>{passwordMsg.text}</Alert>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            id="change-password-btn"
            disabled={passwordLoading}
          >
            {passwordLoading ? "Updating Password…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────

function App() {
  // ── Auth state ────────────────────────────
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [role, setRole] = useState(() => localStorage.getItem("role") || "");
  const [loggedInUser, setLoggedInUser] = useState(() => localStorage.getItem("username") || "");

  // ── Login/Signup form state ────────────────
  const [showSignup, setShowSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [signupMessage, setSignupMessage] = useState("");

  // ── Nav ───────────────────────────────────
  const [activeNav, setActiveNavState] = useState(() => {
    const hash = window.location.hash.replace("#", "").toLowerCase();
    if (hash === "vehicles") return "Vehicles";
    if (hash === "wallet") return "Wallet";
    if (hash === "history") return "History";
    if (hash === "profile") return "Profile";
    return localStorage.getItem("userActiveNav") || "Dashboard";
  });

  const setActiveNav = useCallback((nav) => {
    setActiveNavState(nav);
    localStorage.setItem("userActiveNav", nav);
    window.location.hash = nav.toLowerCase();
  }, []);

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace("#", "").toLowerCase();
      if (hash === "vehicles") setActiveNavState("Vehicles");
      else if (hash === "wallet") setActiveNavState("Wallet");
      else if (hash === "history") setActiveNavState("History");
      else if (hash === "profile") setActiveNavState("Profile");
      else setActiveNavState("Dashboard");
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const [adminSection, setAdminSection] = useState("Dashboard");
  const [adminRange, setAdminRange] = useState("7d");
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [chartHover, setChartHover] = useState(null);

  // ── Dual Portal Mode Switcher (Operator only) ─────────
  const [activePortal, setActivePortal] = useState(() => {
    const savedRole = localStorage.getItem("role");
    const savedUser = localStorage.getItem("username");
    if (savedRole === "ADMIN" || savedUser === "admin1") {
      return localStorage.getItem("tollflow_portal") || "ADMIN";
    }
    return "USER";
  });

  // ── Admin: Toll Booth Station ─────────────
  const [boothPlazaId, setBoothPlazaId] = useState("");
  const [boothSelectedVehicle, setBoothSelectedVehicle] = useState(null);
  const [boothSearch, setBoothSearch] = useState("");
  const [boothProcessing, setBoothProcessing] = useState(false);
  const [boothResult, setBoothResult] = useState(null);
  const [boothError, setBoothError] = useState("");

  // ── Owner: Vehicles ───────────────────────
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState("ALL");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("cards");
  const [selectedVehicleDetail, setSelectedVehicleDetail] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [refreshingVehicles, setRefreshingVehicles] = useState(false);

  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("CAR");
  const [rfidTag, setRfidTag] = useState("");
  const [vehicleMessage, setVehicleMessage] = useState("");
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [addErrors, setAddErrors] = useState({});

  // ── Owner: Wallet ─────────────────────────
  const [walletBalance, setWalletBalance] = useState("0.00");
  const [walletMessage, setWalletMessage] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupMessage, setTopupMessage] = useState("");
  const [topupSuccess, setTopupSuccess] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);

  // ── Owner: Transactions ───────────────────
  const [transactions, setTransactions] = useState([]);
  const [transactionMessage, setTransactionsMessage] = useState("");
  const [transactionLoading, setTransactionsLoading] = useState(false);
  const [txnSearch, setTxnSearch] = useState("");
  const [txnStatusFilter, setTxnStatusFilter] = useState("ALL");
  const [txnDateFilter, setTxnDateFilter] = useState("ALL");
  const [txnPage, setTxnPage] = useState(1);
  const txnsPerPage = 10;

  // ── Owner: Toll ───────────────────────────
  const [tollPlazas, setTollPlazas] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedTollPlaza, setSelectedTollPlaza] = useState("");
  const [tollMessage, setTollMessage] = useState("");
  const [tollResult, setTollResult] = useState(null);
  const [tollLoading, setTollLoading] = useState(false);

  // ── Admin: Stats ──────────────────────────
  const [adminStats, setAdminStats] = useState(null);
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);

  // ── Admin: Users ──────────────────────────
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUserSearch, setAdminUserSearch] = useState("");

  // ── Admin: Vehicles ───────────────────────
  const [adminVehicles, setAdminVehicles] = useState([]);
  const [adminVehiclesLoading, setAdminVehiclesLoading] = useState(false);
  const [adminVehicleSearch, setAdminVehicleSearch] = useState("");

  // ── Admin: Plazas ─────────────────────────
  const [adminPlazas, setAdminPlazas] = useState([]);
  const [adminPlazasLoading, setAdminPlazasLoading] = useState(false);
  const [adminPlazaSearch, setAdminPlazaSearch] = useState("");
  const [showPlazaForm, setShowPlazaForm] = useState(false);
  const [plazaFormData, setPlazaFormData] = useState({ name: "", location: "", is_active: true });
  const [plazaEditId, setPlazaEditId] = useState(null);
  const [plazaFormMsg, setPlazaFormMsg] = useState("");

  // ── Admin: Rules ──────────────────────────
  const [adminRules, setAdminRules] = useState([]);
  const [adminRulesLoading, setAdminRulesLoading] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleFormData, setRuleFormData] = useState({ toll_plaza: "", vehicle_type: "CAR", amount: "", is_active: true });
  const [ruleEditId, setRuleEditId] = useState(null);
  const [ruleFormMsg, setRuleFormMsg] = useState("");

  // ── Admin: Transactions ───────────────────
  const [adminTxns, setAdminTxns] = useState(null);
  const [adminTxnsLoading, setAdminTxnsLoading] = useState(false);
  const [adminTxnFilters, setAdminTxnFilters] = useState({ status: "", plaza_id: "", search: "", date_from: "", date_to: "" });

  // ── Admin: Reports & Export ────────────────
  const [adminReports, setAdminReports] = useState(null);
  const [adminReportsLoading, setAdminReportsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // ── Owner: Edit Vehicle & Profile ──────────
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editReg, setEditReg] = useState("");
  const [editType, setEditType] = useState("CAR");
  const [editRfid, setEditRfid] = useState("");
  const [editMsg, setEditMsg] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState({});
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem("email") || "");
  const [userProfileData, setUserProfileData] = useState(null);

  // ─────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────
  const activeVehicles = vehicles.filter((v) => v.is_active).length;
  const inactiveVehicles = vehicles.length - activeVehicles;

  const filteredVehicles = vehicles.filter((v) => {
    if (vehicleStatusFilter === "ACTIVE" && !v.is_active) return false;
    if (vehicleStatusFilter === "INACTIVE" && v.is_active) return false;
    if (vehicleTypeFilter !== "ALL" && v.vehicle_type !== vehicleTypeFilter) return false;
    if (vehicleSearch.trim()) {
      const q = vehicleSearch.trim().toLowerCase();
      const matchReg = v.registration_number?.toLowerCase().includes(q);
      const matchRfid = v.rfid_tag?.toLowerCase().includes(q);
      const matchType = v.vehicle_type?.toLowerCase().includes(q);
      return matchReg || matchRfid || matchType;
    }
    return true;
  });

  const successfulTransactions = transactions.filter((t) => t.status === "SUCCESS");
  const failedTransactions = transactions.filter((t) => t.status === "FAILED");
  const totalTollSpent = successfulTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const isOperatorAdmin = role === "ADMIN" || loggedInUser === "admin1";
  const isAdmin = isOperatorAdmin;

  const filteredUserTransactions = transactions.filter((t) => {
    if (txnStatusFilter === "SUCCESS" && t.status !== "SUCCESS") return false;
    if (txnStatusFilter === "FAILED" && t.status !== "FAILED") return false;

    if (txnSearch.trim()) {
      const q = txnSearch.trim().toLowerCase();
      const matchReg = (t.vehicle_registration || "").toLowerCase().includes(q);
      const matchPlaza = (t.toll_plaza_name || "").toLowerCase().includes(q);
      const matchId = String(t.id || "").includes(q);
      const matchState = (t.state || "").toLowerCase().includes(q);
      if (!matchReg && !matchPlaza && !matchId && !matchState) return false;
    }

    if (txnDateFilter !== "ALL") {
      const tDate = new Date(t.created_at || t.transaction_time);
      const now = new Date();
      if (txnDateFilter === "TODAY") {
        const isToday = tDate.toDateString() === now.toDateString();
        if (!isToday) return false;
      } else if (txnDateFilter === "7D") {
        const diffMs = now - tDate;
        if (diffMs > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (txnDateFilter === "30D") {
        const diffMs = now - tDate;
        if (diffMs > 30 * 24 * 60 * 60 * 1000) return false;
      }
    }

    return true;
  });

  const totalTxnPages = Math.max(1, Math.ceil(filteredUserTransactions.length / txnsPerPage));
  const paginatedTransactions = filteredUserTransactions.slice(
    (txnPage - 1) * txnsPerPage,
    txnPage * txnsPerPage
  );

  // ─────────────────────────────────────────
  // Profile loader callback
  // ─────────────────────────────────────────
  const loadUserProfile = useCallback(async (authToken) => {
    const t = authToken || token;
    if (!t) return;
    try {
      const data = await getMe(t);
      setUserProfileData(data);
      if (data.email) {
        setUserEmail(data.email);
        localStorage.setItem("email", data.email);
      }
      if (data.username) {
        setLoggedInUser(data.username);
        localStorage.setItem("username", data.username);
      }
      if (data.role) {
        setRole(data.role);
        localStorage.setItem("role", data.role);
      }
    } catch (err) {
      console.warn("Could not fetch user profile:", err.message);
    }
  }, [token]);

  // ─────────────────────────────────────────
  // Data reloader
  // ─────────────────────────────────────────
  const refreshUserData = useCallback(async (authToken) => {
    const t = authToken || token;
    if (!t) return;
    try {
      const [vehicleData, walletData, transactionData, plazaData] = await Promise.all([
        getVehicles(t).catch(() => []),
        getWallet(t).catch(() => null),
        getTollTransactions(t).catch(() => []),
        getTollPlazas(t).catch(() => []),
      ]);
      setVehicles(vehicleData);
      if (walletData?.balance !== undefined) setWalletBalance(walletData.balance);
      setTransactions(transactionData || []);
      setTollPlazas(plazaData || []);
    } catch (err) {
      console.warn("Could not refresh user data:", err.message);
    }
  }, [token]);

  // ─────────────────────────────────────────
  // Load data on login
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    loadUserProfile(token);
    async function loadData() {
      setLoading(true);
      try {
        await refreshUserData(token);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token, loadUserProfile, refreshUserData]);

  // ─────────────────────────────────────────
  // Auth handlers
  // ─────────────────────────────────────────
  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const data = await loginUser(username, password);
      const uName = data.username || username;
      const uRole = data.role || "OWNER";
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", uName);
      localStorage.setItem("role", uRole);
      setToken(data.token);
      setLoggedInUser(uName);
      setRole(uRole);
      setPassword("");

      const isOp = uRole === "ADMIN" || uName === "admin1";
      if (isOp) {
        setActivePortal("ADMIN");
        localStorage.setItem("tollflow_portal", "ADMIN");
        setAdminSection("TollBooth");
      } else {
        setActivePortal("USER");
        localStorage.setItem("tollflow_portal", "USER");
      }

      loadUserProfile(data.token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      if (token) {
        await logoutUser(token);
      }
    } catch (err) {
      console.warn("Server logout error:", err);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      localStorage.removeItem("role");
      localStorage.removeItem("email");
      localStorage.removeItem("userActiveNav");
      localStorage.removeItem("tollflow_portal");
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      setToken("");
      setRole("");
      setActivePortal("USER");
      setLoggedInUser("");
      setUserEmail("");
      setUserProfileData(null);
      setVehicles([]);
      setTransactions([]);
      setTollPlazas([]);
      setWalletBalance("0.00");
      setError("");
      setAdminStats(null);
      setAdminUsers([]);
      setAdminVehicles([]);
      setAdminPlazas([]);
      setAdminRules([]);
      setAdminTxns(null);
      setAdminReports(null);
      setEditingVehicle(null);
      setActiveNav("Dashboard");
      setAdminSection("Dashboard");
    }
  }

  // Auto logout on 401 Unauthorized API error
  useEffect(() => {
    setAuthErrorHandler(() => {
      handleLogout();
    });
  }, []);

  async function handleSignup(event) {
    event.preventDefault();
    setSignupMessage("");
    if (password !== confirmPassword) { setSignupMessage("Passwords do not match"); return; }
    try {
      await registerUser(username, email, password);
      setSignupMessage("Account created! You can now sign in.");
      setPassword(""); setConfirmPassword(""); setShowSignup(false);
    } catch (err) {
      setSignupMessage(err.message);
    }
  }

  // ─────────────────────────────────────────
  // Owner handlers
  // ─────────────────────────────────────────
  async function handleAddVehicle(event) {
    event.preventDefault();
    setVehicleLoading(true);
    setVehicleMessage("");
    setAddErrors({});

    const reg = registrationNumber.trim().toUpperCase();
    const rfid = rfidTag.trim();

    const errs = {};
    if (!reg) errs.registration_number = "Registration number is required.";
    else if (reg.length < 4) errs.registration_number = "Must be at least 4 characters.";
    if (!rfid) errs.rfid_tag = "RFID tag is required.";
    else if (rfid.length < 3) errs.rfid_tag = "RFID tag must be at least 3 characters.";

    if (Object.keys(errs).length > 0) {
      setAddErrors(errs);
      setVehicleLoading(false);
      return;
    }

    try {
      await addVehicle({ registration_number: reg, vehicle_type: vehicleType, rfid_tag: rfid }, token);
      const updated = await getVehicles(token);
      setVehicles(updated);
      setRegistrationNumber("");
      setVehicleType("CAR");
      setRfidTag("");
      setVehicleMessage("Vehicle registered successfully!");
      setTimeout(() => {
        setShowVehicleForm(false);
        setVehicleMessage("");
      }, 1200);
    } catch (err) {
      setVehicleMessage(err.message);
      if (err.fieldErrors) {
        setAddErrors({
          registration_number: Array.isArray(err.fieldErrors.registration_number)
            ? err.fieldErrors.registration_number.join(", ")
            : err.fieldErrors.registration_number,
          rfid_tag: Array.isArray(err.fieldErrors.rfid_tag)
            ? err.fieldErrors.rfid_tag.join(", ")
            : err.fieldErrors.rfid_tag,
        });
      }
    } finally {
      setVehicleLoading(false);
    }
  }

  async function handleToggleVehicle(vehicle) {
    if (vehicle.is_active) {
      setConfirmDeactivate(vehicle);
      return;
    }
    await executeToggleVehicle(vehicle, true);
  }

  async function executeToggleVehicle(vehicle, newStatus) {
    try {
      setVehicleLoading(true);
      const updated = await toggleVehicleActive(vehicle.id, newStatus, token);
      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicle.id ? (updated?.id ? updated : { ...v, is_active: newStatus }) : v))
      );
      setVehicleMessage(
        `Vehicle ${vehicle.registration_number} ${newStatus ? "activated" : "deactivated"} successfully.`
      );
    } catch (err) {
      setVehicleMessage(err.message);
    } finally {
      setVehicleLoading(false);
      setConfirmDeactivate(null);
    }
  }

  async function handleRefreshVehicles() {
    setRefreshingVehicles(true);
    setVehicleMessage("");
    try {
      const data = await getVehicles(token);
      setVehicles(data);
    } catch (err) {
      setVehicleMessage(err.message);
    } finally {
      setRefreshingVehicles(false);
    }
  }

  async function handleLoadTransactions() {
    setTransactionsLoading(true); setTransactionsMessage("");
    try {
      const data = await getTollTransactions(token);
      setTransactions(data);
      setTxnPage(1);
    } catch (err) {
      setTransactionsMessage(err.message);
    } finally {
      setTransactionsLoading(false);
    }
  }

  async function handleTopUp(customAmount) {
    const rawVal = customAmount !== undefined ? customAmount : topupAmount;
    const amount = Number(rawVal);
    setTopupMessage("");
    setTopupSuccess(false);

    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      setTopupMessage("Please enter an amount between ₹1.00 and ₹1,00,000.00.");
      return;
    }

    setTopupLoading(true);
    try {
      const data = await demoTopUp(amount.toFixed(2), token);
      setWalletBalance(data.balance);
      setTopupAmount("");
      setTopupSuccess(true);
      setTopupMessage(`Demo top-up successful! ₹${Number(data.amount_added).toFixed(2)} added to your wallet.`);
      await refreshUserData(token);
    } catch (err) {
      setTopupSuccess(false);
      setTopupMessage(err.message || "Failed to process demo top-up.");
    } finally {
      setTopupLoading(false);
    }
  }

  async function handleRefreshWallet() {
    setWalletLoading(true);
    try {
      const data = await getWallet(token);
      if (data?.balance !== undefined) setWalletBalance(data.balance);
    } catch (err) {
      console.warn("Could not refresh wallet:", err.message);
    } finally {
      setWalletLoading(false);
    }
  }

  async function handleProcessToll(event) {
    if (event) event.preventDefault();
    if (tollLoading) return;
    setTollMessage("");
    setTollResult(null);

    const vehicle = vehicles.find((item) => String(item.id) === String(selectedVehicle));
    if (!vehicle) {
      setTollMessage("Please select a registered vehicle.");
      return;
    }
    if (!vehicle.is_active) {
      setTollMessage("The selected vehicle is currently inactive. Please activate it in My Vehicles first.");
      return;
    }
    if (!selectedTollPlaza) {
      setTollMessage("Please select an active toll plaza.");
      return;
    }

    setTollLoading(true);
    try {
      const result = await processToll(vehicle.rfid_tag, selectedTollPlaza, token);
      setTollResult(result);
      setTollMessage(result.message || "Toll processing completed.");
      await refreshUserData(token);
    } catch (err) {
      setTollResult({
        success: false,
        message: err.message,
        state: err.fieldErrors?.state || "FAILED",
      });
      setTollMessage(err.message || "Toll processing failed.");
      await refreshUserData(token);
    } finally {
      setTollLoading(false);
    }
  }

  // ─────────────────────────────────────────
  // Admin loaders
  // ─────────────────────────────────────────
  const loadAdminStats = useCallback(async (range = adminRange) => {
    setAdminStatsLoading(true);
    try { setAdminStats(await getAdminStats(token, range)); }
    catch (e) { console.error(e); }
    finally { setAdminStatsLoading(false); }
  }, [token, adminRange]);

  const loadAdminUsers = useCallback(async (search = adminUserSearch) => {
    setAdminUsersLoading(true);
    try { setAdminUsers(await getAdminUsers(token, search)); }
    catch (e) { console.error(e); }
    finally { setAdminUsersLoading(false); }
  }, [token, adminUserSearch]);

  const loadAdminVehicles = useCallback(async (search = adminVehicleSearch) => {
    setAdminVehiclesLoading(true);
    try {
      if (role === "ADMIN") {
        setAdminVehicles(await getAdminVehicles(token, search));
      } else {
        const myVehs = await getVehicles(token);
        const mapped = myVehs.map((v) => ({
          ...v,
          owner_username: loggedInUser,
          owner_wallet_balance: walletBalance,
        }));
        setAdminVehicles(mapped);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAdminVehiclesLoading(false);
    }
  }, [token, role, loggedInUser, walletBalance, adminVehicleSearch]);

  const loadAdminPlazas = useCallback(async (search = adminPlazaSearch) => {
    setAdminPlazasLoading(true);
    try {
      if (role === "ADMIN") {
        setAdminPlazas(await getAdminPlazas(token, search));
      } else {
        const pz = await getTollPlazas(token);
        setAdminPlazas(pz || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAdminPlazasLoading(false);
    }
  }, [token, role, adminPlazaSearch]);

  const loadAdminRules = useCallback(async () => {
    setAdminRulesLoading(true);
    try {
      if (role === "ADMIN") {
        setAdminRules(await getAdminRules(token));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAdminRulesLoading(false);
    }
  }, [token, role]);

  const loadAdminTxns = useCallback(async (filters = adminTxnFilters) => {
    setAdminTxnsLoading(true);
    try {
      if (role === "ADMIN") {
        setAdminTxns(await getAdminTransactions(token, filters));
      } else {
        const txs = await getTollTransactions(token);
        setAdminTxns(txs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAdminTxnsLoading(false);
    }
  }, [token, role, adminTxnFilters]);

  const loadAdminReports = useCallback(async () => {
    setAdminReportsLoading(true);
    try { setAdminReports(await getAdminReports(token)); }
    catch (e) { console.error(e); }
    finally { setAdminReportsLoading(false); }
  }, [token]);

  const handleExportCSV = async (filters = {}) => {
    setExportLoading(true);
    try {
      await exportAdminTransactionsCSV(token, filters);
    } catch (err) {
      alert("Failed to export: " + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleUpdateVehicle = async (event) => {
    event.preventDefault();
    if (!editingVehicle) return;

    const errors = {};
    const reg = editReg.trim().toUpperCase();
    const rfid = editRfid.trim();

    if (!reg) {
      errors.registration_number = "Registration number is required.";
    } else if (reg.length < 4) {
      errors.registration_number = "Registration number must be at least 4 characters.";
    }

    if (!rfid) {
      errors.rfid_tag = "RFID tag is required.";
    } else if (rfid.length < 3) {
      errors.rfid_tag = "RFID tag must be at least 3 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setEditLoading(true);
    setEditMsg("");
    setEditErrors({});
    try {
      const updated = await updateVehicle(
        editingVehicle.id,
        {
          registration_number: reg,
          vehicle_type: editType,
          rfid_tag: rfid,
        },
        token
      );
      setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setEditMsg("Vehicle updated successfully!");
      setTimeout(() => {
        setEditingVehicle(null);
        setEditMsg("");
        setEditErrors({});
      }, 900);
    } catch (err) {
      setEditMsg(err.message || "Failed to update vehicle");
      if (err.fieldErrors) {
        setEditErrors({
          registration_number: Array.isArray(err.fieldErrors.registration_number)
            ? err.fieldErrors.registration_number.join(", ")
            : err.fieldErrors.registration_number,
          rfid_tag: Array.isArray(err.fieldErrors.rfid_tag)
            ? err.fieldErrors.rfid_tag.join(", ")
            : err.fieldErrors.rfid_tag,
        });
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleAdminDeductToll = async (e) => {
    if (e) e.preventDefault();
    if (!boothSelectedVehicle) {
      setBoothError("Please select an incoming vehicle at the lane.");
      return;
    }
    const plazaId = boothPlazaId || (adminPlazas.find((p) => p.is_active)?.id);
    if (!plazaId) {
      setBoothError("Please select an active toll plaza booth.");
      return;
    }

    setBoothProcessing(true);
    setBoothError("");
    setBoothResult(null);

    try {
      const res = await processToll(boothSelectedVehicle.rfid_tag, plazaId, token);
      setBoothResult(res);
      loadAdminTxns();
      loadAdminStats(adminRange);
      loadAdminVehicles();
      refreshUserData(token);
      // Auto-lower barrier after 4.5 seconds for next incoming car
      setTimeout(() => {
        setBoothResult((prev) => (prev?.success ? null : prev));
      }, 4500);
    } catch (err) {
      if (err.fieldErrors && err.fieldErrors.state) {
        setBoothResult({
          success: false,
          state: err.fieldErrors.state,
          message: err.fieldErrors.message || err.message,
        });
      } else {
        setBoothError(err.message || "Failed to process toll deduction.");
      }
      loadAdminTxns();
      loadAdminStats(adminRange);
      loadAdminVehicles();
      refreshUserData(token);
    } finally {
      setBoothProcessing(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (activePortal === "ADMIN" || isAdmin) {
      if (adminSection === "Overview" || adminSection === "Dashboard") loadAdminStats(adminRange);
      if (adminSection === "TollBooth") {
        loadAdminPlazas();
        loadAdminVehicles();
        loadAdminRules();
        loadAdminTxns();
      }
      if (adminSection === "Users") loadAdminUsers();
      if (adminSection === "Vehicles") loadAdminVehicles();
      if (adminSection === "Plazas") { loadAdminPlazas(); }
      if (adminSection === "Rules") { loadAdminRules(); loadAdminPlazas(); }
      if (adminSection === "Transactions") loadAdminTxns();
      if (adminSection === "Reports") loadAdminReports();
    }
  }, [token, activePortal, isAdmin, adminSection, adminRange]);

  // ─────────────────────────────────────────
  // AUTH SCREENS
  // ─────────────────────────────────────────
  if (!token) {
    return (
      <div className="app login-page">
        {showSignup ? (
          <form className="login-card" onSubmit={handleSignup} id="signup-form">
            <div className="login-brand">
              <span className="brand-icon">⬡</span>
              <h1>TollFlow</h1>
            </div>
            <p className="login-sub">Create your account</p>
            <div className="form-group">
              <label htmlFor="signup-username">Username</label>
              <input id="signup-username" type="text" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
            </div>
            <div className="form-group">
              <label htmlFor="signup-email">Email</label>
              <input id="signup-email" type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <input id="signup-password" type="password" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label htmlFor="signup-confirm">Confirm Password</label>
              <input id="signup-confirm" type="password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
            </div>
            {signupMessage && <Alert type={signupMessage.includes("created") ? "success" : "error"}>{signupMessage}</Alert>}
            <button type="submit" className="btn-primary">Create Account</button>
            <p className="login-toggle">
              Already have an account?{" "}
              <button type="button" className="btn-link" onClick={() => { setShowSignup(false); setSignupMessage(""); }}>Sign in</button>
            </p>
          </form>
        ) : (
          <form className="login-card" onSubmit={handleLogin} id="login-form">
            <div className="login-brand">
              <span className="brand-icon">⬡</span>
              <h1>TollFlow</h1>
            </div>
            <p className="login-sub">Sign in to your account</p>
            {signupMessage && <Alert type="success" style={{ marginBottom: 16 }}>{signupMessage}</Alert>}
            <div className="form-group">
              <label htmlFor="login-username">Username</label>
              <input id="login-username" type="text" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input id="login-password" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {loginError && <Alert type="error">⚠️ {loginError}</Alert>}
            <button id="login-btn" type="submit" className="btn-primary" disabled={loginLoading}>
              {loginLoading ? <><span className="btn-spinner" /> Signing in…</> : "Sign In"}
            </button>
            <p className="login-toggle">
              Don&apos;t have an account?{" "}
              <button type="button" className="btn-link" onClick={() => { setShowSignup(true); setLoginError(""); }}>Sign up</button>
            </p>
          </form>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────
  // OPERATOR BANNER (Only for admin1 / ADMIN)
  // ─────────────────────────────────────────
  const portalHeader = isOperatorAdmin ? (
    <div className="operator-banner-bar">
      <div className="operator-banner-content">
        <div className="operator-banner-left">
          <span className="operator-badge">HIGHWAY ADMIN</span>
          <span className="operator-title">Toll Plaza Operations &amp; Fleet Management</span>
        </div>

        <div className="operator-toggle-group" role="tablist" aria-label="Portal Mode Switcher">
          <button
            type="button"
            id="portal-switch-admin"
            role="tab"
            aria-selected={activePortal === "ADMIN"}
            className={`operator-tab ${activePortal === "ADMIN" ? "active" : ""}`}
            onClick={() => {
              setActivePortal("ADMIN");
              localStorage.setItem("tollflow_portal", "ADMIN");
              setAdminSection("TollBooth");
              loadAdminPlazas();
              loadAdminVehicles();
              loadAdminRules();
              loadAdminTxns();
            }}
          >
            🚧 Toll Booth Terminal &amp; Admin
          </button>

          <button
            type="button"
            id="portal-switch-user"
            role="tab"
            aria-selected={activePortal === "USER"}
            className={`operator-tab ${activePortal === "USER" ? "active" : ""}`}
            onClick={() => {
              setActivePortal("USER");
              localStorage.setItem("tollflow_portal", "USER");
              refreshUserData(token);
            }}
          >
            🚗 Preview Driver Dashboard
          </button>
        </div>

        <div className="operator-banner-right">
          <span className="operator-user">
            Operator: <strong>{loggedInUser}</strong>
          </span>
          <button
            type="button"
            className="btn-signout-subtle"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ─────────────────────────────────────────
  // ADMIN DASHBOARD & TOLL BOOTH (Only for admin1 / ADMIN)
  // ─────────────────────────────────────────
  if (isOperatorAdmin && activePortal === "ADMIN") {
    const adminNavItems = [
      { id: "Dashboard", label: "Dashboard", icon: "📊" },
      { id: "TollBooth", label: "Toll Booth (Collect)", icon: "🚧" },
      { id: "Users", label: "User Management", icon: "👥" },
      { id: "Vehicles", label: "Vehicle Management", icon: "🚘" },
      { id: "Plazas", label: "Toll Plaza Management", icon: "🏛️" },
      { id: "Rules", label: "Toll Rule Management", icon: "⚖️" },
      { id: "Transactions", label: "Transaction Monitoring", icon: "💳" },
      { id: "Reports", label: "Reports", icon: "📈" },
      { id: "Profile", label: "Profile", icon: "👤" },
    ];

    const activeBoothPlaza = adminPlazas.find((p) => String(p.id) === String(boothPlazaId)) || adminPlazas.find((p) => p.is_active);
    const matchingBoothRule = boothSelectedVehicle && activeBoothPlaza
      ? adminRules.find(
          (r) =>
            Number(r.toll_plaza) === Number(activeBoothPlaza.id) &&
            String(r.vehicle_type).toUpperCase() === String(boothSelectedVehicle.vehicle_type).toUpperCase() &&
            r.is_active
        )
      : null;
    const applicableBoothFee = matchingBoothRule ? matchingBoothRule.amount : null;

    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {portalHeader}
        <div className="admin-layout" style={{ flex: 1 }}>
        {/* Mobile Sidebar Backdrop */}
        {adminSidebarOpen && (
          <div
            className="admin-sidebar-backdrop"
            onClick={() => setAdminSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`admin-sidebar ${adminSidebarOpen ? "open" : ""}`} id="admin-sidebar">
          <div className="admin-sidebar-header">
            <div className="navbar-brand" style={{ padding: 0 }}>
              <span className="brand-icon" style={{ fontSize: "20px", color: "var(--accent-3)" }}>⬡</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.5px" }}>TollFlow</span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin Console</span>
              </div>
            </div>
            <button
              type="button"
              className="admin-toggle-btn"
              style={{ display: adminSidebarOpen ? "inline-flex" : "none" }}
              onClick={() => setAdminSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          <nav className="admin-sidebar-nav" aria-label="Administrator navigation">
            {adminNavItems.map((item) => {
              const isActive = adminSection === item.id || (item.id === "Dashboard" && adminSection === "Overview");
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id.toLowerCase()}`}
                  type="button"
                  className={`admin-nav-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setAdminSection(item.id);
                    setAdminSidebarOpen(false);
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer">
            <button
              id="admin-logout-sidebar-btn"
              type="button"
              className="admin-sidebar-logout"
              onClick={handleLogout}
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="admin-main">
          {/* Top Bar Header */}
          <header className="admin-top-bar">
            <div className="admin-top-left">
              <button
                type="button"
                id="sidebar-toggle-btn"
                className="admin-toggle-btn"
                onClick={() => setAdminSidebarOpen(!adminSidebarOpen)}
                aria-label="Toggle navigation menu"
              >
                ☰
              </button>
              <div className="admin-top-title">
                <h2>
                  {adminSection === "Dashboard" || adminSection === "Overview" ? "Administrator Dashboard" : (adminNavItems.find(n => n.id === adminSection)?.label || adminSection)}
                </h2>
                <p>
                  {adminSection === "Dashboard" || adminSection === "Overview"
                    ? "Real-time fleet overview, revenue collections, plaza activity & transaction metrics"
                    : `Managing ${adminSection.toLowerCase()} across TollFlow system`}
                </p>
              </div>
            </div>

            <div className="admin-top-right">
              <div className="admin-profile-pill" id="admin-profile-display">
                <span>🛡️</span>
                <span>{loggedInUser || "Administrator"}</span>
                <span className="admin-role-badge">ADMIN</span>
              </div>
              <button id="admin-logout-btn" className="btn-logout" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </header>

          <div className="admin-dashboard-container">
            {/* ── DASHBOARD (LEVEL 2) ── */}
            {(adminSection === "Dashboard" || adminSection === "Overview") && (
              <>
                {/* Dashboard Toolbar: Date Range Filter & Refresh */}
                <div className="admin-toolbar-row">
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-soft)" }}>
                      Analytics Period:
                    </span>
                    <div className="range-toggle" role="group" aria-label="Transaction date range">
                      <button
                        type="button"
                        id="range-7d-btn"
                        className={`range-btn ${adminRange === "7d" ? "active" : ""}`}
                        onClick={() => {
                          setAdminRange("7d");
                          loadAdminStats("7d");
                        }}
                      >
                        Last 7 Days
                      </button>
                      <button
                        type="button"
                        id="range-30d-btn"
                        className={`range-btn ${adminRange === "30d" ? "active" : ""}`}
                        onClick={() => {
                          setAdminRange("30d");
                          loadAdminStats("30d");
                        }}
                      >
                        Last 30 Days
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                      id="refresh-admin-stats-btn"
                      className="btn-sm btn-outline"
                      onClick={() => loadAdminStats(adminRange)}
                      disabled={adminStatsLoading}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <span style={{ display: "inline-block", transform: adminStatsLoading ? "rotate(180deg)" : "none", transition: "transform 0.4s ease" }}>↻</span>
                      {adminStatsLoading ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>
                </div>

                {adminStatsLoading && !adminStats && <Spinner text="Loading dashboard analytics…" />}

                {adminStats && (
                  <>
                    {/* SECTION 3: 6 Dashboard Summary Cards */}
                    <div className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                      {/* 1. Total Registered Users */}
                      <div className="summary-card" id="metric-total-users">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <p style={{ margin: 0 }}>Total Registered Users</p>
                          <span style={{ fontSize: "20px" }}>👥</span>
                        </div>
                        <h2>{adminStats.total_users ?? 0}</h2>
                        <p className="stat-sub">Registered system accounts</p>
                      </div>

                      {/* 2. Total Registered Vehicles */}
                      <div className="summary-card" id="metric-total-vehicles">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <p style={{ margin: 0 }}>Total Registered Vehicles</p>
                          <span style={{ fontSize: "20px" }}>🚘</span>
                        </div>
                        <h2>{adminStats.total_vehicles ?? 0}</h2>
                        <p className="stat-sub">{adminStats.active_vehicles ?? 0} active / authorized</p>
                      </div>

                      {/* 3. Active Toll Plazas */}
                      <div className="summary-card" id="metric-active-plazas">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <p style={{ margin: 0 }}>Active Toll Plazas</p>
                          <span style={{ fontSize: "20px" }}>🏛️</span>
                        </div>
                        <h2>{adminStats.active_plazas ?? 0}</h2>
                        <p className="stat-sub">{adminStats.total_plazas ?? 0} total plazas configured</p>
                      </div>

                      {/* 4. Successful Toll Transactions */}
                      <div className="summary-card summary-card--success" id="metric-success-txns">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <p style={{ margin: 0 }}>Successful Transactions</p>
                          <span style={{ fontSize: "20px" }}>✅</span>
                        </div>
                        <h2>{adminStats.successful_transactions ?? 0}</h2>
                        <p className="stat-sub" style={{ color: "var(--success)" }}>Paid &amp; passed toll gates</p>
                      </div>

                      {/* 5. Total Revenue Collected */}
                      <div className="summary-card" id="metric-total-revenue" style={{ borderLeft: "3px solid var(--accent-3)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <p style={{ margin: 0 }}>Total Revenue Collected</p>
                          <span style={{ fontSize: "20px", color: "var(--accent-3)" }}>₹</span>
                        </div>
                        <h2 style={{ color: "var(--accent-3)" }}>
                          ₹{Number(adminStats.total_revenue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h2>
                        <p className="stat-sub">From successful transactions only</p>
                      </div>

                      {/* 6. Failed Toll Transactions */}
                      <div className="summary-card summary-card--danger" id="metric-failed-txns">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <p style={{ margin: 0 }}>Failed Transactions</p>
                          <span style={{ fontSize: "20px" }}>⚠️</span>
                        </div>
                        <h2>{adminStats.failed_transactions ?? 0}</h2>
                        <p className="stat-sub" style={{ color: "var(--danger)" }}>Insufficient funds / invalid tags</p>
                      </div>
                    </div>

                    {/* SECTION 4 & 5: Transaction Analytics & Status Summary */}
                    <div className="admin-analytics-grid">
                      {/* Left: Transaction Analytics Chart */}
                      <div className="analytics-card" id="analytics-chart-card">
                        <div className="analytics-card-header">
                          <div>
                            <div className="analytics-card-title">Transaction Volume Overview</div>
                            <div className="analytics-card-sub">
                              Daily successful vs. failed toll transactions over the last {adminStats.range_days || 7} days
                            </div>
                          </div>
                          <div className="chart-legend">
                            <span className="legend-item">
                              <span className="legend-dot" style={{ background: "#14b8a6" }} />
                              <span>Successful</span>
                            </span>
                            <span className="legend-item">
                              <span className="legend-dot" style={{ background: "#ef4444" }} />
                              <span>Failed</span>
                            </span>
                          </div>
                        </div>

                        <AdminAnalyticsChart
                          data={adminStats.chart_data || []}
                          range={adminStats.range || "7d"}
                          onHoverDay={setChartHover}
                          hoveredDay={chartHover}
                        />
                      </div>

                      {/* Right: Transaction Status Summary */}
                      <div className="analytics-card" id="status-summary-card">
                        <div className="analytics-card-header">
                          <div>
                            <div className="analytics-card-title">Period Status Summary</div>
                            <div className="analytics-card-sub">
                              Activity breakdown for selected {adminStats.range === "30d" ? "30-day" : "7-day"} window
                            </div>
                          </div>
                        </div>

                        <div className="status-metric-list">
                          <div className="status-metric-item">
                            <span className="status-metric-label">Total Transactions</span>
                            <span className="status-metric-val">{adminStats.range_total ?? 0}</span>
                          </div>

                          <div className="status-metric-item">
                            <span className="status-metric-label" style={{ color: "var(--success)" }}>✓ Successful Passes</span>
                            <span className="status-metric-val" style={{ color: "var(--success)" }}>
                              {adminStats.range_successful ?? 0}
                            </span>
                          </div>

                          <div className="status-metric-item">
                            <span className="status-metric-label" style={{ color: "var(--danger)" }}>✕ Failed Attempts</span>
                            <span className="status-metric-val" style={{ color: "var(--danger)" }}>
                              {adminStats.range_failed ?? 0}
                            </span>
                          </div>

                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-soft)", marginBottom: "4px" }}>
                              <span>Pass Success Rate</span>
                              <strong style={{ color: "var(--text)" }}>
                                {adminStats.range_total > 0
                                  ? ((adminStats.range_successful / adminStats.range_total) * 100).toFixed(1)
                                  : "0.0"}%
                              </strong>
                            </div>
                            <div className="progress-bar-container" title="Proportion of successful vs failed transactions">
                              <div
                                className="progress-bar-fill"
                                style={{
                                  width: `${adminStats.range_total > 0 ? (adminStats.range_successful / adminStats.range_total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ background: "rgba(6, 182, 212, 0.08)", border: "1px solid rgba(6, 182, 212, 0.2)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginTop: "4px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent-3)" }}>
                              Period Revenue Collected
                            </div>
                            <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff", marginTop: "4px" }}>
                              ₹{Number(adminStats.range_revenue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                              Monetary sum from successful transactions only
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 7: Toll Plaza Activity Summary */}
                    <div className="analytics-card" id="plaza-activity-card">
                      <div className="analytics-card-header">
                        <div>
                          <div className="analytics-card-title">Toll Plaza Activity Summary</div>
                          <div className="analytics-card-sub">
                            Operational status, traffic counts, and revenue collected per toll plaza in the last {adminStats.range_days || 7} days
                          </div>
                        </div>
                      </div>

                      {(!adminStats.plaza_activity || adminStats.plaza_activity.length === 0) ? (
                        <div className="empty-state" style={{ padding: "30px 16px" }}>
                          <span className="empty-icon">🏛️</span>
                          <p>No toll plazas configured in the system.</p>
                        </div>
                      ) : (
                        <div className="admin-table-wrap" style={{ margin: 0 }}>
                          <table className="admin-table" id="toll-plaza-summary-table">
                            <thead>
                              <tr>
                                <th>Plaza Name</th>
                                <th>Location</th>
                                <th>Operational Status</th>
                                <th>Period Transactions</th>
                                <th style={{ textAlign: "right" }}>Successful Collection</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminStats.plaza_activity.map((p) => (
                                <tr key={p.id}>
                                  <td><strong>{p.name}</strong></td>
                                  <td>{p.location}</td>
                                  <td>
                                    <Badge active={p.is_active} />
                                  </td>
                                  <td>
                                    <span style={{ fontWeight: 600 }}>{p.transaction_count}</span>
                                  </td>
                                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>
                                    ₹{Number(p.successful_revenue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* SECTION 6: Recent Transactions Table */}
                    <div className="analytics-card" id="recent-transactions-card">
                      <div className="analytics-card-header">
                        <div>
                          <div className="analytics-card-title">Recent Transactions</div>
                          <div className="analytics-card-sub">
                            Latest toll transactions processed through system toll plazas
                          </div>
                        </div>
                        <button
                          type="button"
                          id="view-all-txns-btn"
                          className="btn-sm btn-outline"
                          onClick={() => setAdminSection("Transactions")}
                        >
                          View All Transactions →
                        </button>
                      </div>

                      {(!adminStats.recent_transactions || adminStats.recent_transactions.length === 0) ? (
                        <div className="empty-state" style={{ padding: "30px 16px" }}>
                          <span className="empty-icon">📊</span>
                          <p>No recent transactions recorded.</p>
                        </div>
                      ) : (
                        <div className="admin-table-wrap" style={{ margin: 0 }}>
                          <table className="admin-table" id="recent-transactions-table">
                            <thead>
                              <tr>
                                <th>Transaction ID</th>
                                <th>Vehicle Registration</th>
                                <th>Vehicle Owner</th>
                                <th>Toll Plaza</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th style={{ textAlign: "right" }}>Date &amp; Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminStats.recent_transactions.map((t) => (
                                <tr key={t.id}>
                                  <td><code>#{t.id}</code></td>
                                  <td style={{ fontWeight: 600 }}>{t.vehicle_registration}</td>
                                  <td>{t.owner_username || "—"}</td>
                                  <td>{t.toll_plaza_name}</td>
                                  <td style={{ fontWeight: 700 }}>
                                    ₹{Number(t.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td>
                                    <Badge active={t.status === "SUCCESS"} />
                                  </td>
                                  <td style={{ textAlign: "right", fontSize: "12px", color: "var(--text-soft)" }}>
                                    {new Date(t.transaction_time).toLocaleString("en-IN")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

          {/* ── TOLL BOOTH (COLLECT) — STAFF OPERATOR TERMINAL ── */}
          {adminSection === "TollBooth" && (
            <section className="vehicles-section" id="admin-toll-booth-section">
              <div className="section-header" style={{ marginBottom: "20px", flexWrap: "wrap", gap: "12px", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "28px" }}>🚧</span>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "20px" }}>Toll Plaza Collection & Barrier Terminal</h2>
                      <p style={{ margin: "2px 0 0", color: "var(--text-soft)", fontSize: "13px" }}>
                        Staff operator terminal for automated vehicle optical scanning, RFID transceiver detection, and instant toll fee deduction.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="lane-status-badge">
                    <span className="pulsing-green-dot" /> LANE 01 — RFID TRANSCEIVER ONLINE
                  </span>
                  <div className="booth-operator-pill">
                    <span>👮 Staff:</span>
                    <strong>{loggedInUser || "Operator"}</strong>
                  </div>
                </div>
              </div>

              {/* Booth Plaza Selector Toolbar */}
              <div className="booth-toolbar">
                <div className="booth-plaza-select-wrap">
                  <label htmlFor="booth-plaza-select" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-soft)" }}>
                    OPERATING TOLL PLAZA:
                  </label>
                  <select
                    id="booth-plaza-select"
                    className="input-field"
                    style={{ minWidth: "260px", padding: "8px 12px", background: "var(--surface)", fontWeight: 600 }}
                    value={boothPlazaId || (adminPlazas.find((p) => p.is_active)?.id || "")}
                    onChange={(e) => {
                      setBoothPlazaId(e.target.value);
                      setBoothResult(null);
                      setBoothError("");
                    }}
                  >
                    {adminPlazas.filter((p) => p.is_active).map((p) => (
                      <option key={p.id} value={p.id}>
                        🏛️ {p.name} ({p.location})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn-sm btn-outline"
                    onClick={() => {
                      loadAdminVehicles();
                      loadAdminRules();
                      loadAdminTxns();
                    }}
                    title="Refresh Live Data"
                  >
                    🔄 Refresh Feed
                  </button>
                </div>
              </div>

              {boothError && (
                <div style={{ marginBottom: "16px" }}>
                  <Alert type="error">{boothError}</Alert>
                </div>
              )}

              {/* Highway Barrier Gate Simulation Stage */}
              <div className="barrier-visual-stage" aria-label="Highway Lane Barrier Simulation">
                <div className="overhead-led-display">
                  <div className={`led-matrix-text ${boothResult && boothResult.success ? "led-green" : boothResult && !boothResult.success ? "led-red" : "led-amber"}`}>
                    {boothProcessing
                      ? "● [ LANE 01: PROCESSING RFID TRANSCEIVER — PLEASE WAIT ]"
                      : boothResult
                      ? boothResult.success
                        ? `● [ TOLL DEBITED ₹${Number(boothResult.amount).toFixed(2)} — BARRIER OPEN — SAFE JOURNEY ]`
                        : "● [ 🛑 PASSAGE DENIED — INSUFFICIENT DRIVER BALANCE ]"
                      : boothSelectedVehicle
                      ? `● [ VEHICLE DETECTED: ${boothSelectedVehicle.registration_number} · TOLL FEE: ₹${applicableBoothFee ? Number(applicableBoothFee).toFixed(2) : "80.00"} ]`
                      : "● [ LANE 01: SENSOR ACTIVE — WAITING FOR VEHICLE ARRIVAL ]"}
                  </div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8" }}>
                    NH-44 · LANE 01 · FASTAG
                  </div>
                </div>

                <div className="barrier-physical-track">
                  <div className="barrier-kiosk">
                    <div className="kiosk-window" />
                    <span style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8" }}>BOOTH</span>
                  </div>

                  <div className="barrier-pivot-unit">
                    <div
                      className={`barrier-arm-lever ${boothResult && boothResult.success ? "raised" : "closed"}`}
                      title={boothResult && boothResult.success ? "Barrier Raised" : "Barrier Closed"}
                    />
                  </div>

                  <div className="lane-stop-line" title="Vehicle Stop Line" />

                  <div className="traffic-light-post">
                    <div className={`signal-bulb red ${!boothResult || !boothResult.success ? "active" : ""}`} />
                    <div className={`signal-bulb green ${boothResult && boothResult.success ? "active" : ""}`} />
                  </div>
                </div>
              </div>

              {/* 2-Column Terminal Grid: Left: Incoming Queue, Right: Optical Barrier & Deduction */}
              <div className="booth-terminal-grid">
                {/* Left: Incoming Queue */}
                <div className="booth-queue-col">
                  <div className="booth-card-header">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700, fontSize: "14px", letterSpacing: "0.03em" }}>
                        🚘 INCOMING VEHICLES QUEUE
                      </span>
                      <span className="badge-count">{adminVehicles.filter(v => v.is_active).length} Active Vehicles</span>
                    </div>
                    <div style={{ marginTop: "10px" }}>
                      <input
                        type="text"
                        className="admin-search"
                        placeholder="Search plate, RFID, or owner..."
                        value={boothSearch}
                        onChange={(e) => setBoothSearch(e.target.value)}
                        style={{ width: "100%", fontSize: "12px", padding: "8px 12px" }}
                      />
                    </div>
                  </div>

                  <div className="booth-vehicle-list">
                    {adminVehiclesLoading ? (
                      <Spinner text="Detecting vehicles..." />
                    ) : (
                      adminVehicles
                        .filter((v) => {
                          if (!boothSearch) return true;
                          const q = boothSearch.toLowerCase();
                          return (
                            v.registration_number?.toLowerCase().includes(q) ||
                            v.rfid_tag?.toLowerCase().includes(q) ||
                            v.owner_username?.toLowerCase().includes(q) ||
                            v.vehicle_type?.toLowerCase().includes(q)
                          );
                        })
                        .map((v) => {
                          const isSelected = boothSelectedVehicle && boothSelectedVehicle.id === v.id;
                          return (
                            <div
                              key={v.id}
                              className={`booth-vehicle-item ${isSelected ? "selected" : ""}`}
                              onClick={() => {
                                setBoothSelectedVehicle(v);
                                setBoothResult(null);
                                setBoothError("");
                              }}
                            >
                              <div className="booth-plate-preview">
                                {v.registration_number}
                              </div>
                              <div className="booth-veh-meta">
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span className="tag-pill">{v.vehicle_type}</span>
                                  <span style={{ fontSize: "12px", color: "var(--text-soft)" }}>👤 {v.owner_username}</span>
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                                  RFID: <code>{v.rfid_tag}</code>
                                </div>
                              </div>
                              <div className="booth-veh-balance">
                                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Owner Balance</span>
                                <strong style={{ color: Number(v.owner_wallet_balance || 0) > 0 ? "var(--success)" : "var(--danger)" }}>
                                  ₹{Number(v.owner_wallet_balance || 0).toFixed(2)}
                                </strong>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Right: Optical Barrier & Deduction Action */}
                <div className="booth-action-col">
                  {!boothSelectedVehicle ? (
                    <div className="booth-empty-selection">
                      <span style={{ fontSize: "48px" }}>📡</span>
                      <p style={{ fontWeight: 700, fontSize: "16px", marginTop: "12px" }}>Waiting for Vehicle at Lane 01 Barrier</p>
                      <p style={{ fontSize: "13px", color: "var(--text-soft)", maxWidth: "340px", margin: "4px auto 0" }}>
                        Click any arriving vehicle from the queue on the left to simulate automated RFID detection at the toll plaza booth.
                      </p>
                    </div>
                  ) : (
                    <div className="booth-scanner-panel">
                      <div className="scanner-top-bar">
                        <span className="scanner-indicator">● RFID TRANSCEIVER DETECTED</span>
                        <span style={{ fontSize: "12px", color: "var(--text-soft)" }}>Transceiver ID: TR-LANE01</span>
                      </div>

                      {/* License Plate Display */}
                      <div className="booth-large-plate">
                        <div className="plate-ind">IND</div>
                        <div className="plate-num">{boothSelectedVehicle.registration_number}</div>
                      </div>

                      <div className="booth-detection-meta-grid">
                        <div className="booth-meta-cell">
                          <span className="meta-label">Vehicle Type</span>
                          <span className="meta-val">{boothSelectedVehicle.vehicle_type}</span>
                        </div>
                        <div className="booth-meta-cell">
                          <span className="meta-label">Registered Owner</span>
                          <span className="meta-val">👤 {boothSelectedVehicle.owner_username}</span>
                        </div>
                        <div className="booth-meta-cell">
                          <span className="meta-label">Driver Wallet Balance</span>
                          <span className="meta-val" style={{ color: "var(--accent-3)", fontWeight: 700 }}>
                            ₹{Number(boothSelectedVehicle.owner_wallet_balance || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="booth-meta-cell">
                          <span className="meta-label">Applicable Toll Fee</span>
                          <span className="meta-val" style={{ color: "var(--success)", fontWeight: 800, fontSize: "16px" }}>
                            ₹{applicableBoothFee ? Number(applicableBoothFee).toFixed(2) : "80.00"}
                          </span>
                        </div>
                      </div>

                      {/* Balance Check Pill */}
                      {Number(boothSelectedVehicle.owner_wallet_balance || 0) < Number(applicableBoothFee || 80) ? (
                        <div className="balance-warning-banner">
                          ⚠️ Warning: Driver wallet balance (₹{Number(boothSelectedVehicle.owner_wallet_balance || 0).toFixed(2)}) is less than toll fee (₹{applicableBoothFee || "80.00"}). Barrier will refuse passage.
                        </div>
                      ) : (
                        <div className="balance-ok-banner">
                          ✓ Driver wallet verified. Sufficient balance available for automated collection.
                        </div>
                      )}

                      {/* Staff Action Button */}
                      <button
                        type="button"
                        id="btn-admin-deduct-toll"
                        className="btn-admin-collect-toll"
                        disabled={boothProcessing || !boothSelectedVehicle.is_active}
                        onClick={handleAdminDeductToll}
                      >
                        {boothProcessing ? (
                          <span>Processing RFID & Deducting Toll...</span>
                        ) : (
                          <span>🚨 DEDUCT TOLL & OPEN BARRIER (₹{applicableBoothFee ? Number(applicableBoothFee).toFixed(2) : "80.00"})</span>
                        )}
                      </button>

                      {/* Barrier Result */}
                      {boothResult && (
                        <div className={`booth-gate-state ${boothResult.success ? "gate-passed" : "gate-blocked"}`}>
                          <div className="gate-header">
                            <span className="gate-status-icon">{boothResult.success ? "🟢" : "🔴"}</span>
                            <div>
                              <h4 style={{ margin: 0, fontSize: "16px" }}>
                                {boothResult.success ? "BARRIER RAISED — VEHICLE PASSED" : "BARRIER DOWN — PASSAGE REFUSED"}
                              </h4>
                              <p style={{ margin: "2px 0 0", fontSize: "12px", opacity: 0.9 }}>
                                Gate State: <strong>{boothResult.state}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="gate-body">
                            <p style={{ margin: "0 0 10px", fontSize: "13px" }}>{boothResult.message}</p>
                            {boothResult.amount && (
                              <div className="gate-receipt-strip">
                                <div><strong>Amount Deducted:</strong> ₹{Number(boothResult.amount).toFixed(2)}</div>
                                <div><strong>Transaction ID:</strong> #{boothResult.transaction_id || boothResult.transaction?.id}</div>
                                <div><strong>Plaza:</strong> {activeBoothPlaza?.name}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Live Toll Booth Audit Feed */}
              <div style={{ marginTop: "28px" }}>
                <div className="section-header" style={{ marginBottom: "12px", justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px" }}>📡 Live Toll Booth Passage Feed</h3>
                    <p style={{ margin: "2px 0 0", color: "var(--text-soft)", fontSize: "12px" }}>
                      Real-time stream of all recent automated toll collections and gate events across this plaza.
                    </p>
                  </div>
                </div>

                {adminTxnsLoading && <Spinner text="Loading passage feed..." />}
                {!adminTxnsLoading && (!adminTxns || (adminTxns.results || adminTxns).length === 0) && (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No transactions processed yet.</p>
                )}
                {!adminTxnsLoading && adminTxns && (adminTxns.results || adminTxns).length > 0 && (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Time</th>
                          <th>Vehicle</th>
                          <th>Owner</th>
                          <th>Plaza</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Barrier State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(adminTxns.results || adminTxns).slice(0, 8).map((tx) => (
                          <tr key={tx.id}>
                            <td>#{tx.id}</td>
                            <td>{new Date(tx.created_at || tx.transaction_time).toLocaleTimeString()}</td>
                            <td><strong>{tx.vehicle_registration}</strong></td>
                            <td>{tx.owner_username || "—"}</td>
                            <td>{tx.toll_plaza_name}</td>
                            <td style={{ fontWeight: 700 }}>₹{Number(tx.amount).toFixed(2)}</td>
                            <td>
                              <span className={`status-badge ${tx.status === "SUCCESS" ? "badge--active" : "badge--inactive"}`}>
                                {tx.status}
                              </span>
                            </td>
                            <td><code>{tx.state || (tx.status === "SUCCESS" ? "PASSED" : "BLOCKED")}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── USERS ── */}
          {adminSection === "Users" && (
            <section className="vehicles-section">
              <div className="section-header">
                <h2>User Management</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="admin-search" placeholder="Search username / email…" value={adminUserSearch}
                    onChange={(e) => setAdminUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadAdminUsers(adminUserSearch)} />
                  <button className="btn-primary" style={{ padding: "8px 14px", fontSize: "13px" }}
                    onClick={() => loadAdminUsers(adminUserSearch)}>Search</button>
                </div>
              </div>
              {adminUsersLoading && <Spinner />}
              {!adminUsersLoading && adminUsers.length === 0 && <div className="empty-state"><span className="empty-icon">👤</span><p>No users found.</p></div>}
              {adminUsers.length > 0 && (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>ID</th><th>Username</th><th>Email</th><th>Role</th><th>Vehicles</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {adminUsers.map((u) => (
                        <tr key={u.id}>
                          <td>{u.id}</td>
                          <td>{u.username}</td>
                          <td>{u.email || "—"}</td>
                          <td><span className={`role-badge role-${u.role?.toLowerCase()}`}>{u.role}</span></td>
                          <td>{u.vehicle_count}</td>
                          <td><Badge active={u.is_active} /></td>
                          <td>
                            <button className={u.is_active ? "btn-sm btn-danger" : "btn-sm btn-success"}
                              onClick={async () => {
                                try {
                                  await updateAdminUser(u.id, { is_active: !u.is_active }, token);
                                  loadAdminUsers(adminUserSearch);
                                } catch (e) { alert(e.message); }
                              }}>
                              {u.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ── ADMIN VEHICLES ── */}
          {adminSection === "Vehicles" && (
            <section className="vehicles-section">
              <div className="section-header">
                <h2>Vehicle Management</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="admin-search" placeholder="Search reg / RFID / owner…" value={adminVehicleSearch}
                    onChange={(e) => setAdminVehicleSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadAdminVehicles(adminVehicleSearch)} />
                  <button className="btn-primary" style={{ padding: "8px 14px", fontSize: "13px" }}
                    onClick={() => loadAdminVehicles(adminVehicleSearch)}>Search</button>
                </div>
              </div>
              {adminVehiclesLoading && <Spinner />}
              {!adminVehiclesLoading && adminVehicles.length === 0 && <div className="empty-state"><span className="empty-icon">🚗</span><p>No vehicles found.</p></div>}
              {adminVehicles.length > 0 && (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>ID</th><th>Registration</th><th>RFID</th><th>Type</th><th>Owner</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {adminVehicles.map((v) => (
                        <tr key={v.id}>
                          <td>{v.id}</td>
                          <td>{v.registration_number}</td>
                          <td><code>{v.rfid_tag}</code></td>
                          <td>{v.vehicle_type}</td>
                          <td>{v.owner_username}</td>
                          <td><Badge active={v.is_active} /></td>
                          <td>
                            <button className={v.is_active ? "btn-sm btn-danger" : "btn-sm btn-success"}
                              onClick={async () => {
                                try {
                                  await updateAdminVehicle(v.id, { is_active: !v.is_active }, token);
                                  loadAdminVehicles(adminVehicleSearch);
                                } catch (e) { alert(e.message); }
                              }}>
                              {v.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ── PLAZAS ── */}
          {adminSection === "Plazas" && (
            <section className="vehicles-section">
              <div className="section-header">
                <h2>Toll Plaza Management</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="admin-search" placeholder="Search name / location…" value={adminPlazaSearch}
                    onChange={(e) => setAdminPlazaSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadAdminPlazas(adminPlazaSearch)} />
                  <button className="btn-primary" style={{ padding: "8px 14px", fontSize: "13px" }} onClick={() => loadAdminPlazas(adminPlazaSearch)}>Search</button>
                  <button className="btn-primary" style={{ padding: "8px 14px", fontSize: "13px" }}
                    onClick={() => { setShowPlazaForm(!showPlazaForm); setPlazaEditId(null); setPlazaFormData({ name: "", location: "", is_active: true }); setPlazaFormMsg(""); }}>
                    {showPlazaForm ? "Cancel" : "+ New Plaza"}
                  </button>
                </div>
              </div>

              {showPlazaForm && (
                <form className="login-card" style={{ maxWidth: "100%", marginBottom: 24 }}
                  onSubmit={async (e) => {
                    e.preventDefault(); setPlazaFormMsg("");
                    try {
                      if (plazaEditId) { await updateAdminPlaza(plazaEditId, plazaFormData, token); }
                      else { await createAdminPlaza(plazaFormData, token); }
                      setPlazaFormMsg(plazaEditId ? "Plaza updated!" : "Plaza created!");
                      setShowPlazaForm(false); setPlazaEditId(null);
                      loadAdminPlazas(adminPlazaSearch);
                    } catch (err) { setPlazaFormMsg(err.message); }
                  }}>
                  <h3 style={{ marginBottom: 16 }}>{plazaEditId ? "Edit Plaza" : "New Toll Plaza"}</h3>
                  <div className="form-group">
                    <label>Plaza Name</label>
                    <input type="text" value={plazaFormData.name} onChange={(e) => setPlazaFormData({ ...plazaFormData, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input type="text" value={plazaFormData.location} onChange={(e) => setPlazaFormData({ ...plazaFormData, location: e.target.value })} required />
                  </div>
                  <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <input type="checkbox" id="plaza-active" checked={plazaFormData.is_active}
                      onChange={(e) => setPlazaFormData({ ...plazaFormData, is_active: e.target.checked })} />
                    <label htmlFor="plaza-active">Active</label>
                  </div>
                  {plazaFormMsg && <Alert type={plazaFormMsg.includes("!") ? "success" : "error"}>{plazaFormMsg}</Alert>}
                  <button type="submit" className="btn-primary">{plazaEditId ? "Update" : "Create"}</button>
                </form>
              )}

              {adminPlazasLoading && <Spinner />}
              {!adminPlazasLoading && adminPlazas.length === 0 && <div className="empty-state"><span className="empty-icon">🏛</span><p>No plazas found.</p></div>}
              {adminPlazas.length > 0 && (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>ID</th><th>Name</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {adminPlazas.map((p) => (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td>{p.name}</td>
                          <td>{p.location}</td>
                          <td><Badge active={p.is_active} /></td>
                          <td style={{ display: "flex", gap: 6 }}>
                            <button className="btn-sm btn-outline"
                              onClick={() => {
                                setPlazaEditId(p.id);
                                setPlazaFormData({ name: p.name, location: p.location, is_active: p.is_active });
                                setShowPlazaForm(true); setPlazaFormMsg("");
                              }}>Edit</button>
                            <button className={p.is_active ? "btn-sm btn-danger" : "btn-sm btn-success"}
                              onClick={async () => {
                                if (!window.confirm(`${p.is_active ? "Deactivate" : "Activate"} "${p.name}"?`)) return;
                                try { await updateAdminPlaza(p.id, { is_active: !p.is_active }, token); loadAdminPlazas(adminPlazaSearch); }
                                catch (err) { alert(err.message); }
                              }}>
                              {p.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ── RULES ── */}
          {adminSection === "Rules" && (
            <section className="vehicles-section">
              <div className="section-header">
                <h2>Toll Rule Management</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" style={{ padding: "8px 14px", fontSize: "13px" }}
                    onClick={() => { setShowRuleForm(!showRuleForm); setRuleEditId(null); setRuleFormData({ toll_plaza: "", vehicle_type: "CAR", amount: "", is_active: true }); setRuleFormMsg(""); }}>
                    {showRuleForm ? "Cancel" : "+ New Rule"}
                  </button>
                </div>
              </div>

              {showRuleForm && (
                <form className="login-card" style={{ maxWidth: "100%", marginBottom: 24 }}
                  onSubmit={async (e) => {
                    e.preventDefault(); setRuleFormMsg("");
                    try {
                      if (ruleEditId) { await updateAdminRule(ruleEditId, ruleFormData, token); }
                      else { await createAdminRule(ruleFormData, token); }
                      setRuleFormMsg(ruleEditId ? "Rule updated!" : "Rule created!");
                      setShowRuleForm(false); setRuleEditId(null);
                      loadAdminRules();
                    } catch (err) { setRuleFormMsg(err.message); }
                  }}>
                  <h3 style={{ marginBottom: 16 }}>{ruleEditId ? "Edit Rule" : "New Toll Rule"}</h3>
                  <div className="form-group">
                    <label>Toll Plaza</label>
                    <select value={ruleFormData.toll_plaza} onChange={(e) => setRuleFormData({ ...ruleFormData, toll_plaza: e.target.value })} required>
                      <option value="">Select plaza</option>
                      {adminPlazas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Vehicle Type</label>
                    <select value={ruleFormData.vehicle_type} onChange={(e) => setRuleFormData({ ...ruleFormData, vehicle_type: e.target.value })}>
                      {["CAR", "BUS", "TRUCK", "MOTORCYCLE"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount (₹)</label>
                    <input type="number" min="0.01" step="0.01" value={ruleFormData.amount}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, amount: e.target.value })} required />
                  </div>
                  <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <input type="checkbox" id="rule-active" checked={ruleFormData.is_active}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, is_active: e.target.checked })} />
                    <label htmlFor="rule-active">Active</label>
                  </div>
                  {ruleFormMsg && <Alert type={ruleFormMsg.includes("!") ? "success" : "error"}>{ruleFormMsg}</Alert>}
                  <button type="submit" className="btn-primary">{ruleEditId ? "Update" : "Create"}</button>
                </form>
              )}

              {adminRulesLoading && <Spinner />}
              {!adminRulesLoading && adminRules.length === 0 && <div className="empty-state"><span className="empty-icon">📋</span><p>No rules defined.</p></div>}
              {adminRules.length > 0 && (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>ID</th><th>Plaza</th><th>Vehicle Type</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {adminRules.map((r) => (
                        <tr key={r.id}>
                          <td>{r.id}</td>
                          <td>{r.toll_plaza_name}</td>
                          <td>{r.vehicle_type}</td>
                          <td>₹{r.amount}</td>
                          <td><Badge active={r.is_active} /></td>
                          <td style={{ display: "flex", gap: 6 }}>
                            <button className="btn-sm btn-outline"
                              onClick={() => {
                                setRuleEditId(r.id);
                                setRuleFormData({ toll_plaza: r.toll_plaza, vehicle_type: r.vehicle_type, amount: r.amount, is_active: r.is_active });
                                setShowRuleForm(true); setRuleFormMsg("");
                              }}>Edit</button>
                            <button className="btn-sm btn-danger"
                              onClick={async () => {
                                if (!window.confirm(`Delete rule for ${r.vehicle_type} at ${r.toll_plaza_name}?`)) return;
                                try { await deleteAdminRule(r.id, token); loadAdminRules(); }
                                catch (err) { alert(err.message); }
                              }}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ── TRANSACTIONS MONITORING ── */}
          {adminSection === "Transactions" && (
            <section className="vehicles-section">
              <div className="section-header">
                <h2>Transaction Monitoring</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" style={{ padding: "8px 14px", fontSize: "13px" }}
                    onClick={() => handleExportCSV(adminTxnFilters)} disabled={exportLoading}>
                    {exportLoading ? "Exporting…" : "📥 Export Filtered (CSV)"}
                  </button>
                  <button className="btn-primary" style={{ padding: "8px 14px", fontSize: "13px" }}
                    onClick={() => loadAdminTxns(adminTxnFilters)} disabled={adminTxnsLoading}>
                    {adminTxnsLoading ? "Loading…" : "Apply Filters"}
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                <select className="admin-search" value={adminTxnFilters.status}
                  onChange={(e) => setAdminTxnFilters({ ...adminTxnFilters, status: e.target.value })}>
                  <option value="">All Statuses</option>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILED">Failed</option>
                </select>
                <input className="admin-search" placeholder="Search vehicle / plaza…" value={adminTxnFilters.search}
                  onChange={(e) => setAdminTxnFilters({ ...adminTxnFilters, search: e.target.value })} />
                <input className="admin-search" type="date" value={adminTxnFilters.date_from}
                  onChange={(e) => setAdminTxnFilters({ ...adminTxnFilters, date_from: e.target.value })} />
                <input className="admin-search" type="date" value={adminTxnFilters.date_to}
                  onChange={(e) => setAdminTxnFilters({ ...adminTxnFilters, date_to: e.target.value })} />
              </div>

              {adminTxnsLoading && <Spinner />}
              {adminTxns && (
                <>
                  <div className="summary-grid" style={{ marginBottom: 20 }}>
                    <StatCard label="Matching Records" value={adminTxns.count} />
                    <div className="summary-card summary-card--success">
                      <p>Successful Revenue</p>
                      <h2>₹{Number(adminTxns.successful_revenue).toFixed(2)}</h2>
                    </div>
                  </div>
                  {adminTxns.results.length === 0
                    ? <div className="empty-state"><span className="empty-icon">📊</span><p>No transactions match filters.</p></div>
                    : (
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead><tr><th>ID</th><th>Vehicle</th><th>User</th><th>Plaza</th><th>Amount</th><th>Status</th><th>State</th><th>Reason</th><th>Time</th></tr></thead>
                          <tbody>
                            {adminTxns.results.map((t) => (
                              <tr key={t.id}>
                                <td>#{t.id}</td>
                                <td>{t.vehicle_registration}</td>
                                <td>{t.owner_username}</td>
                                <td>{t.toll_plaza_name}</td>
                                <td>₹{t.amount}</td>
                                <td><Badge active={t.status === "SUCCESS"} /></td>
                                <td style={{ fontSize: "11px" }}>{t.state}</td>
                                <td style={{ fontSize: "11px", color: "var(--danger)" }}>{t.failure_reason || "—"}</td>
                                <td style={{ fontSize: "11px" }}>{new Date(t.transaction_time).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </>
              )}
            </section>
          )}

          {/* ── REPORTS & ANALYTICS ── */}
          {adminSection === "Reports" && (
            <section className="vehicles-section">
              <div className="section-header">
                <h2>System Reports &amp; Analytics</h2>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn-primary" style={{ padding: "8px 16px", fontSize: "13px" }}
                    onClick={() => handleExportCSV()} disabled={exportLoading}>
                    {exportLoading ? "Exporting…" : "📥 Export All Transactions (CSV)"}
                  </button>
                  <button className="btn-primary" style={{ padding: "8px 14px", fontSize: "13px" }}
                    onClick={loadAdminReports} disabled={adminReportsLoading}>
                    {adminReportsLoading ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>
              {adminReportsLoading && <Spinner />}
              {adminReports && (
                <>
                  <div className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 28 }}>
                    <div className="summary-card summary-card--success">
                      <p>Total Revenue (Success)</p>
                      <h2>₹{Number(adminReports.total_revenue).toFixed(2)}</h2>
                    </div>
                    <StatCard label="Total Transactions" value={adminReports.total_transactions} />
                    <StatCard label="Successful Tolls" value={adminReports.successful_transactions} />
                    <div className="summary-card summary-card--danger">
                      <p>Failed Tolls</p>
                      <h2>{adminReports.failed_transactions}</h2>
                    </div>
                    <div className="summary-card" style={{ borderLeft: "3px solid var(--accent-3)" }}>
                      <p>Success Rate</p>
                      <h2>{adminReports.success_rate_percent}%</h2>
                    </div>
                  </div>

                  {/* Breakdown by Plaza */}
                  <h3 style={{ marginBottom: 14, color: "var(--text-soft)", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Revenue &amp; Volume by Toll Plaza
                  </h3>
                  <div className="admin-table-wrap" style={{ marginBottom: 32 }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Plaza Name</th>
                          <th>Location</th>
                          <th>Status</th>
                          <th>Total Tolls</th>
                          <th>Successful</th>
                          <th>Failed</th>
                          <th>Collected Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminReports.by_plaza?.map((p) => (
                          <tr key={p.id}>
                            <td><strong>{p.name}</strong></td>
                            <td>{p.location}</td>
                            <td><Badge active={p.is_active} /></td>
                            <td>{p.total_transactions}</td>
                            <td><span style={{ color: "var(--success)" }}>{p.successful_transactions}</span></td>
                            <td><span style={{ color: "var(--danger)" }}>{p.failed_transactions}</span></td>
                            <td><strong>₹{Number(p.revenue).toFixed(2)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Breakdown by Vehicle Type */}
                  <h3 style={{ marginBottom: 14, color: "var(--text-soft)", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Breakdown by Vehicle Type
                  </h3>
                  <div className="admin-table-wrap" style={{ marginBottom: 32 }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Vehicle Type</th>
                          <th>Total Attempts</th>
                          <th>Successful</th>
                          <th>Failed</th>
                          <th>Revenue Generated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminReports.by_vehicle_type?.map((vt) => (
                          <tr key={vt.vehicle_type}>
                            <td><span className="role-badge role-owner">{vt.vehicle_type}</span></td>
                            <td>{vt.total_transactions}</td>
                            <td><span style={{ color: "var(--success)" }}>{vt.successful_transactions}</span></td>
                            <td><span style={{ color: "var(--danger)" }}>{vt.failed_transactions}</span></td>
                            <td><strong>₹{Number(vt.revenue).toFixed(2)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 7-Day Trend */}
                  <h3 style={{ marginBottom: 14, color: "var(--text-soft)", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Last 7 Days Activity
                  </h3>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Total Processed</th>
                          <th>Successful</th>
                          <th>Daily Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminReports.daily_trend?.map((d) => (
                          <tr key={d.date}>
                            <td><code>{d.date}</code></td>
                            <td>{d.total_transactions}</td>
                            <td><span style={{ color: "var(--success)" }}>{d.successful_transactions}</span></td>
                            <td><strong>₹{Number(d.revenue).toFixed(2)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── ADMIN PROFILE ── */}
          {adminSection === "Profile" && (
            <section className="admin-panel" id="admin-profile-panel">
              <ProfileView
                userProfileData={userProfileData}
                onProfileUpdated={(updated) => {
                  setUserProfileData(updated);
                  if (updated.email) setUserEmail(updated.email);
                }}
                token={token}
                role={role}
                loggedInUser={loggedInUser}
                onLogout={handleLogout}
                walletBalance={walletBalance}
                vehicles={vehicles}
                totalTollSpent={totalTollSpent}
              />
            </section>
          )}
          </div>
        </div>
      </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // OWNER DASHBOARD
  // ─────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {isOperatorAdmin && portalHeader}
      <div className="app" style={{ flex: 1 }}>
      {/* ── Navbar ── */}
      <header className="navbar">
        <div className="navbar-brand">
          <span className="brand-icon">⬡</span>
          <h1>TollFlow</h1>
        </div>
        <nav aria-label="User primary navigation">
          {[
            { id: "Dashboard", label: "Dashboard" },
            { id: "Vehicles", label: "My Vehicles" },
            { id: "Wallet", label: "My Wallet" },
            { id: "History", label: "Transaction History" },
            { id: "Profile", label: "Profile" },
          ].map((item) => (
            <a
              key={item.id}
              href={`#${item.id.toLowerCase()}`}
              id={`nav-user-${item.id.toLowerCase()}`}
              className={activeNav === item.id ? "nav-link active" : "nav-link"}
              onClick={(e) => {
                e.preventDefault();
                setActiveNav(item.id);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="navbar-right">
          <div
            className="nav-wallet-chip"
            onClick={() => setActiveNav("Wallet")}
            title="Fastag Wallet Balance"
            style={{ cursor: "pointer" }}
          >
            <span className="chip-label">WALLET</span>
            <span className="chip-val">₹{Number(walletBalance).toFixed(2)}</span>
          </div>
          <span className="navbar-user">👤 {loggedInUser || username || "User"}</span>
          {isOperatorAdmin && (
            <button
              type="button"
              className="btn-sm btn-primary"
              id="switch-back-booth-btn"
              onClick={() => {
                setActivePortal("ADMIN");
                setAdminSection("TollBooth");
              }}
              style={{ padding: "6px 12px", fontSize: "12px", gap: 4 }}
            >
              🚧 Toll Booth Station
            </button>
          )}
          <button id="logout-btn" className="btn-logout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <main className="dashboard">
        {/* ── Clean Professional Dashboard Header ── */}
        <div className="dashboard-header-bar">
          <div>
            <div className="dash-breadcrumb">TollFlow Cloud &bull; FASTag Auto-Debit System</div>
            <h1 className="dash-title">Driver &amp; Vehicle Dashboard</h1>
            <p className="dash-subtitle">
              Manage your registered vehicles, monitor your FASTag wallet balance, and track highway toll crossings.
            </p>
          </div>
          <div className="dash-actions">
            <button
              type="button"
              className="btn-primary"
              id="dash-quick-add-veh"
              onClick={() => { setActiveNav("Vehicles"); setShowVehicleForm(true); }}
            >
              + Register Vehicle
            </button>
            <button
              type="button"
              className="btn-outline"
              id="dash-quick-topup"
              onClick={() => setActiveNav("Wallet")}
            >
              Add Wallet Funds
            </button>
          </div>
        </div>

        {/* ── DASHBOARD VIEW ── */}
        {activeNav === "Dashboard" && (
          <>
            {/* ── Stat Cards ── */}
            <section className="cards" aria-label="User Key Metrics">
              <div className="card card--wallet" onClick={() => setActiveNav("Wallet")} style={{ cursor: "pointer" }} title="Go to My Wallet">
                <div className="card-icon">💳</div>
                <div className="card-info">
                  <h3>Wallet Balance</h3>
                  <p className="card-value">₹{Number(walletBalance).toFixed(2)}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600 }}>✓ Auto-debit active</span>
                    <button
                      type="button"
                      className="btn-primary"
                      id="dash-topup-btn"
                      style={{ padding: "3px 10px", fontSize: "11px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveNav("Wallet");
                      }}
                    >
                      + Top Up
                    </button>
                  </div>
                </div>
              </div>

              <div className="card card--vehicles" onClick={() => setActiveNav("Vehicles")} style={{ cursor: "pointer" }} title="View My Vehicles">
                <div className="card-icon">🚗</div>
                <div className="card-info">
                  <h3>Registered Vehicles</h3>
                  <p className="card-value">{loading ? "—" : vehicles.length}</p>
                  <p className="stat-sub" style={{ marginTop: 4, fontSize: 12, color: "var(--text-soft)" }}>
                    {activeVehicles} active transponder{activeVehicles === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="card card--transaction">
                <div className="card-icon">📊</div>
                <div className="card-info">
                  <h3>Total Tolls Paid</h3>
                  <p className="card-value">₹{totalTollSpent.toFixed(2)}</p>
                  <p className="stat-sub" style={{ marginTop: 4, fontSize: 12, color: "var(--text-soft)" }}>
                    Across {successfulTransactions.length} successful debits
                  </p>
                </div>
              </div>

              <div className="card card--active">
                <div className="card-icon">✅</div>
                <div className="card-info">
                  <h3>Passage Success Rate</h3>
                  <p className="card-value">
                    {transactions.length > 0
                      ? `${Math.round((successfulTransactions.length / transactions.length) * 100)}%`
                      : "100%"}
                  </p>
                  <p className="stat-sub" style={{ marginTop: 4, fontSize: 12, color: "var(--text-soft)" }}>
                    {failedTransactions.length === 0 ? "0 failed passages" : `${failedTransactions.length} failed attempts`}
                  </p>
                </div>
              </div>
            </section>

            {/* ── Visual Analytics & FASTag Recharging Station ── */}
            <section className="user-analytics-grid" aria-label="Toll Analytics and Quick Recharge">
              <div className="user-chart-card">
                <div className="user-chart-header">
                  <div>
                    <h3>7-Day FASTag Passage &amp; Debit Activity</h3>
                    <p>Daily breakdown of automated highway toll gate crossings and wallet debits</p>
                  </div>
                  <div className="user-chart-legend">
                    <div className="legend-item">
                      <span className="legend-dot legend-dot--success" />
                      <span>Cleared</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot legend-dot--failed" />
                      <span>Failed / Low Balance</span>
                    </div>
                  </div>
                </div>

                <UserActivityChart transactions={transactions} />
              </div>

              <div className="user-recharge-card">
                <div className="user-recharge-header">
                  <h3>⚡ Quick FASTag Recharge</h3>
                  <p>Instant virtual wallet top-up for uninterrupted highway transit.</p>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Current FASTag Balance
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff", marginTop: 2 }}>
                    ₹{Number(walletBalance).toFixed(2)}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600, marginTop: 4 }}>
                    ● FASTag Transponder Linked &amp; Ready
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "12px", color: "var(--text-soft)", fontWeight: 600 }}>1-Click Instant Add:</span>
                  <div className="recharge-quick-chips">
                    {[100, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className="btn-quick-chip"
                        disabled={topupLoading}
                        onClick={() => handleTopUp(amt)}
                        title={`Add ₹${amt} instantly`}
                      >
                        +₹{amt}
                      </button>
                    ))}
                  </div>
                  {topupMessage && (
                    <div style={{ fontSize: "12px", color: topupSuccess ? "var(--success)" : "var(--danger)", marginTop: 8 }}>
                      {topupMessage}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-sm btn-outline"
                  onClick={() => setActiveNav("Wallet")}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Custom Amount &amp; Ledger &rarr;
                </button>
              </div>
            </section>

            {/* ── Quick Actions ── */}
            <div className="user-quick-actions" aria-label="Quick operations">
              <div
                className="quick-action-card"
                id="action-register-vehicle"
                onClick={() => {
                  setActiveNav("Vehicles");
                  setShowVehicleForm(true);
                }}
              >
                <div className="quick-action-icon">🚘</div>
                <div className="quick-action-title">Register Vehicle</div>
                <div className="quick-action-desc">Add a new car, truck, or bus and configure RFID transponder tag.</div>
                <div className="quick-action-arrow">+ Add Vehicle &rarr;</div>
              </div>

              <div
                className="quick-action-card"
                id="action-topup-wallet"
                onClick={() => setActiveNav("Wallet")}
              >
                <div className="quick-action-icon">💳</div>
                <div className="quick-action-title">Top Up Wallet</div>
                <div className="quick-action-desc">Add virtual demo funds to pay simulated automated toll collections.</div>
                <div className="quick-action-arrow">Manage Wallet &rarr;</div>
              </div>

              <div
                className="quick-action-card"
                id="action-view-history"
                onClick={() => setActiveNav("History")}
              >
                <div className="quick-action-icon">📜</div>
                <div className="quick-action-title">Transaction History</div>
                <div className="quick-action-desc">Inspect all passage receipts, debits, barrier events, and audit logs.</div>
                <div className="quick-action-arrow">View All History &rarr;</div>
              </div>

              <div
                className="quick-action-card"
                id="action-view-network"
                onClick={() => setActiveNav("History")}
              >
                <div className="quick-action-icon">🏛️</div>
                <div className="quick-action-title">Highway Network</div>
                <div className="quick-action-desc">Monitor operational automated toll plazas across national expressways.</div>
                <div className="quick-action-arrow">{tollPlazas.length} Plazas Connected &rarr;</div>
              </div>
            </div>

            {/* ── Recent Transaction Activity ── */}
            <section className="vehicles-section" id="dash-recent-activity">
              <div className="section-header" style={{ marginBottom: "16px", justifyContent: "space-between" }}>
                <div>
                  <h2>Recent Toll Activity</h2>
                  <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
                    Your latest toll gate passages and automated wallet deductions.
                  </p>
                </div>
                {transactions.length > 0 && (
                  <button
                    type="button"
                    className="btn-sm btn-outline"
                    id="dash-view-all-txns-btn"
                    onClick={() => setActiveNav("History")}
                    style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    View All ({transactions.length}) Passages &rarr;
                  </button>
                )}
              </div>

              {transactions.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📊</span>
                  <p style={{ fontWeight: 600, fontSize: "15px" }}>No toll transactions recorded yet</p>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
                    Toll deductions processed automatically by highway toll booth operators will appear here in real time.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: 14, padding: "8px 18px", fontSize: "13px" }}
                    onClick={() => setActiveNav("Vehicles")}
                  >
                    🚘 Ensure Your Vehicles Are Registered
                  </button>
                </div>
              ) : (
                <div className="vehicle-table-wrapper">
                  <table className="vehicle-table" id="recent-transactions-table">
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Vehicle</th>
                        <th>Toll Plaza</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Gate State</th>
                        <th>Notes / Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 5).map((txn) => {
                        const isSuccess = txn.status === "SUCCESS";
                        return (
                          <tr key={txn.id || Math.random()}>
                            <td style={{ fontSize: "12px", color: "var(--text-soft)" }}>
                              {txn.created_at ? new Date(txn.created_at).toLocaleString() : "—"}
                            </td>
                            <td><span className="plate-badge-clean">{txn.vehicle_registration || "—"}</span></td>
                            <td>{txn.toll_plaza_name || "—"}</td>
                            <td style={{ fontWeight: 700, color: isSuccess ? "var(--text)" : "var(--text-muted)" }}>
                              ₹{Number(txn.amount || 0).toFixed(2)}
                            </td>
                            <td>
                              <span className={`status-badge ${isSuccess ? "badge--active" : "badge--inactive"}`}>
                                {txn.status}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: "11px", fontWeight: 600, color: isSuccess ? "var(--success)" : "var(--danger)" }}>
                                {txn.state || (isSuccess ? "PASSED" : "FAILED")}
                              </span>
                            </td>
                            <td style={{ fontSize: "12px", color: isSuccess ? "var(--text-soft)" : "var(--danger)" }}>
                              {txn.failure_reason || (isSuccess ? "Passage authorized" : "Failed")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── My Fleet Quick Overview ── */}
            <section className="vehicles-section" style={{ marginTop: "36px" }}>
              <div className="section-header" style={{ marginBottom: "16px", justifyContent: "space-between" }}>
                <div>
                  <h2>My Fleet Overview</h2>
                  <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
                    Quick status of your registered transponders.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-sm btn-outline"
                  id="dash-manage-fleet-btn"
                  onClick={() => setActiveNav("Vehicles")}
                  style={{ fontSize: "12px" }}
                >
                  Manage Fleet ({vehicles.length}) &rarr;
                </button>
              </div>

              {vehicles.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🚘</span>
                  <p style={{ fontWeight: 600 }}>No vehicles registered</p>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                    Register your vehicle to automate your toll crossings.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: 12, padding: "8px 18px", fontSize: "13px" }}
                    onClick={() => {
                      setActiveNav("Vehicles");
                      setShowVehicleForm(true);
                    }}
                  >
                    + Register First Vehicle
                  </button>
                </div>
              ) : (
                <div className="vehicle-grid">
                  {vehicles.slice(0, 3).map((v) => (
                    <article className="vehicle-card" key={v.id}>
                      <div className="vehicle-card-top">
                        <span className="vehicle-icon">🚘</span>
                        <Badge active={v.is_active} />
                      </div>
                      <h3 className="vehicle-reg">{v.registration_number}</h3>
                      <div className="vehicle-meta">
                        <div className="meta-row">
                          <span className="meta-label">Type</span>
                          <span className="meta-value">{v.vehicle_type}</span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-label">RFID</span>
                          <span className="meta-value meta-mono">{v.rfid_tag}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ── VEHICLES VIEW ── */}
        {activeNav === "Vehicles" && (
          <section className="vehicles-section" id="vehicles" style={{ marginTop: activeNav === "Dashboard" ? "40px" : "0" }}>
            <div className="section-header" style={{ marginBottom: "16px" }}>
              <div>
                <h2>Vehicle Management</h2>
                <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
                  Manage registered vehicles, monitor RFID tags, and control toll authorization.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  id="refresh-vehicles-btn"
                  className="btn-sm btn-outline"
                  onClick={handleRefreshVehicles}
                  disabled={refreshingVehicles || loading}
                  title="Reload vehicle list"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span style={{ display: "inline-block", transform: refreshingVehicles ? "rotate(180deg)" : "none", transition: "transform 0.4s ease" }}>↻</span>
                  {refreshingVehicles ? "Refreshing…" : "Refresh"}
                </button>
                <button
                  id="add-vehicle-btn"
                  className="btn-primary"
                  style={{ padding: "8px 16px", fontSize: "13px", margin: 0 }}
                  onClick={() => {
                    setShowVehicleForm(!showVehicleForm);
                    setEditingVehicle(null);
                    setAddErrors({});
                    setVehicleMessage("");
                  }}
                >
                  {showVehicleForm ? "Cancel" : "+ Add Vehicle"}
                </button>
              </div>
            </div>

            {/* Vehicle Summary Cards */}
            <div className="vehicle-summary-strip">
              <div className="summary-pill">
                <span className="summary-pill-label">Total Registered</span>
                <span className="summary-pill-value">{vehicles.length}</span>
              </div>
              <div className="summary-pill">
                <span className="summary-pill-label" style={{ color: "var(--success)" }}>Active Vehicles</span>
                <span className="summary-pill-value" style={{ color: "var(--success)" }}>{activeVehicles}</span>
              </div>
              <div className="summary-pill">
                <span className="summary-pill-label" style={{ color: "var(--danger)" }}>Inactive Vehicles</span>
                <span className="summary-pill-value" style={{ color: "var(--danger)" }}>{inactiveVehicles}</span>
              </div>
              <div className="summary-pill">
                <span className="summary-pill-label">Filtered Results</span>
                <span className="summary-pill-value">{filteredVehicles.length}</span>
              </div>
            </div>

            {/* Search and Filters Toolbar */}
            <div className="filter-group" style={{ background: "var(--bg-card)", padding: "12px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ flex: "1 1 200px", minWidth: "180px" }}>
                <input
                  id="vehicle-search-input"
                  type="text"
                  placeholder="🔍 Search reg no, RFID tag, type…"
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", fontSize: "13px" }}
                />
              </div>
              <select
                id="vehicle-status-filter"
                className="filter-select"
                value={vehicleStatusFilter}
                onChange={(e) => setVehicleStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
              <select
                id="vehicle-type-filter"
                className="filter-select"
                value={vehicleTypeFilter}
                onChange={(e) => setVehicleTypeFilter(e.target.value)}
              >
                <option value="ALL">All Vehicle Types</option>
                <option value="CAR">CAR</option>
                <option value="TRUCK">TRUCK</option>
                <option value="BUS">BUS</option>
                <option value="MOTORCYCLE">MOTORCYCLE</option>
              </select>
              <div className="view-toggle">
                <button
                  type="button"
                  id="view-cards-btn"
                  className={`view-toggle-btn ${viewMode === "cards" ? "active" : ""}`}
                  onClick={() => setViewMode("cards")}
                  title="Card View"
                >
                  Cards
                </button>
                <button
                  type="button"
                  id="view-table-btn"
                  className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                  onClick={() => setViewMode("table")}
                  title="Table View"
                >
                  Table
                </button>
              </div>
              {(vehicleSearch || vehicleStatusFilter !== "ALL" || vehicleTypeFilter !== "ALL") && (
                <button
                  type="button"
                  className="btn-sm btn-outline"
                  onClick={() => {
                    setVehicleSearch("");
                    setVehicleStatusFilter("ALL");
                    setVehicleTypeFilter("ALL");
                  }}
                  style={{ fontSize: "12px" }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Global Vehicle Notice */}
            {vehicleMessage && (
              <div style={{ marginBottom: "16px" }}>
                <Alert type={vehicleMessage.toLowerCase().includes("fail") || vehicleMessage.toLowerCase().includes("error") ? "error" : "success"}>
                  {vehicleMessage}
                </Alert>
              </div>
            )}

            {/* Edit Vehicle Form */}
            {editingVehicle && (
              <form
                className="login-card"
                style={{ maxWidth: "100%", marginBottom: "24px", border: "1px solid var(--accent)" }}
                onSubmit={handleUpdateVehicle}
                id="edit-vehicle-form"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0 }}>Edit Vehicle: {editingVehicle.registration_number}</h3>
                  <Badge active={editingVehicle.is_active} />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-reg-num">Registration Number *</label>
                  <input
                    id="edit-reg-num"
                    type="text"
                    value={editReg}
                    onChange={(e) => {
                      setEditReg(e.target.value);
                      if (editErrors.registration_number) setEditErrors((prev) => ({ ...prev, registration_number: null }));
                    }}
                    required
                  />
                  {editErrors.registration_number && (
                    <div className="form-error-inline">⚠️ {editErrors.registration_number}</div>
                  )}
                </div>
                <div className="form-group" style={{ marginTop: "12px" }}>
                  <label htmlFor="edit-veh-type">Vehicle Type *</label>
                  <select id="edit-veh-type" value={editType} onChange={(e) => setEditType(e.target.value)}>
                    <option value="CAR">CAR</option>
                    <option value="TRUCK">TRUCK</option>
                    <option value="BUS">BUS</option>
                    <option value="MOTORCYCLE">MOTORCYCLE</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginTop: "12px" }}>
                  <label htmlFor="edit-rfid">RFID Tag *</label>
                  <input
                    id="edit-rfid"
                    type="text"
                    value={editRfid}
                    onChange={(e) => {
                      setEditRfid(e.target.value);
                      if (editErrors.rfid_tag) setEditErrors((prev) => ({ ...prev, rfid_tag: null }));
                    }}
                    required
                  />
                  {editErrors.rfid_tag && (
                    <div className="form-error-inline">⚠️ {editErrors.rfid_tag}</div>
                  )}
                </div>
                {editMsg && (
                  <Alert type={editMsg.toLowerCase().includes("fail") || editMsg.toLowerCase().includes("error") ? "error" : "success"} style={{ marginTop: "12px" }}>
                    {editMsg}
                  </Alert>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button type="submit" id="save-edit-vehicle-btn" className="btn-primary" disabled={editLoading} style={{ flex: 1, margin: 0 }}>
                    {editLoading ? "Saving…" : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    className="btn-sm btn-outline"
                    style={{ padding: "8px 16px" }}
                    onClick={() => {
                      setEditingVehicle(null);
                      setEditErrors({});
                      setEditMsg("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Add Vehicle Form */}
            {showVehicleForm && (
              <form
                className="login-card"
                style={{ maxWidth: "100%", marginBottom: "24px", border: "1px solid var(--accent)" }}
                onSubmit={handleAddVehicle}
                id="add-vehicle-form"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0 }}>Register New Vehicle</h3>
                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={() => {
                      setShowVehicleForm(false);
                      setAddErrors({});
                    }}
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="form-group">
                  <label htmlFor="reg-num">Registration Number *</label>
                  <input
                    id="reg-num"
                    type="text"
                    placeholder="e.g. MH12AB1234"
                    value={registrationNumber}
                    onChange={(e) => {
                      setRegistrationNumber(e.target.value);
                      if (addErrors.registration_number) setAddErrors((prev) => ({ ...prev, registration_number: null }));
                    }}
                    required
                  />
                  {addErrors.registration_number && (
                    <div className="form-error-inline">⚠️ {addErrors.registration_number}</div>
                  )}
                </div>
                <div className="form-group" style={{ marginTop: "12px" }}>
                  <label htmlFor="veh-type">Vehicle Type *</label>
                  <select id="veh-type" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                    <option value="CAR">CAR</option>
                    <option value="TRUCK">TRUCK</option>
                    <option value="BUS">BUS</option>
                    <option value="MOTORCYCLE">MOTORCYCLE</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginTop: "12px" }}>
                  <label htmlFor="rfid">RFID Tag *</label>
                  <input
                    id="rfid"
                    type="text"
                    placeholder="e.g. RFID12345"
                    value={rfidTag}
                    onChange={(e) => {
                      setRfidTag(e.target.value);
                      if (addErrors.rfid_tag) setAddErrors((prev) => ({ ...prev, rfid_tag: null }));
                    }}
                    required
                  />
                  {addErrors.rfid_tag && (
                    <div className="form-error-inline">⚠️ {addErrors.rfid_tag}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
                  <button
                    type="submit"
                    id="submit-add-vehicle-btn"
                    className="btn-primary"
                    disabled={vehicleLoading}
                    style={{ flex: 1, margin: 0 }}
                  >
                    {vehicleLoading ? "Registering…" : "Register Vehicle"}
                  </button>
                  <button
                    type="button"
                    className="btn-sm btn-outline"
                    style={{ padding: "8px 16px" }}
                    onClick={() => {
                      setShowVehicleForm(false);
                      setAddErrors({});
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Loading / Error States */}
            {loading && <Spinner text="Fetching vehicles…" />}
            {error && <Alert type="error">⚠️ {error}</Alert>}

            {/* Empty States */}
            {!loading && !error && vehicles.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon">🚦</span>
                <p style={{ fontWeight: 600, fontSize: "16px" }}>No vehicles registered yet</p>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
                  Add your vehicle above to start automatic toll collection and tracking.
                </p>
                <button
                  className="btn-primary"
                  style={{ marginTop: "16px", padding: "8px 20px" }}
                  onClick={() => setShowVehicleForm(true)}
                >
                  + Add First Vehicle
                </button>
              </div>
            )}

            {!loading && !error && vehicles.length > 0 && filteredVehicles.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon">🔍</span>
                <p style={{ fontWeight: 600, fontSize: "15px" }}>No vehicles match filter criteria</p>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
                  Try adjusting your search query, status, or vehicle type filters.
                </p>
                <button
                  className="btn-sm btn-outline"
                  style={{ marginTop: "12px" }}
                  onClick={() => {
                    setVehicleSearch("");
                    setVehicleStatusFilter("ALL");
                    setVehicleTypeFilter("ALL");
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )}

            {/* Data Render: Table or Cards */}
            {!loading && !error && filteredVehicles.length > 0 && viewMode === "table" && (
              <div className="vehicle-table-wrapper">
                <table className="vehicle-table" id="vehicles-table">
                  <thead>
                    <tr>
                      <th>Registration</th>
                      <th>Type</th>
                      <th>RFID Tag</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVehicles.map((vehicle) => (
                      <tr key={vehicle.id} id={`vehicle-row-${vehicle.id}`}>
                        <td style={{ fontWeight: 600 }}>{vehicle.registration_number}</td>
                        <td>
                          <span style={{ fontSize: "12px", background: "rgba(255,255,255,0.06)", padding: "3px 8px", borderRadius: "4px" }}>
                            {vehicle.vehicle_type}
                          </span>
                        </td>
                        <td>
                          <code>{vehicle.rfid_tag}</code>
                        </td>
                        <td>
                          <Badge active={vehicle.is_active} />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              className="btn-sm btn-outline"
                              onClick={() => setSelectedVehicleDetail(vehicle)}
                              title="View full vehicle details"
                            >
                              Details
                            </button>
                            <button
                              className="btn-sm btn-outline"
                              onClick={() => {
                                setEditingVehicle(vehicle);
                                setEditReg(vehicle.registration_number);
                                setEditType(vehicle.vehicle_type);
                                setEditRfid(vehicle.rfid_tag);
                                setEditMsg("");
                                setEditErrors({});
                                setShowVehicleForm(false);
                              }}
                              title="Edit registration or RFID"
                            >
                              Edit
                            </button>
                            <button
                              className={vehicle.is_active ? "btn-sm btn-danger" : "btn-sm btn-success"}
                              onClick={() => handleToggleVehicle(vehicle)}
                              disabled={vehicleLoading}
                              title={vehicle.is_active ? "Deactivate vehicle" : "Activate vehicle"}
                            >
                              {vehicle.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && !error && filteredVehicles.length > 0 && viewMode === "cards" && (
              <div className="vehicle-grid">
                {filteredVehicles.map((vehicle) => (
                  <article className="vehicle-card" key={vehicle.id} id={`vehicle-card-${vehicle.id}`}>
                    <div className="vehicle-card-top">
                      <span className="vehicle-icon">🚘</span>
                      <Badge active={vehicle.is_active} />
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
                    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                      <button
                        className="btn-sm btn-outline"
                        style={{ flex: 1, padding: "6px 0", fontSize: "12px", borderRadius: "var(--radius-sm)" }}
                        onClick={() => setSelectedVehicleDetail(vehicle)}
                      >
                        Details
                      </button>
                      <button
                        className="btn-sm btn-outline"
                        style={{ flex: 1, padding: "6px 0", fontSize: "12px", borderRadius: "var(--radius-sm)" }}
                        onClick={() => {
                          setEditingVehicle(vehicle);
                          setEditReg(vehicle.registration_number);
                          setEditType(vehicle.vehicle_type);
                          setEditRfid(vehicle.rfid_tag);
                          setEditMsg("");
                          setEditErrors({});
                          setShowVehicleForm(false);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className={vehicle.is_active ? "btn-sm btn-danger" : "btn-sm btn-success"}
                        style={{ flex: 1, padding: "6px 0", fontSize: "12px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontWeight: 600 }}
                        onClick={() => handleToggleVehicle(vehicle)}
                        disabled={vehicleLoading}
                      >
                        {vehicle.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Vehicle Details Modal */}
            {selectedVehicleDetail && (
              <div className="modal-backdrop" onClick={() => setSelectedVehicleDetail(null)}>
                <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Vehicle Specification</h3>
                    <button className="modal-close-btn" onClick={() => setSelectedVehicleDetail(null)}>✕</button>
                  </div>
                  <div className="modal-body">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "1px" }}>
                        {selectedVehicleDetail.registration_number}
                      </span>
                      <Badge active={selectedVehicleDetail.is_active} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Classification:</span>
                        <span style={{ fontWeight: 600 }}>{selectedVehicleDetail.vehicle_type}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>RFID Transponder:</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <code>{selectedVehicleDetail.rfid_tag}</code>
                          <button
                            type="button"
                            className="btn-sm btn-outline"
                            style={{ padding: "2px 6px", fontSize: "11px" }}
                            onClick={() => {
                              navigator.clipboard?.writeText(selectedVehicleDetail.rfid_tag);
                              alert("RFID Tag copied to clipboard!");
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Toll Authorization:</span>
                        <span style={{ fontWeight: 600, color: selectedVehicleDetail.is_active ? "var(--success)" : "var(--danger)" }}>
                          {selectedVehicleDetail.is_active ? "Authorized (Active)" : "Barred (Inactive)"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      className="btn-sm btn-outline"
                      onClick={() => {
                        setEditingVehicle(selectedVehicleDetail);
                        setEditReg(selectedVehicleDetail.registration_number);
                        setEditType(selectedVehicleDetail.vehicle_type);
                        setEditRfid(selectedVehicleDetail.rfid_tag);
                        setEditMsg("");
                        setEditErrors({});
                        setSelectedVehicleDetail(null);
                      }}
                    >
                      Edit Vehicle
                    </button>
                    <button className="btn-primary" style={{ padding: "8px 16px", fontSize: "13px", margin: 0 }} onClick={() => setSelectedVehicleDetail(null)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Deactivation Confirmation Modal */}
            {confirmDeactivate && (
              <div className="modal-backdrop" onClick={() => setConfirmDeactivate(null)}>
                <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3 style={{ color: "var(--danger)" }}>Confirm Vehicle Deactivation</h3>
                    <button className="modal-close-btn" onClick={() => setConfirmDeactivate(null)}>✕</button>
                  </div>
                  <div className="modal-body">
                    <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>
                      Are you sure you want to deactivate vehicle <strong>{confirmDeactivate.registration_number}</strong>?
                    </p>
                    <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                      Deactivating will immediately prevent this vehicle from automatically paying tolls at plazas. You can reactivate it at any time.
                    </p>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-sm btn-outline" onClick={() => setConfirmDeactivate(null)}>
                      Cancel
                    </button>
                    <button
                      id="confirm-deactivate-btn"
                      className="btn-sm btn-danger"
                      onClick={() => executeToggleVehicle(confirmDeactivate, false)}
                      disabled={vehicleLoading}
                    >
                      {vehicleLoading ? "Deactivating…" : "Yes, Deactivate Vehicle"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── WALLET VIEW (LEVEL 5) ── */}
        {activeNav === "Wallet" && (
          <section className="vehicles-section" id="owner-wallet-section">
            <div className="section-header" style={{ marginBottom: "20px", justifyContent: "space-between" }}>
              <div>
                <h2>My TollFlow Wallet</h2>
                <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
                  Manage virtual funds, preview balance deductions, and simulate automated toll top-ups.
                </p>
              </div>
              <button
                type="button"
                id="refresh-wallet-btn"
                className="btn-sm btn-outline"
                onClick={handleRefreshWallet}
                disabled={walletLoading}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>↻</span>
                {walletLoading ? "Refreshing…" : "Refresh Balance"}
              </button>
            </div>

            {/* Wallet Balance Hero Box */}
            <div className="wallet-hero-box">
              <div className="wallet-balance-display">
                <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Available Virtual Balance
                </span>
                <span className="wallet-balance-amount" id="user-wallet-balance">
                  ₹{Number(walletBalance).toFixed(2)}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-soft)" }}>
                  Secured by server-side atomic locking · Updated in real time
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>Quick Add Virtual Funds</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[100, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className="preset-chip"
                      disabled={topupLoading}
                      onClick={() => handleTopUp(amt)}
                      title={`Add ₹${amt} to wallet`}
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Demo Notice Alert */}
            <div style={{ marginBottom: 24 }}>
              <Alert type="info">
                ℹ️ <strong>Demo Simulation Environment</strong>: This wallet uses simulated currency to demonstrate real-time balance deductions when crossing automated RFID toll gates. No real credit cards, bank accounts, or payment gateways are connected or charged.
              </Alert>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
              {/* Top-Up Form */}
              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>💳 Add Demo Funds</h3>
                </div>

                <form
                  id="wallet-topup-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleTopUp();
                  }}
                >
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 8 }}>
                    Select Preset Amount:
                  </label>
                  <div className="preset-chips-row">
                    {[100, 250, 500, 1000, 2000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className={`preset-chip ${String(topupAmount) === String(amt) ? "active" : ""}`}
                        onClick={() => {
                          setTopupAmount(String(amt));
                          setTopupMessage("");
                        }}
                      >
                        +₹{amt.toLocaleString("en-IN")}
                      </button>
                    ))}
                  </div>

                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label htmlFor="wallet-topup-input">Or Enter Custom Amount (₹)</label>
                    <input
                      id="wallet-topup-input"
                      type="number"
                      min="1.00"
                      max="100000.00"
                      step="0.01"
                      value={topupAmount}
                      onChange={(e) => {
                        setTopupAmount(e.target.value);
                        setTopupMessage("");
                      }}
                      placeholder="e.g. 500.00"
                      required
                    />
                    <div className="profile-field-desc">Accepted limits: ₹1.00 to ₹1,00,000.00 per top-up.</div>
                  </div>

                  {topupMessage && (
                    <div style={{ marginBottom: 16 }}>
                      <Alert type={topupSuccess ? "success" : "error"}>
                        {topupSuccess ? "✓" : "⚠️"} {topupMessage}
                      </Alert>
                    </div>
                  )}

                  <button
                    type="submit"
                    id="wallet-submit-topup-btn"
                    className="btn-primary"
                    disabled={topupLoading || !topupAmount}
                    style={{ width: "100%", padding: "10px 16px" }}
                  >
                    {topupLoading ? "Processing Top-Up…" : "Add Demo Money to Wallet"}
                  </button>
                </form>
              </div>

              {/* Recent Toll Debits */}
              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>🧾 Recent Toll Debits</h3>
                  <span style={{ fontSize: "12px", color: "var(--text-soft)" }}>Auto-deducted</span>
                </div>

                {successfulTransactions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "36px 12px", color: "var(--text-muted)" }}>
                    <span style={{ fontSize: "28px", display: "block", marginBottom: 8 }}>💳</span>
                    <p style={{ fontWeight: 600 }}>No toll deductions yet</p>
                    <p style={{ fontSize: "12px", marginTop: 4 }}>
                      When highway toll plazas deduct toll crossings on your vehicles, debits will be listed here.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {successfulTransactions.slice(0, 5).map((txn) => (
                      <div
                        key={txn.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: "var(--radius-sm)",
                          background: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "13px" }}>{txn.vehicle_registration}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {txn.toll_plaza_name} · {txn.created_at ? new Date(txn.created_at).toLocaleDateString() : ""}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: "var(--danger)", fontSize: "14px" }}>
                          -₹{Number(txn.amount).toFixed(2)}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setActiveNav("History")}
                      style={{ marginTop: 8, fontSize: "12px", textAlign: "center" }}
                    >
                      View Full Transaction History &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Normal user cannot deduct toll - handled exclusively by Admin Toll Booth */}

        {/* ── TRANSACTION HISTORY VIEW (LEVEL 5) ── */}
        {activeNav === "History" && (
          <section className="vehicles-section" id="owner-history-section">
            <div className="section-header" style={{ marginBottom: "16px", justifyContent: "space-between" }}>
              <div>
                <h2>Toll Transaction History</h2>
                <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
                  Complete verified log of your automated toll passages, barrier debits, and status receipts.
                </p>
              </div>
              <button
                id="refresh-transactions-btn"
                className="btn-sm btn-outline"
                onClick={handleLoadTransactions}
                disabled={transactionLoading}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>↻</span>
                {transactionLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {/* Transaction Summary Strip */}
            <div className="vehicle-summary-strip">
              <div className="summary-pill">
                <span className="summary-pill-label">Total Passages</span>
                <span className="summary-pill-value">{transactions.length}</span>
              </div>
              <div className="summary-pill">
                <span className="summary-pill-label" style={{ color: "var(--success)" }}>Successful</span>
                <span className="summary-pill-value" style={{ color: "var(--success)" }}>{successfulTransactions.length}</span>
              </div>
              <div className="summary-pill">
                <span className="summary-pill-label" style={{ color: "var(--danger)" }}>Failed Attempts</span>
                <span className="summary-pill-value" style={{ color: "var(--danger)" }}>{failedTransactions.length}</span>
              </div>
              <div className="summary-pill">
                <span className="summary-pill-label">Total Tolls Paid</span>
                <span className="summary-pill-value">₹{totalTollSpent.toFixed(2)}</span>
              </div>
            </div>

            {/* Filter Group */}
            <div className="filter-group" style={{ background: "var(--bg-card)", padding: "12px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", marginBottom: 16 }}>
              <div style={{ flex: "1 1 200px", minWidth: "180px" }}>
                <input
                  id="txn-search-input"
                  type="text"
                  placeholder="🔍 Search vehicle, plaza, transaction ID, state…"
                  value={txnSearch}
                  onChange={(e) => {
                    setTxnSearch(e.target.value);
                    setTxnPage(1);
                  }}
                  style={{ width: "100%", padding: "8px 12px", fontSize: "13px" }}
                />
              </div>

              <select
                id="txn-status-filter"
                className="filter-select"
                value={txnStatusFilter}
                onChange={(e) => {
                  setTxnStatusFilter(e.target.value);
                  setTxnPage(1);
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Successful Only</option>
                <option value="FAILED">Failed Only</option>
              </select>

              <select
                id="txn-date-filter"
                className="filter-select"
                value={txnDateFilter}
                onChange={(e) => {
                  setTxnDateFilter(e.target.value);
                  setTxnPage(1);
                }}
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today Only</option>
                <option value="7D">Last 7 Days</option>
                <option value="30D">Last 30 Days</option>
              </select>

              {(txnSearch || txnStatusFilter !== "ALL" || txnDateFilter !== "ALL") && (
                <button
                  type="button"
                  className="btn-sm btn-outline"
                  onClick={() => {
                    setTxnSearch("");
                    setTxnStatusFilter("ALL");
                    setTxnDateFilter("ALL");
                    setTxnPage(1);
                  }}
                  style={{ fontSize: "12px" }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Loading / Error States */}
            {transactionLoading && <Spinner text="Loading transaction receipts…" />}
            {transactionMessage && <Alert type="error" style={{ marginBottom: 16 }}>⚠️ {transactionMessage}</Alert>}

            {/* Empty State */}
            {!transactionLoading && !transactionMessage && transactions.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon">📊</span>
                <p style={{ fontWeight: 600, fontSize: "16px" }}>No Transactions Yet</p>
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  Your automated highway toll deductions processed by toll plaza operators will appear here with detailed passage receipts.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: 14 }}
                  onClick={() => setActiveNav("Vehicles")}
                >
                  🚘 View My Vehicles
                </button>
              </div>
            )}

            {!transactionLoading && !transactionMessage && transactions.length > 0 && filteredUserTransactions.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon">🔍</span>
                <p style={{ fontWeight: 600, fontSize: "15px" }}>No transactions match criteria</p>
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  Try resetting the search terms, status, or date range filter.
                </p>
                <button
                  type="button"
                  className="btn-sm btn-outline"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    setTxnSearch("");
                    setTxnStatusFilter("ALL");
                    setTxnDateFilter("ALL");
                    setTxnPage(1);
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )}

            {/* Transactions Table */}
            {!transactionLoading && !transactionMessage && paginatedTransactions.length > 0 && (
              <>
                <div className="vehicle-table-wrapper">
                  <table className="vehicle-table" id="user-transactions-table">
                    <thead>
                      <tr>
                        <th>Txn ID</th>
                        <th>Vehicle</th>
                        <th>Toll Plaza</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Gate State</th>
                        <th>Date &amp; Time</th>
                        <th>Details / Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTransactions.map((txn) => {
                        const isSuccess = txn.status === "SUCCESS";
                        return (
                          <tr key={txn.id || Math.random()} id={`user-txn-row-${txn.id}`}>
                            <td>
                              <code>#{txn.id}</code>
                            </td>
                            <td style={{ fontWeight: 600 }}>{txn.vehicle_registration || "—"}</td>
                            <td>{txn.toll_plaza_name || "—"}</td>
                            <td style={{ fontWeight: 700, color: isSuccess ? "var(--text)" : "var(--text-muted)" }}>
                              ₹{Number(txn.amount || 0).toFixed(2)}
                            </td>
                            <td>
                              <span className={`status-badge ${isSuccess ? "badge--active" : "badge--inactive"}`}>
                                {txn.status}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: isSuccess ? "var(--success)" : "var(--danger)" }}>
                                {txn.state || (isSuccess ? "PASSED" : "FAILED")}
                              </span>
                            </td>
                            <td style={{ fontSize: "12px", color: "var(--text-soft)" }}>
                              {txn.created_at ? new Date(txn.created_at).toLocaleString() : "—"}
                            </td>
                            <td style={{ fontSize: "12px", color: isSuccess ? "var(--text-soft)" : "var(--danger)" }}>
                              {txn.failure_reason || (isSuccess ? "Passage authorized" : "Failed")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="pagination-bar">
                  <span style={{ fontSize: "13px", color: "var(--text-soft)" }}>
                    Showing {(txnPage - 1) * txnsPerPage + 1}–{Math.min(txnPage * txnsPerPage, filteredUserTransactions.length)} of {filteredUserTransactions.length} transactions
                  </span>

                  <div className="pagination-pages">
                    <button
                      type="button"
                      className="page-btn"
                      disabled={txnPage <= 1}
                      onClick={() => setTxnPage((p) => Math.max(1, p - 1))}
                    >
                      &larr; Prev
                    </button>

                    <span style={{ fontSize: "12px", padding: "0 8px", color: "var(--text)" }}>
                      Page {txnPage} of {totalTxnPages}
                    </span>

                    <button
                      type="button"
                      className="page-btn"
                      disabled={txnPage >= totalTxnPages}
                      onClick={() => setTxnPage((p) => Math.min(totalTxnPages, p + 1))}
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* ── PROFILE VIEW ── */}
        {activeNav === "Profile" && (
          <section className="vehicles-section" id="owner-profile-section">
            <ProfileView
              userProfileData={userProfileData}
              onProfileUpdated={(updated) => {
                setUserProfileData(updated);
                if (updated.email) setUserEmail(updated.email);
              }}
              token={token}
              role={role}
              loggedInUser={loggedInUser}
              onLogout={handleLogout}
              walletBalance={walletBalance}
              vehicles={vehicles}
              totalTollSpent={totalTollSpent}
            />
          </section>
        )}
      </main>

      <footer className="footer">
        <p>© 2025 TollFlow · Automated Toll Management System</p>
      </footer>
    </div>
    </div>
  );
}

export default App;