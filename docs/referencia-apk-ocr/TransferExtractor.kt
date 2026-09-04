package com.eric.finanzas.utils

import android.util.Log
import java.util.*

class TransferExtractor {

    private val transferKeywords = listOf(
        "transferencia", "operacion exitosa", "operación exitosa", "destinatario",
        "detalle cuenta destino", "cuenta origen", "monto transferido",
        "fecha y hora", "n° de operacion", "n° de operación",
        "comprobante de transferencia", "transferencia exitosa",
        "transferencia realizada", "transferiste",
        "transferencia recibida", "transferencia enviada",
        "pago exitoso", "pago realizado", "pago recibido"
    )

    private val excludeComercio = listOf(
        "bancoestado", "banco estado", "bci", "santander", "banco de chile",
        "itau", "itaú", "scotiabank", "tenpo", "mach", "mercadopago",
        "banco falabella", "banco internacional", "corpbanca", "banco security",
        "cuentarut", "cuenta rut", "cuenta pro", "cta cte", "cta. cte.",
        "cuenta vista", "cuenta corriente", "cuenta de ahorro",
        "cuenta rut", "cuentanut", "rut", "banco", "transferencia",
        "comprobante", "operacion", "operación", "exitosa",
        "monto", "monto transferido", "total", "transferido",
        "fecha", "hora", "fecha y hora", "n° de operacion", "n° de operación",
        "folio", "codigo", "código", "tipo de cuenta", "tipo cuenta",
        "detalle", "mensaje", "comentario",
        "transferencia exitosa", "transferencia realizada",
        "transferencia recibida", "transferencia enviada",
        "pago exitoso", "pago realizado", "pago recibido",
        "origen", "destino", "destinatario",
        "cuenta origen", "cuenta destino", "detalle cuenta destino",
        "estado", "banco destino", "banco origen",
        "nombre", "nombres", "razon social", "razón social",
        "n° de operacion", "n° de operación",
        "numero de operacion", "número de operación",
        "para", "pago", "comprobante de transferencia"
    )

    private val montoRegex = Regex("""\$?\s*([\d]+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)""")
    private val dateRegex = Regex("""(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})""")
    private val timeRegex = Regex("""(\d{1,2}):(\d{2})(?::(\d{2}))?""")
    private val timeRegexFlex = Regex("""(\d{1,2})[:.](\d{2})(?::(\d{2}))?(?:\s*(?:hrs?|horas?))?""", RegexOption.IGNORE_CASE)

    private val spanishMonths = mapOf(
        "ene" to Calendar.JANUARY, "feb" to Calendar.FEBRUARY,
        "mar" to Calendar.MARCH, "abr" to Calendar.APRIL,
        "may" to Calendar.MAY, "jun" to Calendar.JUNE,
        "jul" to Calendar.JULY, "ago" to Calendar.AUGUST,
        "sep" to Calendar.SEPTEMBER, "oct" to Calendar.OCTOBER,
        "nov" to Calendar.NOVEMBER, "dic" to Calendar.DECEMBER,
        "enero" to Calendar.JANUARY, "febrero" to Calendar.FEBRUARY,
        "marzo" to Calendar.MARCH, "abril" to Calendar.APRIL,
        "mayo" to Calendar.MAY, "junio" to Calendar.JUNE,
        "julio" to Calendar.JULY, "agosto" to Calendar.AUGUST,
        "septiembre" to Calendar.SEPTEMBER, "octubre" to Calendar.OCTOBER,
        "noviembre" to Calendar.NOVEMBER, "diciembre" to Calendar.DECEMBER
    )

    fun extract(lines: List<LineInfo>, blocks: List<BlockInfo>): TransferenciaResult? {
        val allText = lines.joinToString("\n") { it.text }
        val allTextLower = allText.lowercase(Locale.ROOT)

        if (!esTransferencia(allTextLower)) return null

        val comercio = extractComercio(lines)
        val monto = extractMonto(lines)
        val fecha = extractFecha(lines)

        Log.d("TransferExtractor", "Comercio detectado: $comercio")
        Log.d("TransferExtractor", "Monto detectado: $monto")
        Log.d("TransferExtractor", "Fecha detectada: $fecha")

        return TransferenciaResult(
            comercio = comercio,
            monto = monto,
            fecha = fecha,
            detalle = null
        )
    }

    private fun esTransferencia(text: String): Boolean {
        val keywordCount = transferKeywords.count { text.contains(it) }
        return keywordCount >= 2
    }

