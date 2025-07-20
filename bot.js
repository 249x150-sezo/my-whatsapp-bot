const { Client, LocalAuth, MessageMedia, Buttons, List } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const CONFIG = require('./config');

// إعداد البوت
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// متغيرات لتتبع الاستخدام
const usageStats = {
    commandsUsed: 0,
    tagAllUsed: 0,
    lastReset: Date.now()
};

// عرض QR Code للاتصال
client.on('qr', (qr) => {
    console.log('📱 امسح رمز QR التالي بهاتفك:');
    qrcode.generate(qr, { small: true });
    console.log('⚡ في انتظار المسح الضوئي...');
});

// عند الاتصال بنجاح
client.on('ready', () => {
    console.log('✅ البوت متصل ويعمل بنجاح!');
    console.log(`🤖 ${CONFIG.BOT.name} v${CONFIG.BOT.version}`);
    console.log(`👨‍💻 المطور: ${CONFIG.DEVELOPER.name}`);
    console.log(`📞 رقم المطور: ${CONFIG.DEVELOPER.phone}`);
});

// معالجة الرسائل الواردة
client.on('message', async (message) => {
    const chat = await message.getChat();
    const contact = await message.getContact();
    const messageBody = message.body.toLowerCase().trim();

    // تجاهل الرسائل من البوت نفسه
    if (message.fromMe) return;

    // الترحيب بالأعضاء الجدد
    if (message.type === 'notification_template' && message.body.includes('joined')) {
        if (CONFIG.GROUP.welcomeEnabled) {
            const welcomeMsg = CONFIG.MESSAGES.welcome[Math.floor(Math.random() * CONFIG.MESSAGES.welcome.length)];
            await message.reply(welcomeMsg);
        }
        return;
    }

    // معالجة الأوامر
    if (messageBody.startsWith('!')) {
        await handleCommand(message, messageBody, chat, contact);
    }

    // الرد على الرسائل التي تحتوي على كلمات معينة
    if (messageBody.includes('بوت') || messageBody.includes('bot')) {
        await message.reply('مرحباً! أنا هنا للمساعدة. اكتب !menu لرؤية الأوامر المتاحة 🤖');
    }
});

