const API_BASE_URL = "http://127.0.0.1:8000/api";

export async function loginUser(username, password) {
  const response = await fetch(`${API_BASE_URL}/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Login failed");
  }

  return data;
}

export async function getVehicles(token) {
  const response = await fetch(`${API_BASE_URL}/vehicles/`, {
    headers: {
      Authorization: `Token ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Could not load vehicles");
  }

  return data;
}

export async function registerUser(username, email, password) {
  const response = await fetch(`${API_BASE_URL}/register/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    let message = "Registration failed";
    if (typeof data === "object") {
      const messages = Object.values(data).flat();
      if (messages.length > 0) message = messages.join(" ");
    } else if (data.message) {
      message = data.message;
    }
    throw new Error(message);
  }

  return data;
}