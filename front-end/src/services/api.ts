import axios from "axios";
import { API_URL } from "../constants/config";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  try {
    const userJson = localStorage.getItem("flyvisa_user");
    if (userJson) {
      const user = JSON.parse(userJson);
      if (user && user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    }
  } catch (err) {
    console.error("Error attaching auth token to request", err);
  }
  return config;
});

export default api;