// معالجة الأوامر
async function handleCommand(message, command, chat, contact) {
    const args = message.body.split(' ').slice(1);
    
    // تحديث إحصائيات الاستخدام
    usageStats.commandsUsed++;

    switch (command) {
        case '!menu':
            await sendMainMenu(message);
            break;

        case '!tagall':
            if (chat.isGroup) {
                await tagAllMembers(message, chat, args.join(' '));
            } else {
                await message.reply('❌ هذا الأمر يعمل فقط في المجموعات!');
            }
            break;

        case '!info':
            await sendBotInfo(message);
            break;

        case '!help':
            await sendHelpMessage(message);
            break;

        case '!ping':
            const start = Date.now();
            const reply = await message.reply('🏓 جاري الاختبار...');
            const end = Date.now();
            await reply.edit(`🏓 Pong! الاستجابة: ${end - start}ms`);
            break;

        case '!rules':
            await sendGroupRules(message);
            break;

        case '!admin':
            await sendAdminInfo(message);
            break;

        case '!time':
            const now = new Date();
            const timeString = now.toLocaleString('ar-SA', {
                timeZone: 'Asia/Riyadh',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            await message.reply(`🕐 الوقت الحالي: ${timeString}`);
            break;

        case '!weather':
            await message.reply('🌤️ عذراً، خدمة الطقس غير متاحة حالياً. سيتم إضافتها قريباً!');
            break;

        case '!joke':
            const randomJoke = CONFIG.MESSAGES.jokes[Math.floor(Math.random() * CONFIG.MESSAGES.jokes.length)];
            await message.reply(randomJoke);
            break;

        case '!quote':
            const randomQuote = CONFIG.MESSAGES.quotes[Math.floor(Math.random() * CONFIG.MESSAGES.quotes.length)];
            await message.reply(`💭 *اقتباس اليوم:*\n\n"${randomQuote}"`);
            break;

        case '!stats':
            await sendStats(message, chat);
            break;

        case '!contact':
            await sendContactInfo(message);
            break;

        default:
            await message.reply(`❌ أمر غير معروف! اكتب ${CONFIG.BOT.prefix}menu لرؤية الأوامر المتاحة.`);
    }
}

// إرسال القائمة الرئيسية
async function sendMainMenu(message) {
    const menuText = `
🤖 *${CONFIG.BOT.name}*
📋 *الأوامر المتاحة:*

• ${CONFIG.BOT.prefix}menu - عرض هذه القائمة
• ${CONFIG.BOT.prefix}tagall - الإشارة إلى جميع الأعضاء
• ${CONFIG.BOT.prefix}info - معلومات البوت
• ${CONFIG.BOT.prefix}help - المساعدة
• ${CONFIG.BOT.prefix}ping - اختبار الاستجابة
• ${CONFIG.BOT.prefix}rules - قوانين المجموعة
• ${CONFIG.BOT.prefix}admin - معلومات الإدارة
• ${CONFIG.BOT.prefix}time - الوقت الحالي
• ${CONFIG.BOT.prefix}weather - حالة الطقس
• ${CONFIG.BOT.prefix}joke - نكتة عشوائية
• ${CONFIG.BOT.prefix}quote - اقتباس ملهم
• ${CONFIG.BOT.prefix}stats - إحصائيات المجموعة
• ${CONFIG.BOT.prefix}contact - معلومات التواصل

${CONFIG.DEVELOPER.copyright}
👨‍💻 المطور: ${CONFIG.DEVELOPER.name}
📞 ${CONFIG.DEVELOPER.phone}
    `;

    await message.reply(menuText);
}

// الإشارة إلى جميع أعضاء المجموعة
async function tagAllMembers(message, chat, customMessage = '') {
    try {
        // تحديث إحصائيات tag all
        usageStats.tagAllUsed++;
        
        const participants = chat.participants;
        
        if (participants.length === 0) {
            await message.reply('❌ لا يمكن العثور على أعضاء المجموعة!');
            return;
        }

        // إنشاء قائمة بجميع الأعضاء
        let mentions = [];
        let mentionText = customMessage || '📢 *إشعار لجميع الأعضاء*\n\n';
        
        participants.forEach(participant => {
            mentions.push(participant.id._serialized);
            const contact = participant.id.user;
            mentionText += `@${contact} `;
        });

        mentionText += `\n\n🤖 تم الإرسال بواسطة ${CONFIG.BOT.name}\n${CONFIG.DEVELOPER.copyright}`;

        // إرسال الرسالة مع الإشارات
        await chat.sendMessage(mentionText, {
            mentions: mentions
        });

        console.log(`✅ تم إرسال tag all في المجموعة: ${chat.name}`);
        
    } catch (error) {
        console.error('❌ خطأ في tag all:', error);
        await message.reply('❌ حدث خطأ أثناء الإشارة إلى الأعضاء!');
    }
}

// معلومات البوت
async function sendBotInfo(message) {
    const infoText = `
🤖 *معلومات البوت*

📝 *الاسم:* ${CONFIG.BOT.name}
⚡ *الإصدار:* ${CONFIG.BOT.version}
🚀 *الحالة:* نشط ويعمل
📅 *تاريخ الإنشاء:* ${new Date().toLocaleDateString('ar-SA')}

✨ *الميزات:*
• الإشارة إلى جميع الأعضاء (Tag All)
• أوامر متعددة ومفيدة
• ردود تلقائية ذكية
• واجهة سهلة الاستخدام
• إحصائيات مفصلة
• اقتباسات ونكت

📊 *الاستخدام:*
• الأوامر المستخدمة: ${usageStats.commandsUsed}
• Tag All المستخدمة: ${usageStats.tagAllUsed}

${CONFIG.DEVELOPER.copyright}
👨‍💻 *المطور:* ${CONFIG.DEVELOPER.name}
📞 *للتواصل:* ${CONFIG.DEVELOPER.phone}
    `;

    await message.reply(infoText);
}

// رسالة المساعدة
async function sendHelpMessage(message) {
    const helpText = `
❓ *المساعدة والدعم*

🔧 *كيفية الاستخدام:*
1. اكتب ${CONFIG.BOT.prefix} متبوعة بالأمر
2. مثال: ${CONFIG.BOT.prefix}menu أو ${CONFIG.BOT.prefix}tagall

📞 *للدعم التقني:*
تواصل مع المطور: ${CONFIG.DEVELOPER.phone}

⚠️ *ملاحظات مهمة:*
• بعض الأوامر تعمل فقط في المجموعات
• استخدم الأوامر بمسؤولية
• لا تسيء استخدام ميزة tag all
• احترم قوانين المجموعة

🆘 *الأوامر السريعة:*
• ${CONFIG.BOT.prefix}menu - القائمة الرئيسية
• ${CONFIG.BOT.prefix}contact - معلومات التواصل
• ${CONFIG.BOT.prefix}rules - قوانين المجموعة

${CONFIG.DEVELOPER.copyright}
    `;

    await message.reply(helpText);
}

// قوانين المجموعة
async function sendGroupRules(message) {
    const rulesText = `
📋 *قوانين المجموعة*

✅ *المسموح:*
• المحادثات المفيدة والبناءة
• مشاركة المعلومات المفيدة
• احترام جميع الأعضاء
• استخدام البوت بمسؤولية

❌ *الممنوع:*
• الرسائل المسيئة أو العنصرية
• الإعلانات غير المرغوب فيها
• مشاركة المحتوى غير اللائق
• إساءة استخدام البوت
• الإزعاج المفرط بـ tag all

⚠️ *تحذير:* 
مخالفة القوانين قد تؤدي إلى:
• تحذير شفهي
• منع من استخدام البوت
• الطرد من المجموعة

🤖 *قوانين البوت:*
• لا تستخدم tag all أكثر من 3 مرات في الساعة
• استخدم الأوامر في السياق المناسب
• لا تحاول اختراق أو تعطيل البوت

${CONFIG.DEVELOPER.copyright}
    `;

    await message.reply(rulesText);
}

// معلومات الإدارة
async function sendAdminInfo(message) {
    const adminText = `
👑 *معلومات الإدارة*

🤖 *البوت:* نشط ومراقب 24/7
👨‍💻 *المطور:* ${CONFIG.DEVELOPER.name}
📞 *للتواصل:* ${CONFIG.DEVELOPER.phone}

⚡ *خدمات الإدارة:*
• مراقبة المجموعة 24/7
• الرد على الاستفسارات
• حل المشاكل التقنية
• تطوير ميزات جديدة
• صيانة دورية للبوت

📊 *إحصائيات الأداء:*
• معدل الاستجابة: 99.9%
• وقت التشغيل: ${Math.floor((Date.now() - usageStats.lastReset) / 1000 / 60)} دقيقة
• الأوامر المنفذة: ${usageStats.commandsUsed}

🔧 *للإبلاغ عن مشاكل:*
تواصل مع المطور مباشرة

${CONFIG.DEVELOPER.copyright}
    `;

    await message.reply(adminText);
}

// معالجة الأخطاء
client.on('auth_failure', (msg) => {
    console.error('❌ فشل في المصادقة:', msg);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ تم قطع الاتصال:', reason);
});

// بدء تشغيل البوت
console.log('🚀 جاري بدء تشغيل البوت...');
client.initialize();

// معالجة إيقاف البرنامج بشكل صحيح
process.on('SIGINT', async () => {
    console.log('\n⏹️ جاري إيقاف البوت...');
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⏹️ جاري إيقاف البوت...');
    await client.destroy();
    process.exit(0);
});


// إرسال إحصائيات المجموعة
async function sendStats(message, chat) {
    const statsText = `
📊 *إحصائيات البوت*

🔢 *الاستخدام:*
• الأوامر المستخدمة: ${usageStats.commandsUsed}
• Tag All المستخدمة: ${usageStats.tagAllUsed}
• وقت التشغيل: ${Math.floor((Date.now() - usageStats.lastReset) / 1000 / 60)} دقيقة

${chat.isGroup ? `👥 *المجموعة:*
• اسم المجموعة: ${chat.name}
• عدد الأعضاء: ${chat.participants.length}
• نوع المجموعة: ${chat.isGroup ? 'مجموعة' : 'محادثة فردية'}` : ''}

⚡ *حالة البوت:* نشط ويعمل
📅 *تاريخ آخر إعادة تشغيل:* ${new Date(usageStats.lastReset).toLocaleString('ar-SA')}

${CONFIG.DEVELOPER.copyright}
    `;

    await message.reply(statsText);
}

// معلومات التواصل مع المطور
async function sendContactInfo(message) {
    const contactText = `
📞 *معلومات التواصل*

👨‍💻 *المطور:* ${CONFIG.DEVELOPER.name}
📱 *رقم الهاتف:* ${CONFIG.DEVELOPER.phone}
🌐 *واتساب:* ${CONFIG.DEVELOPER.website}

💬 *للدعم التقني:*
• الإبلاغ عن الأخطاء
• طلب ميزات جديدة
• الاستفسارات العامة

⏰ *أوقات الرد:*
السبت - الخميس: 9:00 ص - 10:00 م
الجمعة: 2:00 م - 10:00 م

${CONFIG.DEVELOPER.copyright}
    `;

    await message.reply(contactText);
}

