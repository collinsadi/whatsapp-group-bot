const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const app = express();
const QRCode = require("qrcode");
const qrcode = require("qrcode-terminal");
const { createServer } = require("http");
const { Server } = require("socket.io");
// const makeWitAiRequest = require('./botLogic');
require("dotenv").config();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "",
    methods: ["GET", "POST"],
  },
});

app.use(express.static("public"));

const client = new Client({
  authStrategy: new LocalAuth(),
  executablePath: "/usr/bin/chromium-browser",
  puppeteer: {
    args: ["--no-sandbox"],
  },
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
});

const queryAi = async (message) => {
  try {
    const response = await fetch(
      "http://localhost:50000/api/ai/prompt?prompt=" + message
    );
    const data = await response.json();

    return data.message;
  } catch (error) {
    console.log(error);
  }
};

client.on("qr", (qr) => {
  console.log("QR RECEIVED", qr);

  // Emit the QR code data to the frontend
  io.emit("qrcode", qr);

  // Convert QR code to base64 image and emit to the frontend
  QRCode.toDataURL(qr, (err, url) => {
    io.emit("qrcode-image", url);
  });

  QRCode.toString(qr, { type: "terminal" }, (err, terminalUrl) => {
    // console.log(terminalUrl);
  });

  qrcode.generate(qr, { small: true }, (url) => {
    console.log(url);
  });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (message) => {
  let chat = await message.getChat();
  const messageBody = message.body;
  // const sender = message.author.split("@")[0];
  const os = message.deviceType;
  const fromMe = message.fromMe;
  const quoted = message.hasQuotedMsg;
  const quotedContent = await message.getQuotedMessage();

  // console.log(messageBody,  os, fromMe, quoted, quotedContent);

  if (chat.isGroup) {
    const messageIsAboutMe = messageBody.startsWith("@[MY_NUMBER]"); // [MY_NUMBER] is an actual number but i dont want to be spamed so i am removing it

    if (messageIsAboutMe) {
      chat.sendSeen();
      await chat.sendStateTyping();

      const response = await queryAi(messageBody);

      return client.sendMessage(message.from, response);
    } else {
      return false;
    }
  }
  chat.sendSeen();

  await chat.sendStateTyping();

  const response = `You said: ${messageBody}`;

  setTimeout(() => {
    client.sendMessage(message.from, response);
  }, 1000);
});

client.initialize();

httpServer.listen(3000, () => {
  console.log("Server Started");
});
