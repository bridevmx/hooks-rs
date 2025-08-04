/// <reference path="../pb_data/types.d.ts" />

function registerTransferHook() {
    onRecordAfterCreateSuccess((e) => {
        const record = e.record;

        if (record.get("status") === "Espera") {
            console.log(`[Transfers Logic] Nuevo registro en estado "Espera": ${record.id}`);

            const relationsToExpand = ["user", "bank"]; 
            try {
                // expandRecord carga los datos de las relaciones.
                e.app.expandRecord(record, relationsToExpand, null);
                console.log(`[Transfers Logic] Expansión solicitada para ${record.id}: ${relationsToExpand.join(', ')}`);
            } catch (expandError) {
                console.error(`[Transfers Logic] Error al solicitar expansión para record ${record.id}:`, expandError.message);
                // Continúa, el error será manejado si el frontend necesita estos datos y no los recibe.
            }

            const fetchUrl = `http://localhost:5173/hooks/new-transfer`;
            console.log(`[Transfers Logic] Realizando POST a: ${fetchUrl}`);

            try {
                // *** LA CORRECCIÓN FINAL: Usar record.publicExport() ***
                // record.publicExport() devuelve un objeto JavaScript plano del record,
                // incluyendo las propiedades expandidas bajo la clave 'expand'.
                const dataToPost = record.publicExport();

                // Opcional: Verificar que las expansiones estén realmente presentes en el objeto exportado
                if (!dataToPost.expand || !dataToPost.expand.user) {
                    console.warn(`[Transfers Logic] Usuario expandido NO presente en dataToPost.expand para ${record.id}.`);
                }
                if (!dataToPost.expand || !dataToPost.expand.bank) {
                    console.warn(`[Transfers Logic] Banco expandido NO presente en dataToPost.expand para ${record.id}.`);
                }
                
                const requestBody = JSON.stringify(dataToPost); // Stringify el objeto JavaScript plano

                const response = $http.send({
                    url: fetchUrl,
                    method: "POST",
                    timeout: 30,
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: requestBody
                });

                const responseBody = response.json;

                console.log(`[Transfers Logic] Respuesta del fetch recibida:`, JSON.stringify(responseBody));

                if (responseBody && responseBody.success === true) {
                    console.log(`[Transfers Logic] POST exitoso para ${record.id}. Actualizando a "Procesando".`);
                    record.set("status", "Procesando");
                } else {
                    console.log(`[Transfers Logic] POST fallido para ${record.id}. Actualizando a "Error". Mensaje: ${responseBody?.message}`);
                    record.set("status", "Error");
                    record.set("status_message", responseBody?.message || "Error desconocido al procesar la transferencia.");
                }

                e.app.save(record);

            } catch (err) {
                console.error(`[Transfers Logic] Error en la solicitud POST para ${record.id}:`, err.message || err.toString()); 
                record.set("status", "Error");
                record.set("status_message", "Error de comunicación con el servicio externo: " + (err.message || err.toString()));

                e.app.save(record);
            }
        }

        e.next();
    }, "transfers");
}

module.exports = {
    registerTransferHook
};