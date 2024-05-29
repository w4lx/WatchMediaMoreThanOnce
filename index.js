// Dependencias necesarias.
import {
  makeWASocket,
  useMultiFileAuthState,
  downloadMediaMessage,
  DisconnectReason,
  Browsers,
} from "@whiskeysockets/baileys";
import { fileTypeFromBuffer } from "file-type";
import { createInterface } from "node:readline";
import { keepAlive } from "./keepAlive.js";
import { Boom } from "@hapi/boom";
import pino from "pino";

async function connectToWA() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const browser = Browsers.appropriate("chrome");

  const socket = makeWASocket({
    logger: pino({ level: "silent" }),
    version: [2, 2413, 11],
    mobile: false,
    auth: state,
    browser,
  });

  if (!socket.authState.creds.registered) {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = (input) => {
      return new Promise((resolve) => readline.question(input, resolve));
    };

    const number = await prompt(`Introduce tu número de WhatsApp: `);
    const formatNumber = number.replace(/[\s+-]/g, "");

    const code = await socket.requestPairingCode(formatNumber);

    console.log("Tu código de conexión es:", code);
  }

  // Evento connection.update
  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect.error instanceof Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log(
        "Conexión cerrada debido a",
        lastDisconnect.error + ", reconectando...".red,
        shouldReconnect
      );

      if (shouldReconnect) {
        connectToWA();
      }
    } else if (connection === "open") {
      keepAlive();
      console.log("App ready!");
    }
  });

  // Evento messages.upsert
  socket.ev.on("messages.upsert", async ({ type, messages }) => {
    if (!messages[0]?.message) return;

    if (type !== "notify") return;

    if (messages[0]?.key?.fromMe) return;

    const fileType = Object.keys(messages[0].message)[0];

    console.log(fileType);

    if (
      fileType !== "messageContextInfo" &&
      fileType !== "viewOnceMessageV2" &&
      fileType !== "senderKeyDistributionMessage"
    ) {
      return;
    }

    const options = messages[0]?.message?.viewOnceMessageV2?.message;

    const mediaType = Object.keys(options)[0];

    const data = await downloadMediaMessage(messages[0], "buffer");

    const { mime } = await fileTypeFromBuffer(data);

    let msg = "";

    if (options?.[mediaType]?.caption) {
      msg = options[mediaType].caption + "\n\n";
    }

    if (!mime) return;

    if (!socket?.user?.id) return;

    socket.sendMessage(socket.user.id, {
      [mime.split("/")[0]]: data,
      caption: `${msg}_Enviado por ${messages[0]?.pushName}_`,
    });
  });

  // Evento creds.update
  socket.ev.on("creds.update", saveCreds);
}

// Ejecutamos
await connectToWA();

// Por si hay un error, que no se apague.
process.on("uncaughtException", (error) => console.error(error));

process.on("uncaughtExceptionMonitor", (error) => console.error(error));

process.on("unhandledRejection", (error) => console.error(error));

process.stdin.resume();

/* Code by Walter */
