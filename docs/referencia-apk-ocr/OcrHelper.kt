package com.eric.finanzas.utils

import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.*

class OcrHelper {

    data class OcrResult(
        val comercio: String?,
        val monto: Double?,
        val fecha: Long?,
        val detalle: String? = null
    )

    private val recognizer: TextRecognizer =
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

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

    private val montoRegex = Regex("""\$?\s*([\d]+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)""")
    private val timeRegex = Regex("""^\d{1,2}:\d{2}(:\d{2})?$""")

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

    fun processBitmap(bitmap: Bitmap, rotation: Int = 0, onResult: (OcrResult) -> Unit, onError: (Exception) -> Unit) {
        val image = InputImage.fromBitmap(bitmap, rotation)
        recognizer.process(image)
            .addOnSuccessListener { visionText ->
                val result = extractFromVisionText(visionText)
                onResult(result)
            }
            .addOnFailureListener { e ->
                onError(e)
            }
    }

    private fun extractFromVisionText(visionText: Text): OcrResult {
        val allBlocks = mutableListOf<BlockInfo>()
        var maxBottom = 0

        for (block in visionText.textBlocks) {
            val blockLines = mutableListOf<LineInfo>()
            var blockBottom = 0
            var blockLeft = Int.MAX_VALUE
            var blockRight = 0
            for (line in block.lines) {
                val box = line.boundingBox
                if (box != null) {
                    val info = LineInfo(
                        text = line.text.trim(),
                        top = box.top,
                        bottom = box.bottom,
                        height = box.height(),
                        left = box.left,
                        right = box.right
                    )
                    blockLines.add(info)
                    if (box.bottom > maxBottom) maxBottom = box.bottom
                    if (box.bottom > blockBottom) blockBottom = box.bottom
                    if (box.left < blockLeft) blockLeft = box.left
                    if (box.right > blockRight) blockRight = box.right
                }
            }
            if (blockLines.isNotEmpty()) {
                allBlocks.add(BlockInfo(
                    lines = blockLines,
                    top = blockLines.minOf { it.top },
                    bottom = blockBottom,
                    left = blockLeft,
                    right = blockRight
                ))
            }
        }

        val allLines = allBlocks.flatMap { it.lines }.sortedBy { it.top }

        val fullText = allLines.joinToString(" | ") { it.text }
        Log.d("OcrHelper", "=== NUEVO PROCESAMIENTO OCR ===")
        Log.d("OcrHelper", "Texto OCR completo: $fullText")

        val transferParser = TransferenciaOcrParser()
        val transferResult = transferParser.detectAndParse(allLines, allBlocks)
        if (transferResult != null) {
            Log.d("OcrHelper", "Tipo detectado: Transferencia")
            Log.d("OcrHelper", "Comercio detectado: ${transferResult.comercio}")
            Log.d("OcrHelper", "Monto detectado: ${transferResult.monto}")
            Log.d("OcrHelper", "Fecha detectada: ${transferResult.fecha}")
            return OcrResult(
                comercio = transferResult.comercio,
                monto = transferResult.monto,
                fecha = transferResult.fecha,
                detalle = transferResult.detalle
            )
        }

        Log.d("OcrHelper", "Tipo detectado: Compra")

        if (detectarFormatoEtiquetas(allLines)) {
            Log.d("OcrHelper", "Usando extracción por etiquetas")
            return extraerConEtiquetas(allLines)
        }

        Log.d("OcrHelper", "Usando extracción genérica de compra/pago")
        return extraerCompraOPago(allLines, allBlocks, maxBottom)
    }

    private fun detectarFormatoEtiquetas(allLines: List<LineInfo>): Boolean {
        val labels = setOf("monto", "fecha", "hora", "comercio")
        val found = allLines.count { line ->
            val t = line.text.lowercase(Locale.ROOT).trim()
            t in labels
        }
        return found >= 3
    }

    private fun extraerConEtiquetas(allLines: List<LineInfo>): OcrResult {
        var monto: Double? = null
        var comercio: String? = null
        var fecha: Long? = null
        var fechaStr: String? = null
        var horaStr: String? = null

        for (i in allLines.indices) {
            val text = allLines[i].text.lowercase(Locale.ROOT).trim()
            val nextIdx = i + 1
            if (nextIdx >= allLines.size) continue

            when (text) {
                "monto" -> {
                    monto = parseMontoDeLinea(allLines[nextIdx].text)
                }
                "fecha" -> {
                    fechaStr = allLines[nextIdx].text.trim()
                    if (horaStr == null) {
                        val timeIdx = nextIdx + 1
                        if (timeIdx < allLines.size) {
                            val nextText = allLines[timeIdx].text.trim()
                            val timeMatch = timeRegex.find(nextText)
                            if (timeMatch != null) {
                                horaStr = timeMatch.groupValues[0]
                            }
                        }
                    }
                }
                "hora" -> {
                    horaStr = allLines[nextIdx].text.trim()
                }
                "comercio" -> {
                    comercio = allLines[nextIdx].text.trim()
                }
            }
        }

        if (fechaStr != null) {
            fecha = parseFechaCompleta(fechaStr!!, horaStr)
        }

        return OcrResult(comercio, monto, fecha)
    }

