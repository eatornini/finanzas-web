import { iniciarRouter } from "./ui/router.js";

window.addEventListener("error", (e) => {
  console.error("Error no controlado:", e.error);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Promesa rechazada sin manejar:", e.reason);
});

iniciarRouter();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* PWA es progresiva: si falla el registro, la app igual funciona online */
    });
  });
}
