const {
   default: makeWASocket,
   useMultiFileAuthState,
   DisconnectReason,
   fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');

let isActive = false;  // حالة البوت: false = موقوف، true = نشيط
let lastNumber = null;  // لتتبع الرقم الأخير عشان نمنع اللوب

async function startBot() {
   const { state, saveCreds } = await useMultiFileAuthState('auth_info');
   const { version } = await fetchLatestBaileysVersion();

   const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      syncFullHistory: false,
   });

   sock.ev.on('creds.update', saveCreds);

   sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
         console.log('\n📱 QR Code جديد! افتح هذا الرابط لعرض الكود وصوره بالجوال:\n');
         const qrUrl = `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(qr)}`;
         console.log(qrUrl);
         console.log('\n(انسخ الرابط وافتحه في المتصفح، ثم صور الكود من واتساب)\n');
      }

      if (connection === 'close') {
         const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
         console.log('الاتصال انقطع، هل نعيد المحاولة؟', shouldReconnect);
         if (shouldReconnect) {
            startBot();
         }
      } else if (connection === 'open') {
         console.log('✅ البوت متصل بنجاح!');

         try {
            await sock.updateProfileName('Abood Bot 🔥');
            console.log('تم تغيير اسم البوت إلى: Abood Bot 🔥');
         } catch (err) {
            console.log('ما قدرت أغير الاسم:', err.message);
         }
      }
   });

   sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.message) return;

      let text = '';
      if (msg.message.conversation) text = msg.message.conversation.trim();
      else if (msg.message.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text.trim();

      if (text === 'اشتغل') {
         isActive = true;
         await sock.sendMessage(msg.key.remoteJid, { text: '✅ البوت نشط الآن! يرد على الأرقام.' });
         return;
      } else if (text === 'وقف') {
         isActive = false;
         await sock.sendMessage(msg.key.remoteJid, { text: '❌ البوت موقوف الآن. ما يرد على الأرقام.' });
         return;
      }

      if (isActive && /^\d+$/.test(text)) {
         const num = parseInt(text, 10);
         if (num === lastNumber + 1) return;  // تجاهل لو كان رد سابق

         const nextNum = num + 1;
         lastNumber = num;

         await sock.sendMessage(msg.key.remoteJid, { text: nextNum.toString() });
      }
   });
}

startBot();
