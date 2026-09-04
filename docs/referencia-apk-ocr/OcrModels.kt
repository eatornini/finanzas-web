package com.eric.finanzas.utils

data class LineInfo(
    val text: String,
    val top: Int,
    val bottom: Int,
    val height: Int,
    val left: Int = 0,
    val right: Int = 0
)

data class BlockInfo(
    val lines: List<LineInfo>,
    val top: Int,
    val bottom: Int,
    val left: Int = 0,
    val right: Int = 0
) {
    val width: Int get() = if (right > left) right - left else 0
    val height: Int get() = if (bottom > top) bottom - top else 0
}

enum class DocumentType(val displayName: String) {
    AUTO("Automático"),
    TRANSFERENCIA("Transferencia"),
    COMPRA("Compra / Pago")
}

data class OcrResult(
    val comercio: String?,
    val monto: Double?,
    val fecha: Long?,
    val detalle: String? = null,
    val tipoDetectado: DocumentType? = null
)
