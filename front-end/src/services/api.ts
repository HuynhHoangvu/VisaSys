import axios from "axios";

// Always use localhost for local development
const BASE_URL = import.meta.env.MODE === "production" 
  ? import.meta.env.VITE_API_URL || "http://localhost:3001" 
  : "http://localhost:3001";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
