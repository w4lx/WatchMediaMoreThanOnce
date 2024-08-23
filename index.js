// Dependencias necesarias.
import {
  makeWASocket,
  useMultiFileAuthState,
  generateWAMessageFromContent,
  DisconnectReason,
  Browsers,
} from "@whiskeysockets/baileys";
import { createInterface } from "node:readline";
import { keepAlive } from "./keepAlive.js";
import { Boom } from "@hapi/boom";
import pino from "pino";

async function connectToWA() {
  const version = process.versions.node.split(".")[0];

  if (+version < 18) {
    console.log("Necesitas Node.js versión 18 o superior.");
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const browser = Browsers.appropriate("chrome");

  const socket = makeWASocket({
    logger: pino({ level: "silent" }),
    version: [2, 3000, 1015901307],
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

    const { message, key } = messages[0];

    const msgType = Object.keys(messages[0].message)[0];

    const pattern =
      /^(messageContextInfo|senderKeyDistributionMessage|viewOnceMessage(?:V2(?:Extension)?)?)$/;

    if (!pattern.test(msgType)) return;

    const lastKey = Object.keys(message).at(-1);
    if (!/^viewOnceMessage(?:V2(?:Extension)?)?$/.test(lastKey)) return;

    const fileType = Object.keys(message[lastKey].message)[0];

    const options = message[lastKey].message[fileType];
    delete options.viewOnce;

    if (!socket?.user?.id) return;

    const proto = generateWAMessageFromContent(key.remoteJid, message, {});

    socket.relayMessage(socket.user.id, proto.message, {
      messageId: proto.key.id,
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

/* Code by Walter */