    private fun extractComercio(lines: List<LineInfo>): String? {
        val destinoKeywords = listOf(
            "para", "nombre", "destinatario",
            "razon social", "razón social", "beneficiario"
        )

        for (keyword in destinoKeywords) {
            val valor = findLabelValue(lines, listOf(keyword))
            if (valor != null && !esExcluidoComoComercio(valor)) {
                return valor
            }
        }

        for (line in lines) {
            val text = line.text.trim()
            if (text.length > 3 &&
                !esExcluidoComoComercio(text) &&
                !text.contains("$") &&
                !esLineaNumerica(text)
            ) {
                return text
            }
        }

        return null
    }

    private fun findLabelValue(
        lines: List<LineInfo>,
        labels: List<String>
    ): String? {
        for (i in lines.indices) {
            val lineText = lines[i].text.trim()
            val lineLower = lineText.lowercase(Locale.ROOT)

            for (label in labels) {
                val labelLower = label.lowercase(Locale.ROOT)

                val sep = "[:>\\->\u2192]"
                val colonPattern = Regex(
                    """\b""" + labelLower + """\s*""" + sep + """\s*(.+)""",
                    RegexOption.IGNORE_CASE
                )
                val colonMatch = colonPattern.find(lineText)
                if (colonMatch != null) {
                    val value = colonMatch.groupValues[1].trim()
                    if (value.isNotEmpty()) {
                        return limpiarValor(value)
                    }
                }

                val labelMatch = lineLower == labelLower ||
                    lineLower.startsWith("$labelLower:") ||
                    lineLower == "$labelLower:" ||
                    lineLower == "$labelLower -" ||
                    lineLower == "$labelLower-" ||
                    lineLower.startsWith("$labelLower\t")

                if (labelMatch) {
                    for (j in 1..5) {
                        val nextIdx = i + j
                        if (nextIdx < lines.size) {
                            val nextText = lines[nextIdx].text.trim()
                            if (nextText.isNotEmpty() && nextText.length > 1
                                && !esLabelLine(nextText, labels)) {
                                return limpiarValor(nextText)
                            }
                        }
                    }
                }

                if (lineLower.startsWith("$labelLower ")) {
                    val after = lineText.substring(label.length).trim()
                    if (after.isNotEmpty() && after.length > 1
                        && !esLabelLine(after, labels)) {
                        return limpiarValor(after)
                    }
                }
            }
        }
        return null
    }

    private fun esLabelLine(text: String, labels: List<String>): Boolean {
        val lower = text.lowercase(Locale.ROOT).trim()
        if (lower.length <= 2) return false
        return labels.any {
            lower == it.lowercase(Locale.ROOT)
                || lower.startsWith("${it.lowercase(Locale.ROOT)}:")
                || lower == "${it.lowercase(Locale.ROOT)}:"
        }
    }

    private fun limpiarValor(value: String): String {
        return value.trim()
            .removePrefix(":").removePrefix("-").removePrefix(">").removePrefix("\u2192").trim()
            .removeSuffix(":").removeSuffix("-").trim()
    }

    private fun extractMonto(lines: List<LineInfo>): Double? {
        val montoLabels = listOf("monto transferido", "monto", "total", "transferido")

        for (label in montoLabels) {
            val value = findLabelValue(lines, listOf(label))
            if (value != null) {
                val parsed = parseMonto(value)
                if (parsed != null) return parsed
            }
        }

        val montoLineIndices = mutableListOf<Int>()
        for (i in lines.indices) {
            val lower = lines[i].text.lowercase(Locale.ROOT).trim()
            if (montoLabels.any { lower.startsWith(it) || it.startsWith(lower) }) {
                montoLineIndices.add(i)
            }
        }
        for (idx in montoLineIndices) {
            for (j in 0..4) {
                val checkIdx = idx + j
                if (checkIdx < lines.size) {
                    val parsed = parseMonto(lines[checkIdx].text)
                    if (parsed != null) return parsed
                }
            }
        }

        for (line in lines) {
            if (line.text.contains("$")) {
                val parsed = parseMonto(line.text)
                if (parsed != null) return parsed
            }
        }

        for (line in lines) {
            val parsed = parseMonto(line.text)
            if (parsed != null) return parsed
        }

        return null
    }

