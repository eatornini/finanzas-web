package com.eric.finanzas.utils

import android.util.Log
import java.util.*

class PurchaseExtractor {

    private val spanishMonths = mapOf(
        "ene" to 0, "feb" to 1, "mar" to 2, "abr" to 3,
        "may" to 4, "jun" to 5, "jul" to 6, "ago" to 7,
        "sep" to 8, "oct" to 9, "nov" to 10, "dic" to 11,
        "enero" to 0, "febrero" to 1, "marzo" to 2, "abril" to 3,
        "mayo" to 4, "junio" to 5, "julio" to 6, "agosto" to 7,
        "septiembre" to 8, "octubre" to 9, "noviembre" to 10, "diciembre" to 11
    )

    private val exclusionWords = listOf(
        "lte", "4g", "5g", "3g", "volte", "vo lte", "wifi",
        "batería", "bateria", "señal", "senal", "operador",
        "visa", "mastercard", "débito", "debito", "crédito", "credito",
        "american express", "dinners",
        "id de transacción", "id de transaccion", "id transacción", "id transaccion",
        "comunicarse con la entidad emisora",
        "comunicate con la entidad emisora",
        "obtén recibos más detallados", "obten recibos mas detallados",
        "configurar", "notificaciones", "edge", "gprs", "battery",
        "movistar", "entel", "claro", "wom", "virgin mobile",
        "tarjeta", "terminada en", "cuotas", "cuota",
        "fecha", "hora", "completada", "domingo", "lunes", "martes",
        "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado"
    )

    fun extract(allLines: List<LineInfo>, allBlocks: List<BlockInfo>): OcrResult {
        val imageHeight = if (allBlocks.isNotEmpty()) allBlocks.maxOf { it.bottom } else 0
        val (monto, montoBlock) = extractMonto(allBlocks)
        val (fecha, _) = extractFechaHora(allLines)
        val comercio = extractComercio(allBlocks, montoBlock, imageHeight)

        Log.d("PurchaseExtractor", "Comercio: $comercio, Monto: $monto, Fecha: $fecha")

        return OcrResult(
            comercio = comercio,
            monto = monto,
            fecha = fecha,
            tipoDetectado = DocumentType.COMPRA
        )
    }

    private fun extractMonto(blocks: List<BlockInfo>): Pair<Double?, BlockInfo?> {
        for (block in blocks) {
            for (line in block.lines) {
                val text = line.text.trim()
                if (text.isEmpty()) continue

                val clpMatch = Regex(
                    """CLP\s*\$?\s*([\d\s,]+(?:[.,]\d{1,2})?)""",
                    RegexOption.IGNORE_CASE
                ).find(text)
                if (clpMatch != null) {
                    val raw = clpMatch.groupValues[1].trim().replace(" ", "")
                    val parsed = limpiarMonto(raw)
                    if (parsed != null && parsed > 0) return Pair(parsed, block)
                }

                val dollarMatch = Regex("""\$\s*([\d\s,]+(?:[.,]\d{1,2})?)""").find(text)
                if (dollarMatch != null) {
                    val raw = dollarMatch.groupValues[1].trim().replace(" ", "")
                    val parsed = limpiarMonto(raw)
                    if (parsed != null && parsed > 0) return Pair(parsed, block)
                }

                val labelMatch = Regex(
                    """(?:Total|Monto|Importe|Valor|Pago)\s*:?\s*\$?\s*([\d\s,]+(?:[.,]\d{1,2})?)""",
                    RegexOption.IGNORE_CASE
                ).find(text)
                if (labelMatch != null) {
                    val raw = labelMatch.groupValues[1].trim().replace(" ", "")
                    val parsed = limpiarMonto(raw)
                    if (parsed != null && parsed > 0) return Pair(parsed, block)
                }
            }
        }
        return Pair(null, null)
    }

    private fun limpiarMonto(raw: String): Double? {
        try {
            return if (raw.contains(",") && raw.contains(".")) {
                val lastCommaIdx = raw.lastIndexOf(",")
                val integerPart = raw.substring(0, lastCommaIdx).replace(".", "")
                val decimalPart = raw.substring(lastCommaIdx + 1).take(2)
                "$integerPart.$decimalPart".toDoubleOrNull()
            } else if (raw.contains(",")) {
                val parts = raw.split(",")
                if (parts.size == 2 && parts[1].length <= 2) {
                    raw.replace(",", ".").toDoubleOrNull()
                } else {
                    raw.replace(",", "").toDoubleOrNull()
                }
            } else if (raw.contains(".")) {
                val parts = raw.split("\\.".toRegex())
                if (parts.size == 2 && parts[1].length <= 2) {
                    raw.toDoubleOrNull()
                } else {
                    raw.replace(".", "").toDoubleOrNull()
                }
            } else {
                raw.toDoubleOrNull()
            }
        } catch (_: Exception) {
            return null
        }
    }

