/// <reference path="../pb_data/types.d.ts" />

// Mueve la definición del Authorization esperado DENTRO del middleware
// o decláralo como 'const' global fuera de cualquier función si se comparte
// entre múltiples middlewares o lógicas. Por simplicidad y asegurar scope, lo ponemos dentro.
const userAgentMiddleware = (e) => {
    // Definimos la cadena exacta del Authorization aquí, dentro del scope del middleware
const EXPECTED_USER_AGENT = "YOUR_SECRET_KEY_PLACEHOLDER";
    const userAgent = e.request.header.get("Authorization");

    if (userAgent === EXPECTED_USER_AGENT) {
        e.next();
    } else {
        // console.warn(`[PaymentStatus Hook] Acceso denegado: Authorization inesperado '${userAgent}'.`);
        throw new ForbiddenError("Unauthorized.");
    }
};

// Esta función registrará el nuevo endpoint
function registerPaymentStatusEndpoint() {
    routerAdd(
        "POST",
        "/server/payment-status", // Cambié la ruta de "/server/payment-status" a "/api/v1/payment-status" para estandarizar
        (e) => {
            let responseMessage = "OK";

            try {
                // Manteniendo la forma de extraer el body que prefieres
                // // console.log(toString(e.request.body)); // Esto es para depuración del cuerpo crudo
                const requestBody = e.requestInfo().body; // Obtiene el cuerpo parseado como un objeto
                // console.log(`[PaymentStatus Hook] Solicitud POST recibida:`, JSON.stringify(requestBody)); // Esto es para depuración del cuerpo crudo
                
                const monto = requestBody.monto;
                const estatus = requestBody.estatus; // "rechazado" o "Completado"
                const folio = requestBody.folio;
                const fecha = requestBody.fecha;
                const motivo_rechazo = requestBody.motivo_rechazo;
                const email = requestBody.email;
                let phone = requestBody.phone;

                if (!phone && email) {
                    const match = email.match(/\+(.*?)\@/);
                    if (match && match[1]) {
                        phone = match[1];
                        // console.log(`[PaymentStatus Hook] Teléfono parseado del email: ${phone}`);
                    } else {
                        // console.warn(`[PaymentStatus Hook] Email '${email}' no contiene un número de teléfono válido.`);
                    }
                }

                if (!folio || !phone || !estatus) {
                    throw new BadRequestError("Faltan parámetros requeridos: folio, phone o estatus.");
                }

                // Normalizar el estatus si es "rechazado"
                const newStatus = (estatus === "Error") ? "Error" : estatus;
                // console.log(`[PaymentStatus Hook] Estatus de entrada: ${estatus}, Estatus final: ${newStatus}`);


                let userRecord = null;
                try {
                    userRecord = $app.findFirstRecordByData("users", "phone", phone);
                    if (!userRecord) {
                        throw new NotFoundError(`Usuario con teléfono '${phone}' no encontrado.`);
                    }
                    // console.log(`[PaymentStatus Hook] Usuario encontrado: ${userRecord.id}`);
                } catch (userErr) {
                    console.error(`[PaymentStatus Hook] Error buscando usuario: ${userErr.message}`);
                    throw new NotFoundError(`No se encontró un usuario para el teléfono: ${phone}`);
                }

                let transferRecord = null;
                try {
                    const folioString = String(folio);
                    const userIdString = String(userRecord.id);
                    // console.log(`[PaymentStatus Hook] Stringificado folio: ${folioString}, userId: ${userIdString}`);
                    
                    transferRecord = $app.findFirstRecordByFilter(
                        "transfers",
                        "folio = {:folio} && user = {:userId} && status = 'Procesando'",
                        { "folio": folioString, "userId": userIdString }
                    );

                    if (!transferRecord) {
                        throw new NotFoundError(`Transferencia con folio '${folio}' y usuario '${phone}' en estado 'Procesando' no encontrada.`);
                    }
                    // console.log(`[PaymentStatus Hook] Transferencia encontrada: ${transferRecord.id}`);
                } catch (transferErr) {
                    console.error(`[PaymentStatus Hook] Error buscando transferencia: ${transferErr.message}`);
                    throw new NotFoundError(`No se encontró una transferencia en estado -Procesando- para el folio ${folio} y usuario ${phone}.`);
                }

                transferRecord.set("status", newStatus);

                // Corrección: motivo_rechazo debe ser de requestBody.motivo_rechazo
                // console.log(`\n\n[PaymentStatus Hook] Motivo de rechazo: ${motivo_rechazo}\n\n`);
                
                if (newStatus === "Error") {
                    transferRecord.set("status_message", motivo_rechazo || "Rechazo sin motivo especificado.");
                } else {
                    transferRecord.set("status_message", "");
                }

                e.app.save(transferRecord);
                // console.log(`[PaymentStatus Hook] Transferencia ${transferRecord.id} actualizada a estatus: ${newStatus}`);

                responseMessage = `Transferencia actualizada a estatus -${newStatus}-`;
                return e.json(200, { success: true, message: responseMessage });

            } catch (err) {
                console.error(`[PaymentStatus Hook] Error procesando solicitud:`, err.message || err.toString());
                return new BadRequestError((err.message), err.statusCode || 500);
            }
        },
        userAgentMiddleware // <-- Nuestro middleware de Authorization
    );
}

module.exports = {
    registerPaymentStatusEndpoint
};