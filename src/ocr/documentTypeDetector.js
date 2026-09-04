// Clasifica un comprobante como transferencia o compra por conteo de
// palabras clave. Port de DocumentTypeDetector.kt.
const TRANSFER_KEYWORDS = [
  "transferencia", "operacion exitosa", "operación exitosa", "destinatario",
  "cuenta destino", "cuenta origen", "monto transferido",
  "fecha y hora", "n° de operacion", "n° de operación",
  "comprobante de transferencia", "transferencia exitosa",
  "transferencia realizada", "transferiste",
  "transferencia recibida", "transferencia enviada",
  "pago exitoso", "pago realizado", "pago recibido",
  "beneficiario", "cuenta rut", "cuentanut", "cuenta pro",
  "banco destino", "banco origen", "tipo de cuenta",
];

const PURCHASE_KEYWORDS = [
  "gracias por tu compra", "compra aprobada", "total", "subtotal",
  "comercio", "boleta", "factura", "consumo", "establecimiento",
  "código de autorización", "codigo de autorizacion",
];

// "transferencia" | "compra"
export function detectarTipoDocumento(fullText) {
  const lower = fullText.toLowerCase();
  const transferScore = TRANSFER_KEYWORDS.filter((k) => lower.includes(k)).length;
  const purchaseScore = PURCHASE_KEYWORDS.filter((k) => lower.includes(k)).length;
  if (transferScore >= 2 && transferScore > purchaseScore) return "transferencia";
  return "compra";
}