    private fun extractFechaHora(lines: List<LineInfo>): Pair<Long?, String?> {
        val dateRegex = Regex(
            """(\d{1,2})\s+de\s+([a-zA-Záéíóúñ]+)\s+a\s+las\s+(\d{1,2}):(\d{2})"""
        )

        for (line in lines) {
            val match = dateRegex.find(line.text.trim())
            if (match != null) {
                val day = match.groupValues[1].toIntOrNull() ?: continue
                val monthStr = match.groupValues[2].lowercase(Locale.ROOT)
                val month = spanishMonths[monthStr] ?: continue
                val hour = match.groupValues[3].toIntOrNull() ?: continue
                val minute = match.groupValues[4].toIntOrNull() ?: continue

                if (day < 1 || day > 31 || hour > 23 || minute > 59) continue

                val cal = Calendar.getInstance()
                cal.set(Calendar.YEAR, cal.get(Calendar.YEAR))
                cal.set(Calendar.MONTH, month)
                cal.set(Calendar.DAY_OF_MONTH, day)
                cal.set(Calendar.HOUR_OF_DAY, hour)
                cal.set(Calendar.MINUTE, minute)
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)

                val horaStr = "${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}"
                return Pair(cal.timeInMillis, horaStr)
            }
        }

        for (line in lines) {
            val text = line.text.trim()
            if (text.contains("/")) {
                val parts = text.split("/")
                if (parts.size >= 3) {
                    val day = parts[0].filter { it.isDigit() }.toIntOrNull()
                    val month = parts[1].filter { it.isDigit() }.toIntOrNull()
                    var year = parts[2].substring(0, minOf(4, parts[2].length)).filter { it.isDigit() }.toIntOrNull()
                    if (day != null && month != null && year != null && day in 1..31 && month in 1..12) {
                        if (year < 100) year += 2000
                        val timeMatch = Regex("""(\d{1,2}):(\d{2})""").find(text)
                        val hour = timeMatch?.groupValues?.get(1)?.toIntOrNull() ?: 0
                        val minute = timeMatch?.groupValues?.get(2)?.toIntOrNull() ?: 0

                        val cal = Calendar.getInstance()
                        cal.set(Calendar.YEAR, year)
                        cal.set(Calendar.MONTH, month - 1)
                        cal.set(Calendar.DAY_OF_MONTH, day)
                        cal.set(Calendar.HOUR_OF_DAY, hour)
                        cal.set(Calendar.MINUTE, minute)
                        cal.set(Calendar.SECOND, 0)
                        cal.set(Calendar.MILLISECOND, 0)

                        val horaStr = "${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}"
                        return Pair(cal.timeInMillis, horaStr)
                    }
                }
            }
        }

        return Pair(null, null)
    }

    private fun extractComercio(
        blocks: List<BlockInfo>,
        montoBlock: BlockInfo?,
        imageHeight: Int
    ): String? {
        if (montoBlock == null) return null

        val statusBarThreshold = (imageHeight * 0.08f).toInt().coerceIn(50, 100)

        val candidates = blocks.filter { block ->
            block.top > statusBarThreshold &&
            block.bottom <= montoBlock.top &&
            block != montoBlock &&
            !contieneTextoExcluido(block) &&
            !esBloqueMonetario(block) &&
            !esBloqueSecundario(block)
        }

        if (candidates.isEmpty()) return null

        val bestBlock = candidates.minWithOrNull(
            compareBy<BlockInfo> { montoBlock.top - it.bottom }
                .thenByDescending { it.lines.maxOf { line -> line.height } }
                .thenByDescending { it.lines.sumOf { line -> line.text.trim().length } }
        )

        if (bestBlock != null) {
            val name = bestBlock.lines
                .joinToString(" ") { it.text.trim() }
                .trim()
            if (name.isNotBlank()) return name
        }

        return null
    }

    private fun contieneTextoExcluido(block: BlockInfo): Boolean {
        val fullText = block.lines.joinToString(" ") { it.text }.lowercase(Locale.ROOT)
        if (exclusionWords.any { fullText.contains(it) }) return true
        val condensed = block.lines.joinToString("") { it.text }
        if (condensed.length <= 4 && condensed.all { it.isDigit() || it.isLetter() || it in "+-" }) return true
        val digitRatio = condensed.count { it.isDigit() }.toFloat() / condensed.length.coerceAtLeast(1)
        if (digitRatio > 0.6f && condensed.length >= 3) return true
        return false
    }

    private fun esBloqueMonetario(block: BlockInfo): Boolean {
        val text = block.lines.joinToString(" ") { it.text }
        if (text.contains("$")) return true
        if (Regex("""\bCLP\b""", RegexOption.IGNORE_CASE).containsMatchIn(text)) return true
        if (Regex("""^(Monto|Total|Importe|Valor|Pago)\b""", RegexOption.IGNORE_CASE).containsMatchIn(text)) return true
        if (Regex("""^\$?\s*[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\s*$""").matches(text.trim())) return true
        return false
    }

    private fun esBloqueSecundario(block: BlockInfo): Boolean {
        val text = block.lines.joinToString(" ") { it.text }.lowercase(Locale.ROOT)
        if (text.contains("a las")) return true
        if (text.startsWith("completada")) return true
        if (Regex("""\d{1,2}/\d{1,2}/\d{2,4}""").containsMatchIn(text)) return true
        if (Regex("""^\d{1,2}:\d{2}(:\d{2})?$""").matches(text.trim())) return true
        if (text.contains("gracias por tu compra")) return true
        if (text.contains("aprobada")) return true
        if (text.length <= 3) return true
        return false
    }
}
