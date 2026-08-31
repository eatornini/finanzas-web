import { iniciarRouter } from "./ui/router.js";

window.addEventListener("error", (e) => {
  console.error("Error no controlado:", e.error);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Promesa rechazada sin manejar:", e.reason);
});

iniciarRouter();