    private fun parseMonto(text: String): Double? {
        try {
            val match = montoRegex.find(text)
            if (match != null) {
                val raw = match.groupValues[1]
                if (raw.contains(",") && raw.contains(".")) {
                    val parts = raw.split(",")
                    val integerPart = parts[0].replace(".", "")
                    val decimalPart = parts[1].take(2)
                    return "$integerPart.$decimalPart".toDoubleOrNull()
                }
                val clean = raw.replace(".", "").replace(",", ".")
                val value = clean.toDoubleOrNull()
                if (value != null && value > 0) return value
            }
            val digits = text.replace(Regex("""[^\d]"""), "")
            if (digits.length >= 3 && digits.length <= 9) {
                val value = digits.toDoubleOrNull()
                if (value != null && value > 0) return value
            }
        } catch (_: Exception) {
        }
        return null
    }

    private fun extractFecha(lines: List<LineInfo>): Long? {
        var fechaStr: String? = null
        var horaStr: String? = null

        val fechaValue = findLabelValue(
            lines, listOf("fecha y hora", "fecha/hora", "fecha", "fecha y hora de operacion")
        )
        val horaValue = findLabelValue(lines, listOf("hora", "h0ra"))

        if (fechaValue != null) {
            val combined = fechaValue + " " + (horaValue ?: "")
            val combinedHasTime = horaValue != null
                || timeRegex.containsMatchIn(fechaValue)
                || timeRegexFlex.containsMatchIn(fechaValue)
            if (combinedHasTime) {
                val parsed = parseFechaCompleta(combined.trim())
                if (parsed != null) return parsed
            }

            horaStr = buscarHoraTrasLabelFechaYHora(lines)

            val parsed = parseFechaCompleta(fechaValue)
            if (parsed != null) {
                fechaStr = fechaValue
                if (horaValue != null) horaStr = horaValue
            }
        }

        if (horaValue != null && horaStr == null) {
            horaStr = horaValue
        }

        if (fechaStr != null && horaStr == null) {
            horaStr = buscarHoraEnLineasCercanas(lines)
        }

        if (fechaStr != null && horaStr != null) {
            return parseFechaCompletaConSeparados(fechaStr, horaStr)
        }

        for (line in lines) {
            val text = line.text.trim()
            val dateMatch = dateRegex.find(text)
            if (dateMatch != null) {
                val timeMatch = timeRegex.find(text)
                val foundDate = dateMatch.groupValues[0]
                val foundTime = timeMatch?.groupValues?.get(0)
                if (timeMatch != null) {
                    val parsed = parseFechaCompleta("$foundDate $foundTime")
                    if (parsed != null) return parsed
                }
            }
        }

        if (fechaStr != null) {
            return parseFechaCompleta(fechaStr)
        }

        val dateLine = lines.find { line -> dateRegex.containsMatchIn(line.text) }
        if (dateLine != null) {
            val dateMatch = dateRegex.find(dateLine.text)
            val timeMatch = timeRegex.find(dateLine.text)
            val datePart = dateMatch?.groupValues?.get(0) ?: ""
            val timePart = timeMatch?.groupValues?.get(0) ?: ""
            if (timePart.isEmpty()) {
                val horaCercana = buscarHoraEnLineasCercanas(lines)
                if (horaCercana != null) {
                    val parsed = parseFechaCompleta("$datePart $horaCercana")
                    if (parsed != null) return parsed
                }
            } else {
                val parsed = parseFechaCompleta("$datePart $timePart")
                if (parsed != null) return parsed
            }
        }

        val horaGlobal = buscarHoraGlobal(lines)
        if (horaGlobal != null) {
            val globalDateLine = lines.find { line -> dateRegex.containsMatchIn(line.text) }
                ?: return null
            val dateMatch = dateRegex.find(globalDateLine.text) ?: return null
            val datePart = dateMatch.groupValues[0]
            val parsed = parseFechaCompleta("$datePart $horaGlobal")
            if (parsed != null) return parsed
        }

        return null
    }

    private fun buscarHoraTrasLabelFechaYHora(lines: List<LineInfo>): String? {
        val labels = listOf("fecha y hora", "fecha/hora", "fecha y hora de operacion")
        for (i in lines.indices) {
            val lineLower = lines[i].text.lowercase(Locale.ROOT).trim()
            if (labels.any { lineLower.contains(it) }) {
                var foundDate = false
                for (j in 1..5) {
                    val checkIdx = i + j
                    if (checkIdx >= lines.size) break
                    val checkText = lines[checkIdx].text.trim()
                    if (!foundDate) {
                        if (dateRegex.containsMatchIn(checkText)) {
                            foundDate = true
                            val timeInLine = extraerHoraDeTexto(checkText)
                            if (timeInLine != null) return timeInLine
                        }
                    } else {
                        val time = extraerHoraDeTexto(checkText)
                        if (time != null) return time
                    }
                }
                break
            }
        }
        return null
    }

