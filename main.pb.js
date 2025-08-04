/// <reference path="../pb_data/types.d.ts" />

// Importa la lógica de hooks de transferencia
const transfersLogic = require(`${__hooks}/transfers_logic.js`);
// Importa la lógica del nuevo endpoint de estatus de pago
const paymentStatusLogic = require(`${__hooks}/payment_status_hook.js`); // <-- Nueva importación

// Registra tus hooks llamando a las funciones exportadas
transfersLogic.registerTransferHook();
paymentStatusLogic.registerPaymentStatusEndpoint(); // <-- Nuevo registro

console.log("main.pb.js cargado. Todos los hooks registrados.");

// onBootstrap((e) => {
//     console.log("App initialized from main.pb.js!");
//     e.next();
// });