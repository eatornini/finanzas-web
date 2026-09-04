package com.eric.finanzas.utils

import java.util.*

class DocumentTypeDetector {

    private val transferKeywords = listOf(
        "transferencia", "operacion exitosa", "operación exitosa", "destinatario",
        "cuenta destino", "cuenta origen", "monto transferido",
        "fecha y hora", "n° de operacion", "n° de operación",
        "comprobante de transferencia", "transferencia exitosa",
        "transferencia realizada", "transferiste",
        "transferencia recibida", "transferencia enviada",
        "pago exitoso", "pago realizado", "pago recibido",
        "beneficiario", "cuenta rut", "cuentanut", "cuenta pro",
        "banco destino", "banco origen", "tipo de cuenta"
    )

    private val purchaseKeywords = listOf(
        "gracias por tu compra", "compra aprobada", "total", "subtotal",
        "comercio", "boleta", "factura", "consumo", "establecimiento",
        "código de autorización", "codigo de autorizacion"
    )

    fun detect(fullText: String): DocumentType {
        val lower = fullText.lowercase(Locale.ROOT)

        val transferScore = transferKeywords.count { lower.contains(it) }
        val purchaseScore = purchaseKeywords.count { lower.contains(it) }

        if (transferScore >= 2 && transferScore > purchaseScore) {
            return DocumentType.TRANSFERENCIA
        }

        return DocumentType.COMPRA
    }
}