    private fun buscarHoraEnLineasCercanas(lines: List<LineInfo>): String? {
        for (i in lines.indices) {
            if (dateRegex.containsMatchIn(lines[i].text)) {
                for (offset in 1..5) {
                    for (sign in listOf(1, -1)) {
                        val checkIdx = i + offset * sign
                        if (checkIdx in lines.indices) {
                            val time = extraerHoraDeTexto(lines[checkIdx].text.trim())
                            if (time != null) return time
                        }
                    }
                }
            }
        }
        return null
    }

    private fun buscarHoraGlobal(lines: List<LineInfo>): String? {
        for (line in lines) {
            val time = extraerHoraDeTexto(line.text.trim())
            if (time != null) return time
        }
        return null
    }

    private fun extraerHoraDeTexto(text: String): String? {
        val timeMatch = timeRegex.find(text)
        if (timeMatch != null) {
            var time = timeMatch.groupValues[0]
            if (time.count { it == ':' } == 2) {
                time = time.substringBeforeLast(":")
            }
            return time
        }
        val flexMatch = timeRegexFlex.find(text)
        if (flexMatch != null) {
            val h = flexMatch.groupValues[1]
            val m = flexMatch.groupValues[2]
            return "$h:$m"
        }
        return null
    }

    private fun parseFechaCompleta(text: String): Long? {
        try {
            val dateMatch = dateRegex.find(text) ?: return null
            val day = dateMatch.groupValues[1].toIntOrNull() ?: return null
            val month = dateMatch.groupValues[2].toIntOrNull() ?: return null
            var year = dateMatch.groupValues[3].toIntOrNull() ?: return null
            if (year < 100) year += 2000
            if (year < 2000) return null

            var timeMatch = timeRegex.find(text)
            if (timeMatch == null) timeMatch = timeRegexFlex.find(text)
            val hour = timeMatch?.groupValues?.get(1)?.toIntOrNull() ?: 0
            val minute = timeMatch?.groupValues?.get(2)?.toIntOrNull() ?: 0
            val second = if (timeMatch?.groupValues?.size != null && timeMatch.groupValues.size >= 4)
                timeMatch.groupValues[3].toIntOrNull() ?: 0 else 0

            val cal = Calendar.getInstance()
            cal.set(Calendar.YEAR, year)
            cal.set(Calendar.MONTH, month - 1)
            cal.set(Calendar.DAY_OF_MONTH, day)
            cal.set(Calendar.HOUR_OF_DAY, hour)
            cal.set(Calendar.MINUTE, minute)
            cal.set(Calendar.SECOND, second)
            cal.set(Calendar.MILLISECOND, 0)
            return cal.timeInMillis
        } catch (_: Exception) {
            return null
        }
    }

    private fun parseFechaCompletaConSeparados(fechaStr: String, horaStr: String): Long? {
        try {
            val dateMatch = dateRegex.find(fechaStr) ?: return null
            val day = dateMatch.groupValues[1].toIntOrNull() ?: return null
            val month = dateMatch.groupValues[2].toIntOrNull() ?: return null
            var year = dateMatch.groupValues[3].toIntOrNull() ?: return null
            if (year < 100) year += 2000
            if (year < 2000) return null

            var timeMatch = timeRegex.find(horaStr)
            if (timeMatch == null) timeMatch = timeRegexFlex.find(horaStr)
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
            return cal.timeInMillis
        } catch (_: Exception) {
            return null
        }
    }

    private fun esExcluidoComoComercio(text: String): Boolean {
        val lower = text.lowercase(Locale.ROOT).trim()
        if (lower.length <= 2) return true
        if (excludeComercio.any { lower.contains(it) }) return true
        if (esLineaNumerica(text)) return true
        if (montoRegex.matches(text.trim())) return true
        if (text.contains("$")) return true
        return false
    }

    private fun esLineaNumerica(text: String): Boolean {
        val digits = text.replace(Regex("""[\s.,%\-/$]"""), "")
        if (digits.length < 3) return false
        val digitCount = text.count { it.isDigit() }
        return digitCount.toFloat() / text.length > 0.6f
    }
}