    private fun parseMontoDeLinea(text: String): Double? {
        val match = montoRegex.find(text)
        if (match != null) {
            val raw = match.groupValues[1]
            val clean = raw.replace(".", "").replace(",", ".")
            return clean.toDoubleOrNull()
        }
        return text.replace(Regex("""[^0-9]"""), "").toDoubleOrNull()
    }

    private fun parseFechaCompleta(fechaStr: String, horaStr: String?): Long? {
        try {
            var datePart = fechaStr.trim()
            if (datePart.contains("/")) {
                val parts = datePart.split("/")
                if (parts.size == 3) {
                    val day = parts[0].toIntOrNull() ?: return null
                    val month = parts[1].toIntOrNull() ?: return null
                    val year = parts[2].toIntOrNull() ?: return null
                    var hour = 0
                    var minute = 0

                    if (horaStr != null) {
                        val timeMatch = Regex("""(\d{1,2}):(\d{2})""").find(horaStr)
                        if (timeMatch != null) {
                            hour = timeMatch.groupValues[1].toIntOrNull() ?: 0
                            minute = timeMatch.groupValues[2].toIntOrNull() ?: 0
                        }
                    }

                    val cal = Calendar.getInstance()
                    cal.set(Calendar.YEAR, year)
                    cal.set(Calendar.MONTH, month - 1)
                    cal.set(Calendar.DAY_OF_MONTH, day)
                    cal.set(Calendar.HOUR_OF_DAY, hour)
                    cal.set(Calendar.MINUTE, minute)
                    cal.set(Calendar.SECOND, 0)
                    cal.set(Calendar.MILLISECOND, 0)
                    return cal.timeInMillis
                }
            }
        } catch (_: Exception) {
        }
        return null
    }

    private fun esLineaNumerica(text: String): Boolean {
        val digits = text.replace(Regex("""[\s.,%\-/]"""), "")
        if (digits.length < 2) return false
        val digitCount = text.count { it.isDigit() }
        return digitCount.toFloat() / text.length > 0.6f
    }

    private fun esLineaStatusBar(text: String): Boolean {
        val lower = text.lowercase(Locale.ROOT)
        val statusWords = listOf("lte", "wifi", "4g", "5g", "3g", "edge", "gprs", "battery", "notificaciones")
        return text.length <= 5 && (statusWords.any { lower.contains(it) } || text.all { it.isDigit() || it.isLetter() })
    }

    private fun parseFechaLínea(line: String): Long? {
        try {
            val dateRegex = Regex(
                """(?:(\d{1,2})\s+(?:\S+\s+)?)?([a-zA-Záéíóúñ]+)\s+a\s+las\s+(\d{1,2}):(\d{2})"""
            )
            val match = dateRegex.find(line) ?: return null

            val monthStr = match.groupValues[2].lowercase(Locale.ROOT)
            val month = spanishMonths[monthStr] ?: return null

            val day = match.groupValues[1].toIntOrNull() ?: return null
            val hour = match.groupValues[3].toIntOrNull() ?: return null
            val minute = match.groupValues[4].toIntOrNull() ?: return null

            val cal = Calendar.getInstance()
            cal.set(Calendar.DAY_OF_MONTH, day)
            cal.set(Calendar.MONTH, month)
            cal.set(Calendar.HOUR_OF_DAY, hour)
            cal.set(Calendar.MINUTE, minute)
            cal.set(Calendar.SECOND, 0)
            cal.set(Calendar.MILLISECOND, 0)

            return cal.timeInMillis
        } catch (_: Exception) {
            return null
        }
    }

