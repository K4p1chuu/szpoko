const { Client, GatewayIntentBits, Partials, PermissionsBitField, ActivityType } = require('discord.js');
const fetch = require('node-fetch');

// --- Konfiguracja ---
// WAŻNE: Wklej tutaj token swojego bota z Discord Developer Portal
const BOT_TOKEN = 'MTQxMTI2OTA5NDUyNjY4MTExOQ.GGwlEv.jarOYF7VdzXRJCisJH6MfCvx0RaxbIsS_8SsCo';
const API_URL = 'http://localhost:3000/api/sync-citizens';

// NOWA KONFIGURACJA: Wklej tutaj ID swojego serwera i kanału do logów
const GUILD_ID = '1202645184735613029'; // ID serwera, który ma być synchronizowany
const LOG_CHANNEL_ID = '1423690747294519448'; // ID kanału, gdzie bot będzie wysyłał status
// --------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.User],
});

/**
 * Funkcja wykonująca synchronizację członków z serwerem API.
 * @param {import('discord.js').Guild} guild Obiekt serwera do synchronizacji.
 * @param {import('discord.js').TextChannel|null} feedbackChannel Kanał do wysłania odpowiedzi (dla komendy ręcznej).
 */
async function runSync(guild, feedbackChannel = null) {
    if (!guild) {
        console.error("Błąd: Próbowano uruchomić synchronizację bez podania serwera.");
        return;
    }

    const logChannel = feedbackChannel ?? client.channels.cache.get(LOG_CHANNEL_ID);

    try {
        if (feedbackChannel) {
            await feedbackChannel.send('[WSP-MDT] Rozpoczynam synchronizację członków. To może chwilę potrwać...');
        } else {
            console.log(`[${new Date().toLocaleString()}] Rozpoczynam automatyczną synchronizację dla serwera ${guild.name}...`);
        }

        // Pobieranie wszystkich członków
        const allMembers = await guild.members.fetch();

        // Używamy Map, aby automatycznie obsłużyć duplikaty
        const memberMap = new Map();

        allMembers.forEach(member => {
            memberMap.set(member.id, member);
        });

        // POPRAWKA: Jawne pobranie i dodanie właściciela serwera za pomocą jego ID
        try {
            const owner = await guild.members.fetch(guild.ownerId);
            if (owner) {
                memberMap.set(owner.id, owner);
            }
        } catch (err) {
            console.error("Nie udało się pobrać właściciela serwera po ID. Może nie być na liście.", err);
        }
        
        const membersData = [...memberMap.values()].map(m => ({
            discordId: m.id,
            name: m.displayName,
        }));

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(membersData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Błąd API: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const successMessage = `[WSP-MDT] Pomyślnie zsynchronizowano ${result.syncedCount} członków.`;
        
        if (result.success) {
            if (logChannel && !feedbackChannel) await logChannel.send(successMessage);
            else if (feedbackChannel) await feedbackChannel.send(successMessage);
            console.log(`[${new Date().toLocaleString()}] Automatyczna synchronizacja zakończona pomyślnie.`);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Błąd podczas synchronizacji:', error);
        if (logChannel) {
            await logChannel.send(`[WSP-MDT] Wystąpił błąd podczas synchronizacji: ${error.message}`);
        }
    }
}


client.once('ready', async () => {
    console.log(`Bot ${client.user.tag} jest gotowy!`);

    client.user.setActivity('WSP & OCSO', { type: ActivityType.Watching });

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (guild) {
            console.log(`Ustawiono automatyczną synchronizację co godzinę dla serwera: ${guild.name}`);
            await runSync(guild);
            setInterval(() => runSync(guild), 3600 * 1000);
        } else {
            console.error(`Nie mogłem znaleźć serwera o ID: ${GUILD_ID}. Automatyczna synchronizacja nie będzie działać.`);
        }
    } catch (error) {
        console.error(`Nie udało się pobrać serwera o ID ${GUILD_ID}:`, error);
        console.error("Upewnij się, że bot jest na tym serwerze i ID jest poprawne.");
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.startsWith('!sync')) {
        try {
            const member = message.member ?? await message.guild.members.fetch({ user: message.author.id, force: true });
            
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply('Nie masz uprawnień do używania tej komendy.');
            }
            await runSync(message.guild, message.channel);
        } catch (error) {
            console.error('Błąd przy ręcznej komendzie !sync:', error);
            await message.reply(`Wystąpił błąd: ${error.message}`);
        }
    }
});

client.login(BOT_TOKEN);