    private fun extraerCompraOPago(
        allLines: List<LineInfo>,
        allBlocks: MutableList<BlockInfo>,
        imageHeight: Int
    ): OcrResult {
        val statusBarThreshold = (imageHeight * 0.08f).toInt().coerceIn(50, 100)
        allBlocks.sortBy { it.top }

        var monto: Double? = null
        var montoBlock: BlockInfo? = null
        var fecha: Long? = null

        for (block in allBlocks) {
            if (monto == null) {
                for (line in block.lines) {
                    val parsed = parseMontoFromLine(line.text)
                    if (parsed != null && parsed > 0) {
                        monto = parsed
                        montoBlock = block
                        break
                    }
                }
            }
            if (fecha == null) {
                for (line in block.lines) {
                    if (line.text.contains("a las", ignoreCase = true)) {
                        fecha = parseFechaLínea(line.text)
                    }
                }
            }
        }

        val comercio = extractComercioCompra(allBlocks, statusBarThreshold, montoBlock)

        val allText = allLines.joinToString(" | ") { it.text }
        Log.d("OcrHelper", "=== EXTRACCIÓN COMPRA ===")
        Log.d("OcrHelper", "Texto OCR completo: $allText")
        Log.d("OcrHelper", "Monto detectado: $monto (bloque: '${montoBlock?.lines?.joinToString(" ") { it.text }}')")
        Log.d("OcrHelper", "Fecha detectada (timestamp): $fecha")
        Log.d("OcrHelper", "Comercio detectado: $comercio")

        return OcrResult(comercio, monto, fecha)
    }

    private fun extractComercioCompra(
        allBlocks: List<BlockInfo>,
        statusBarThreshold: Int,
        montoBlock: BlockInfo?
    ): String? {
        if (montoBlock == null) return null

        val candidates = allBlocks.filter { block ->
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

    private fun parseMontoFromLine(text: String): Double? {
        if (timeRegex.matches(text.trim())) return null

        val patterns = listOf(
            Regex("""(?:Monto|Total|Importe)\s*\$?\s*(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)""", RegexOption.IGNORE_CASE),
            Regex("""\bCLP\s*\$?\s*(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)""", RegexOption.IGNORE_CASE),
            Regex("""\$?\s*(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)""")
        )
        for (pattern in patterns) {
            val match = pattern.find(text)
            if (match != null) {
                val raw = match.groupValues[1]
                val parsed = parseMontoChileno(raw)
                if (parsed != null && parsed > 0) return parsed
            }
        }
        return null
    }

    private fun parseMontoChileno(raw: String): Double? {
        try {
            val hasDot = raw.contains(".")
            val hasComma = raw.contains(",")

            if (hasDot && hasComma) {
                val lastCommaIdx = raw.lastIndexOf(",")
                val integerPart = raw.substring(0, lastCommaIdx).replace(".", "")
                val decimalPart = raw.substring(lastCommaIdx + 1).take(2)
                return "$integerPart.$decimalPart".toDoubleOrNull()
            } else if (hasComma) {
                val parts = raw.split(",")
                if (parts.size == 2 && parts[1].length <= 2) {
                    return raw.replace(",", ".").toDoubleOrNull()
                } else {
                    return raw.replace(",", "").toDoubleOrNull()
                }
            } else if (hasDot) {
                return raw.replace(".", "").toDoubleOrNull()
            } else {
                return raw.toDoubleOrNull()
            }
        } catch (_: Exception) {
            return null
        }
    }

    private fun esLineaMonetaria(text: String): Boolean {
        if (text.contains("$")) return true
        if (Regex("""\bCLP\s*\$?\s*\d""", RegexOption.IGNORE_CASE).containsMatchIn(text)) return true
        if (Regex("""^(Monto|Total|Importe)\b""", RegexOption.IGNORE_CASE).containsMatchIn(text)) return true
        if (Regex("""^\$?\s*[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\s*$""").matches(text.trim())) return true
        return false
    }

    private fun pareceContenerMonto(text: String): Boolean {
        if (text.contains("$")) return true
        if (Regex("""\bCLP\s*\d""", RegexOption.IGNORE_CASE).containsMatchIn(text)) return true
        if (Regex("""^\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?$""").containsMatchIn(text.trim())) return true
        return false
    }

    private fun buscarComercioFallback(allLines: List<LineInfo>): String? {
        for (line in allLines) {
            val text = line.text.trim()
            if (text.length > 3 &&
                !esLineaMonetaria(text) &&
                !esLineaStatusBar(text) &&
                !timeRegex.matches(text) &&
                !esLineaNumerica(text)
            ) {
                return text
            }
        }
        return null
    }

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
    )

    @Deprecated("Usar OcrManager en lugar de OcrHelper directamente")
    fun extractFromVisionTextFallback(visionText: Text): OcrResult {
        return extractFromVisionText(visionText)
    }

    fun release() {
        recognizer.close()
    }
}
