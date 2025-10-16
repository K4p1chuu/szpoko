const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const fetch = require('node-fetch');
const path = require('path');
const { Client, GatewayIntentBits, Partials, PermissionsBitField, ActivityType } = require('discord.js');
// SUGESTIA: Zainstaluj dotenv: npm install dotenv
// require('dotenv').config();

// --- KONFIGURACJA BOTA ---
// SUGESTIA: Przenieś token do pliku .env -> BOT_TOKEN=TwojToken
const BOT_TOKEN = 'MTQxMTI2OTA5NDUyNjY4MTExOQ.GhjnUi.E-Mhy4TNFpEsS62QD6N8pwjj08EEnm5XpCaeSw'; // process.env.BOT_TOKEN;
const GUILD_ID = '1202645184735613029';
const ROLE_ID = '1253431189314998405';
const LOG_CHANNEL_ID = '1423690747294519448'; // Ta zmienna jest zdefiniowana, ale nieużywana

const app = express();
const port = 3000;

// --- Ścieżki do plików ---
const USERS_FILE_PATH = './db_users.json';
const CITIZENS_FILE_PATH = './db_citizens.json';
const RECORDS_FILE_PATH = './db_records.json';
const ANNOUNCEMENTS_FILE_PATH = './db_announcements.json';
const NOTES_FILE_PATH = './db_notes.json';
const CHAT_FILE_PATH = './db_chat.json';
const DIVISIONS_FILE_PATH = './db_divisions.json';
const BOLO_FILE_PATH = './db_bolo.json';
const VEHICLES_FILE_PATH = './db_vehicles.json';
const LEAVES_FILE_PATH = './db_leaves.json';
const DIAGNOSTICIANS_FILE_PATH = './db_diagnosticians.json';
const IMPOUND_FILE_PATH = './db_impound.json';
const SUSPENDED_LICENSES_FILE_PATH = './db_suspended_licenses.json';
const DUTY_HOURS_FILE_PATH = './db_duty_hours.json';
const ACTIVE_DUTY_SESSIONS_FILE_PATH = './db_active_duty.json';

// --- Webhooki ---
// SUGESTIA: Przenieś wszystkie webhooki do pliku .env
const TICKET_WEBHOOK_URL = 'https://discord.com/api/webhooks/1415072043858399394/6bYM_3C5rG2rWO-2hDfC63AC26eHHo9aCaojTXen9KBEE3x-OsInFHbiH1BA25hN5T7E';
const ARREST_WEBHOOK_URL = 'https://discord.com/api/webhooks/1414669238706245732/GLzu0BuHd2SFpuT2eX8hdSQ7NNtVHRH4B_Xed9MSbYMAgSxLiv780DBoHKBQ5lwDuxxO';
const REPORT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1416718275512897587/M1etNa1iXF-I-OzVwNCYo-dZwa7A31vxOVumGZRtdo0j8jFgaGZ-mxSPxWBPfELFdD2t';
const VEHICLE_INSPECTION_WEBHOOK_URL = 'https://discord.com/api/webhooks/1413686917643501639/YOBjHaSmr4wmzMaKwZCdAfT1gaxcFOsRwGIQicxDAwP1y54ktqpi37hEVyTMZK9b1_rR';
const IMPOUND_WEBHOOK_URL = 'https://discord.com/api/webhooks/1421157864654766121/s0kM1PJ-bAin5awm0qjdyvbdBczMZcVMcEk1XVpjOv3GKOMBNvusIQZ4vBQTOTOeWOku';
const SUSPENDED_LICENSE_WEBHOOK_URL = 'https://discord.com/api/webhooks/1421209532490584187/_N6RsxZGlONA5N9Ttjd66izdAzU7cvelX9f4pTmRd12NHcmptgvVF3w6zWgR5HnjOhSo';
const BOLO_WEBHOOK_URL = 'https://discord.com/api/webhooks/123456789/placeholder'; // ZASTĄP PRAWDZIWYM WEBHOOKIEM

// --- Bazy danych w pamięci ---
let users = {}, citizens = {}, records = {}, announcements = [], notes = {}, chatMessages = [], divisions = {}, bolo = [], vehicles = {}, leaves = [], diagnosticians = [], impound = [], suspendedLicenses = [];
let dutyHours = {};
let activeDutySessions = {};
let roleTimers = {};

// --- Konfiguracja rang (od najwyższej do najniższej) ---
const RANKS = {
    WSP: [ 'Superintendent', 'Deputy Chief Superintendent', 'Colonel', 'Lieutenant Colonel', 'Major', 'Captain', 'Lieutenant', 'Sergeant', 'Master Trooper', 'Trooper First Class', 'Trooper', 'Probationary Trooper' ],
    OCSO: [ 'Sheriff', 'Undersheriff', 'Colonel', 'Major', 'Captain', 'Lieutenant Colonel', 'Lieutenant', 'Staff Sergeant', 'Sergeant', 'Corporal', 'Deputy', 'Probationary Deputy' ]
};

// --- KLIENT DISCORDA ---
const client = new Client({
    intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers ],
    partials: [ Partials.GuildMember, Partials.User ],
});


// --- Funkcje pomocnicze ---
function loadDatabase() {
    const loadFile = (path, defaultValue) => {
        if (!fs.existsSync(path)) {
            saveData(path, defaultValue);
            return defaultValue;
        }
        try {
            const data = fs.readFileSync(path, 'utf-8');
            if (data.trim() === '') {
                saveData(path, defaultValue);
                return defaultValue;
            }
            return JSON.parse(data);
        } catch (error) {
            console.error(`Błąd wczytywania lub parsowania pliku ${path}. Plik został uszkodzony. Tworzenie nowego pliku. Błąd: ${error.message}`);
            // SUGESTIA: Zamiast usuwać plik, zmień jego nazwę, aby można było odzyskać dane.
            // fs.renameSync(path, `${path}.bak`);
            fs.unlinkSync(path);
            saveData(path, defaultValue);
            return defaultValue;
        }
    };
    
    // SUGESTIA: Zmień hasło 'admin' na hashowane.
    users = loadFile(USERS_FILE_PATH, { 'admin@wsp.gov': { id: 'admin', email: 'admin@wsp.gov', username: 'Administrator', password: 'admin', badge: '000', rank: 'Superintendent', department: 'WSP', isAdmin: true, token: null }});
    citizens = loadFile(CITIZENS_FILE_PATH, {});
    records = loadFile(RECORDS_FILE_PATH, {});
    announcements = loadFile(ANNOUNCEMENTS_FILE_PATH, []);
    notes = loadFile(NOTES_FILE_PATH, {});
    chatMessages = loadFile(CHAT_FILE_PATH, []);
    vehicles = loadFile(VEHICLES_FILE_PATH, {});
    leaves = loadFile(LEAVES_FILE_PATH, []);
    diagnosticians = loadFile(DIAGNOSTICIANS_FILE_PATH, []);
    impound = loadFile(IMPOUND_FILE_PATH, []);
    suspendedLicenses = loadFile(SUSPENDED_LICENSES_FILE_PATH, []);
    dutyHours = loadFile(DUTY_HOURS_FILE_PATH, {});
    activeDutySessions = loadFile(ACTIVE_DUTY_SESSIONS_FILE_PATH, {});
    
    bolo = loadFile(BOLO_FILE_PATH, []);
    let dataWasModified = false;
    bolo.forEach(entry => {
        if (!entry.id) {
            entry.id = crypto.randomUUID();
            dataWasModified = true;
        }
    });
    if (dataWasModified) {
        console.log('Naprawiono brakujące ID w pliku BOLO. Zapisywanie...');
        saveData(BOLO_FILE_PATH, bolo);
    }

    const defaultDivisions = { 
        WSP: { "K-9 CANINE": { lead: [], members: [] }, "Special Response Team": { lead: [], members: [] }, "Speed Enforcement Unit": { lead: [], members: [] }, "Traffic Service Unit": { lead: [], members: [] }, "Detective Task Unit": { lead: [], members: [] } },
        OCSO: { "Highway Patrol": { lead: [], members: [] }, "K-9 CANINE": { lead: [], members: [] }, "Special Emergency Response Team": { lead: [], members: [] }, "Special Investigation Unit": { lead: [], members: [] } }
    };
    
    let loadedDivisions = loadFile(DIVISIONS_FILE_PATH, defaultDivisions);
    if (!loadedDivisions || !loadedDivisions.WSP || !loadedDivisions.OCSO) {
        console.log("Struktura dywizji jest nieprawidłowa lub pusta. Resetowanie do domyślnych wartości.");
        const oldDivisionsData = { ...loadedDivisions };
        loadedDivisions = defaultDivisions;
        if (Object.keys(oldDivisionsData).length > 0 && !oldDivisionsData.WSP) {
            loadedDivisions.WSP = oldDivisionsData;
        }
        saveData(DIVISIONS_FILE_PATH, loadedDivisions);
    }
    divisions = loadedDivisions;

    console.log('Bazy danych załadowane.');
}

function saveData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Błąd zapisu do ${filePath}:`, error);
    }
}

// --- SEKcja: Funkcje do zarządzania rolami ---
async function manageRole(userId, action) {
    if (ROLE_ID === 'ID_ROLI_BRAK_PRAWA_JAZDY') { // Check placeholder
        console.warn('Nie ustawiono ID roli. Operacja na rolach zostanie pominięta.');
        return;
    }
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        if (!member) {
            console.log(`Nie znaleziono członka o ID ${userId} na serwerze.`);
            return;
        }

        if (action === 'add') {
            await member.roles.add(ROLE_ID);
            console.log(`Nadano rolę użytkownikowi ${member.user.tag}`);
        } else if (action === 'remove') {
            await member.roles.remove(ROLE_ID);
            console.log(`Zabrano rolę użytkownikowi ${member.user.tag}`);
        }
    } catch (error) {
        console.error(`Nie udało się ${action === 'add' ? 'nadać' : 'zabrać'} roli użytkownikowi ${userId}:`, error.message);
    }
}

function scheduleRoleRemoval(suspensionId, userId, expirationDate) {
    const now = new Date();
    const delay = new Date(expirationDate).getTime() - now.getTime();

    if (delay > 0) {
        if (roleTimers[suspensionId]) {
            clearTimeout(roleTimers[suspensionId]);
        }
        roleTimers[suspensionId] = setTimeout(async () => {
            console.log(`Czas upłynął. Próba usunięcia roli dla ID: ${userId}`);
            await manageRole(userId, 'remove');
            suspendedLicenses = suspendedLicenses.filter(s => s.id !== suspensionId);
            saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
            delete roleTimers[suspensionId];
        }, delay);
        console.log(`Zaplanowano usunięcie roli dla ${userId} za ${Math.round(delay / 1000 / 60)} minut.`);
    } else {
        console.log(`Czas dla ${userId} już upłynął. Natychmiastowe usuwanie roli.`);
        manageRole(userId, 'remove');
    }
}

function restoreRoleTimers() {
    const now = new Date().getTime();
    const activeSuspensions = suspendedLicenses.filter(s => new Date(s.expiresAt).getTime() > now);
    if(activeSuspensions.length !== suspendedLicenses.length){
        suspendedLicenses = activeSuspensions;
        saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
    }

    console.log(`Odtwarzanie ${activeSuspensions.length} zaplanowanych zadań usunięcia ról...`);
    activeSuspensions.forEach(suspension => {
        scheduleRoleRemoval(suspension.id, suspension.citizenId, suspension.expiresAt);
    });
}


// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ message: 'Brak tokenu' });
    
    let user = Object.values(users).find(u => u.token === token);
    
    if (!user) {
        user = diagnosticians.find(d => d.token === token);
    }

    if (!user) return res.status(401).json({ message: 'Błędny token' });

    if (!user.department && !user.isDiagnostician) {
        user.department = 'WSP';
    }

    req.user = user;
    next();
};

const verifyAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) return res.status(403).json({ message: 'Brak uprawnień admina' });
    next();
};

const verifySenior = (req, res, next) => {
    const user = req.user;
    if (user && (
        user.isAdmin || 
        (user.rank === 'Superintendent' && user.badge === '101') ||
        (user.rank === 'Sheriff')
    )) {
        return next();
    }
    return res.status(403).json({ message: 'Brak uprawnień' });
};

const verifyPayoutAccess = (req, res, next) => {
    const user = req.user;
    if (user && (
        user.isAdmin || 
        (user.rank === 'Superintendent' && user.badge === '101')
    )) {
        return next();
    }
    return res.status(403).json({ message: 'Brak uprawnień do wykonania tej akcji.' });
};

const verifyDiagnosticianLead = (req, res, next) => {
    if (!req.user || !req.user.isDiagnostician || !(req.user.skpNumber && req.user.skpNumber.endsWith('001'))) {
        return res.status(403).json({ message: 'Brak uprawnień naczelnika diagnostyki.' });
    }
    next();
};


// --- Endpointy API ---
app.post('/api/login', (req, res) => {
    if (!req.body) {
        return res.status(400).json({ success: false, message: 'Brak danych logowania w żądaniu.' });
    }

    const { username, password, system } = req.body;
    
    let userPool = system === 'cepik' ? diagnosticians : Object.values(users);
    let user = userPool.find(u => u.email === username);
    
    // SUGESTIA: Zamiast porównywać hasła wprost, użyj bcrypt.compare
    // const passwordMatch = await bcrypt.compare(password, user.password);
    // if (user && passwordMatch) { ... }
    if (user && user.password === password) {
        user.token = crypto.randomBytes(32).toString('hex');
        
        if (system === 'cepik') {
            saveData(DIAGNOSTICIANS_FILE_PATH, diagnosticians);
        } else {
            if (users[username]) {
                users[username].token = user.token;
                saveData(USERS_FILE_PATH, users);
            }
        }
        
        const redirectUrl = system === 'cepik' ? 'cepik.html' : 'dashboard.html';
        res.json({ success: true, token: user.token, redirect: redirectUrl });
    } else {
        res.status(401).json({ success: false, message: 'Nieprawidłowe dane logowania' });
    }
});


app.get('/api/user-data', verifyToken, (req, res) => {
    const { password, token, ...userData } = req.user;
    res.json({ userData });
});

app.get('/api/config/ranks', verifyToken, (req, res) => {
    res.json(RANKS);
});

app.post('/api/sync-citizens', (req, res) => {
    const members = req.body;
    if (Array.isArray(members)) {
        members.forEach(m => {
            const existingCitizen = citizens[m.discordId] || { ticketCount: 0, arrestCount: 0, warningCount: 0, vehicles: [], licenseSuspended: false };
            
            const updatedData = { ...existingCitizen, ...m };
            if (!m.robloxId) {
                updatedData.robloxId = existingCitizen.robloxId;
            }
            
            citizens[m.discordId] = updatedData;
        });
        saveData(CITIZENS_FILE_PATH, citizens);
        res.json({ success: true, syncedCount: members.length });
    } else {
        res.status(400).json({ message: 'Nieprawidłowe dane.' });
    }
});

app.get('/api/citizens', verifyToken, (req, res) => {
    const now = new Date().getTime();
    suspendedLicenses = suspendedLicenses.filter(s => new Date(s.expiresAt).getTime() > now);
    saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
    
    const citizensWithStatus = Object.values(citizens).map(c => {
        c.licenseSuspended = suspendedLicenses.some(s => s.citizenId === c.discordId);
        return c;
    });

    res.json(citizensWithStatus);
});

app.get('/api/citizen/:id', verifyToken, (req, res) => {
    const citizenId = req.params.id;
    const citizen = citizens[citizenId];
    if (citizen) {
        const wantedMatches = bolo.filter(b => {
            const details = b.details || {};
            const involvedPersons = [details.osoba, details.kierowca, details.wlasciciel].filter(Boolean);
            return involvedPersons.some(personString => personString.includes(citizenId));
        });
        
        const ownedVehicles = Object.values(vehicles).filter(v => v.ownerId === citizenId);

        const now = new Date().getTime();
        const licenseSuspended = suspendedLicenses.some(s => s.citizenId === citizenId && new Date(s.expiresAt).getTime() > now);

        const responseData = {
            ...citizen,
            records: (records[citizenId] || []).sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate)),
            wantedStatus: wantedMatches.length > 0 ? wantedMatches : null,
            vehicles: ownedVehicles.map(v => ({ plate: v.plate, status: v.status, isImpounded: v.isImpounded || false })),
            licenseSuspended: licenseSuspended
        };
        res.json(responseData);
    } else {
        res.status(404).json({ message: 'Nie znaleziono obywatela' });
    }
});

app.post('/api/vehicle-inspection', (req, res) => {
    try {
        const { reportType, reportContent, rawMessage } = req.body;
        const contentToParse = reportContent || rawMessage;
        
        if (!contentToParse) {
             return res.status(400).json({ success: false, message: 'Brak treści raportu.' });
        }

        const plateRegex = /(?:numery rejestracyjne, stan|Tablice rejestracyjne \/ Stan|Numery rejestracyjne, stan):\s*\**\s*([^,\n]+)/i;
        const ownerRegex = /(?:właściciel pojazdu|Ping Właściciela pojazdu):\s*\**\s*<@(\d+)>/i;

        const plateMatch = contentToParse.match(plateRegex);
        const ownerMatch = contentToParse.match(ownerRegex);
        
        if (!plateMatch || !ownerMatch) {
            console.log(`[DEBUG] Błąd parsowania. Treść: ${contentToParse}`);
            return res.status(400).json({ success: false, message: 'Nie udało się sparsować numeru rejestracyjnego lub właściciela.' });
        }
        
        const plate = plateMatch[1].trim().toUpperCase();
        const ownerId = ownerMatch[1];
        
        const vehicle = vehicles[plate] || { inspections: [], registeredAt: new Date().toISOString() };
        
        Object.assign(vehicle, {
            plate: plate,
            ownerId: ownerId,
            ownerName: citizens[ownerId]?.name || 'Nieznany',
            lastInspection: new Date().toISOString(),
            status: reportType || (contentToParse.toLowerCase().includes('pozytywny') ? 'POZYTYWNY' : 'NEGATYWNY')
        });
        
        vehicle.inspections.unshift({
            date: new Date().toISOString(),
            type: vehicle.status,
            content: contentToParse
        });
        
        vehicles[plate] = vehicle;
        saveData(VEHICLES_FILE_PATH, vehicles);
        
        if (VEHICLE_INSPECTION_WEBHOOK_URL) {
            fetch(VEHICLE_INSPECTION_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: contentToParse })
            }).catch(err => console.error("Błąd wysyłania na webhook CEPiK:", err));
        }

        res.status(201).json({ success: true, message: `Status pojazdu ${plate} został zapisany.` });
    } catch (error) {
        console.error("Błąd w /api/vehicle-inspection:", error);
        res.status(500).json({ success: false, message: "Wewnętrzny błąd serwera." });
    }
});


app.get('/api/vehicles', verifyToken, (req, res) => {
    res.json(Object.values(vehicles));
});

app.get('/api/vehicle/:plate', verifyToken, (req, res) => {
    const plate = req.params.plate.toUpperCase();
    const vehicle = vehicles[plate];
    if (vehicle) {
        res.json(vehicle);
    } else {
        res.status(404).json({ message: 'Nie znaleziono pojazdu' });
    }
});

app.put('/api/vehicle/:plate', verifyToken, verifyDiagnosticianLead, (req, res) => {
    const plate = req.params.plate.toUpperCase();
    if (vehicles[plate]) {
        const { ownerId, make, model, color } = req.body;
        let vehicleUpdated = false;

        if (ownerId && citizens[ownerId]) {
            vehicles[plate].ownerId = ownerId;
            vehicles[plate].ownerName = citizens[ownerId].name;
            vehicleUpdated = true;
        } else if (ownerId) {
             return res.status(400).json({ success: false, message: 'Nieprawidłowe ID właściciela.' });
        }
        
        if (make) { vehicles[plate].make = make; vehicleUpdated = true; }
        if (model) { vehicles[plate].model = model; vehicleUpdated = true; }
        if (color) { vehicles[plate].color = color; vehicleUpdated = true; }

        if (vehicleUpdated) {
            saveData(VEHICLES_FILE_PATH, vehicles);
            res.json({ success: true, message: 'Dane pojazdu zaktualizowane.' });
        } else {
            res.status(400).json({ success: false, message: 'Nie podano żadnych danych do aktualizacji.' });
        }
    } else {
        res.status(404).json({ success: false, message: 'Nie znaleziono pojazdu.' });
    }
});


app.delete('/api/vehicles/:plate', verifyToken, (req, res) => {
    const plate = req.params.plate.toUpperCase();
    if (vehicles[plate]) {
        delete vehicles[plate];
        saveData(VEHICLES_FILE_PATH, vehicles);
        res.json({ success: true, message: 'Pojazd usunięty.' });
    } else {
        res.status(404).json({ success: false, message: 'Nie znaleziono pojazdu.' });
    }
});

app.delete('/api/vehicles/:plate/inspections/:index', verifyToken, verifySenior, (req, res) => {
    const { plate, index } = req.params;
    const vehicle = vehicles[plate.toUpperCase()];

    if (vehicle && vehicle.inspections && vehicle.inspections[index]) {
        vehicle.inspections.splice(index, 1);
        
        if (vehicle.inspections.length > 0) {
            vehicle.lastInspection = vehicle.inspections[0].date;
            vehicle.status = vehicle.inspections[0].type;
        } else {
            vehicle.lastInspection = null;
            vehicle.status = 'Brak danych';
        }
        
        saveData(VEHICLES_FILE_PATH, vehicles);
        res.json({ success: true, message: 'Przegląd został usunięty.' });
    } else {
        res.status(404).json({ success: false, message: 'Nie znaleziono pojazdu lub przeglądu.' });
    }
});

app.post('/api/records', verifyToken, async (req, res) => {
    const reportData = { ...req.body, id: crypto.randomUUID(), issueDate: new Date(), author: req.user.username, authorBadge: req.user.badge, department: req.user.department };
    const { civilianDiscordId, reportType } = reportData;

    const discordIdMatch = (civilianDiscordId || '').match(/<@(\d+)>/);
    const cleanDiscordId = discordIdMatch ? discordIdMatch[1] : civilianDiscordId;

    if (!cleanDiscordId) {
        return res.status(400).json({ success: false, message: "Brak ID Discord osoby." });
    }

    if (!records[cleanDiscordId]) records[cleanDiscordId] = [];
    records[cleanDiscordId].unshift(reportData);
    saveData(RECORDS_FILE_PATH, records);

    if (citizens[cleanDiscordId]) {
        if (reportType === 'mandat') citizens[cleanDiscordId].ticketCount = (citizens[cleanDiscordId].ticketCount || 0) + 1;
        else if (reportType === 'pouczenie') citizens[cleanDiscordId].warningCount = (citizens[cleanDiscordId].warningCount || 0) + 1;
        else if (reportType === 'areszt') citizens[cleanDiscordId].arrestCount = (citizens[cleanDiscordId].arrestCount || 0) + 1;
        saveData(CITIZENS_FILE_PATH, citizens);
    }

    try {
        if (reportType === 'mandat') {
            const dueDate = new Date(reportData.issueDate);
            dueDate.setDate(dueDate.getDate() + 3);
            const formattedDueDate = `${dueDate.getDate().toString().padStart(2, '0')}/${(dueDate.getMonth() + 1).toString().padStart(2, '0')}/${dueDate.getFullYear()}`;
            
            let description = `**Departament funkcjonariusza:** ${reportData.department}\n\n`;

            if (reportData.ticketTarget === 'vehicle') {
                    description += `**Dane zatrzymanego Pojazdu**\n`;
                    description += `**Kierowca:** <@${cleanDiscordId}>\n`;
                    description += `**Marka Pojazdu, Model, Kolor:** ${reportData.vehicleInfo}\n`;
                    description += `**Numer rejestracyjny / stan rejestracji:** ${reportData.licensePlate}\n\n`;
            } else {
                    description += `**Dane zatrzymanej osoby**\n`;
                    description += `**Ping osoby zatrzymanej:** <@${cleanDiscordId}>\n\n`;
            }
            
            description += `**Szczegóły mandatu**\n`;
            description += `**Zarzuty:**\n${(reportData.charges || []).map(c => `- ${c.name}`).join('\n')}\n`;
            description += `**Kara grzywny:** $${reportData.totalFine}\n`;
            description += `**Miejsce wystawienia:** ${reportData.location}\n`;
            description += `**Data wystawienia:** ${new Date(reportData.issueDate).toLocaleDateString('pl-PL')}\n`;
            description += `**Ostatnia data zapłaty:** ${formattedDueDate}\n`;
            description += `**Czy został przyjęty:** ${reportData.isAccepted}\n`;
            description += `**Sposób wręczenia mandatu:** ${reportData.deliveryMethod}\n\n`;
            description += `**Dane funkcjonariusza**\n`;
            description += `**Ping funkcjonariusza:** <@${req.user.robloxId || 'Brak ID'}>\n`;
            description += `**Prowadzący czynność:** ${reportData.author}\n`;
            description += `**Stopień i odznaka:** ${req.user.rank} | ${reportData.authorBadge}`;

            const OCSO_COLOR = 16754176;
            const WSP_COLOR = 3447003;  
            const embedColor = reportData.department === 'OCSO' ? OCSO_COLOR : WSP_COLOR;

            const embed = { color: embedColor, description, timestamp: new Date().toISOString() };

            if (reportData.photoUrl) {
                embed.image = { url: reportData.photoUrl };
            }
            
            const payload = {
                embeds: [embed],
                content: `||<@${cleanDiscordId}>||`
            };

            await fetch(TICKET_WEBHOOK_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });

        } else if (reportType === 'areszt') {
            const officerDiscordIdMatch = (reportData.officerDiscordId || '').match(/<@(\d+)>/);
            const cleanOfficerDiscordId = officerDiscordIdMatch ? officerDiscordIdMatch[1] : reportData.officerDiscordId;

            let description = `**Dane Zatrzymanego**\n`;
            description += `**Ping osoby zatrzymanej:** <@${cleanDiscordId}>\n`;
            description += `**Imię, Nazwisko:** ${reportData.civilianFullName}\n`;
            description += `**Wiek:** ${reportData.civilianAge}\n`;
            description += `**Płeć:** ${reportData.civilianGender}\n`;
            description += `**Zarekwirowane Przedmioty:** ${reportData.confiscatedItems || 'Brak'}\n\n`;
            description += `**Dane Funkcjonariusza**\n`;
            description += `**Ping funkcjonariusza:** <@${cleanOfficerDiscordId}>\n`;
            description += `**Departament:** ${reportData.department}\n`;
            description += `**Odznaka:** ${reportData.authorBadge}\n`;
            description += `**Stopień:** ${req.user.rank}\n\n`;
            description += `**Szczegóły Aresztu**\n`;
            description += `**Gdzie został aresztowany:** ${reportData.arrestLocation}\n`;
            description += `**Zarzuty:**\n${(reportData.charges || []).map(c => `- ${c.name} (${c.lata} mies. / $${c.price})`).join('\n')}\n`;
            description += `**Długość wyroku (1 Miesiąc = 1 minuta):** ${reportData.finalSentence} minut\n`;
            description += `**Wysokość grzywny:** $${reportData.finalTotalFine}\n`;
            description += `**Na której komendzie odsiaduje wyrok:** ${reportData.jailLocation}\n\n`;
            description += `-# (jeżeli ktoś chce zamienić miesiące na pieniądze to nie może mieć więcej niż 99 miesięcy i maksymalnie może wykupić 30 miesięcy a 1 Miesiąc = 1000$)`;
            
            const embed = { color: 15158332, description, timestamp: new Date().toISOString() };
            if (reportData.photoUrl) {
                embed.image = { url: reportData.photoUrl };
            }
            await fetch(ARREST_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) });
        }
    } catch (error) { console.error("Błąd webhooka:", error); }
    res.json({ success: true, message: 'Zgłoszenie zapisane.' });
});


app.delete('/api/records/:citizenId/:recordId', verifyToken, verifySenior, (req, res) => {
    const { citizenId, recordId } = req.params;
    if (records[citizenId]) {
        const recordIndex = records[citizenId].findIndex(r => r.id === recordId);
        if (recordIndex > -1) {
            const [recordToDelete] = records[citizenId].splice(recordIndex, 1);
            saveData(RECORDS_FILE_PATH, records);
            if (citizens[citizenId]) {
                const type = recordToDelete.reportType;
                if (type === 'mandat') citizens[citizenId].ticketCount = Math.max(0, (citizens[citizenId].ticketCount || 0) - 1);
                else if (type === 'pouczenie') citizens[citizenId].warningCount = Math.max(0, (citizens[citizenId].warningCount || 0) - 1);
                else if (type === 'areszt') citizens[citizenId].arrestCount = Math.max(0, (citizens[citizenId].arrestCount || 0) - 1);
                saveData(CITIZENS_FILE_PATH, citizens);
            }
            res.json({ success: true });
        } else { res.status(404).json({ success: false, message: 'Nie znaleziono rekordu.' }); }
    } else { res.status(404).json({ success: false, message: 'Nie znaleziono obywatela.' }); }
});

app.get('/api/officers/stats', verifyToken, (req, res) => {
    const allRecords = Object.values(records).flat();
    const officerStats = Object.values(users).map(officer => {
        const officerRecords = allRecords.filter(r => r.author === officer.username);
        const tickets = officerRecords.filter(r => r.reportType === 'mandat');
        const arrests = officerRecords.filter(r => r.reportType === 'areszt');
        const warnings = officerRecords.filter(r => r.reportType === 'pouczenie');
        
        const ticketsValue = tickets.reduce((sum, t) => sum + (Number(t.totalFine) || 0), 0);
        const arrestsValue = arrests.reduce((sum, arrest) => sum + (Number(arrest.finalTotalFine) || 0), 0);

        const { password, token, ...officerData } = officer;
        
        if (!officerData.department) {
            officerData.department = 'WSP';
        }
        
        const activeLeave = leaves.find(l => l.officerBadge === officer.badge && l.department === officer.department); 
        officerData.onLeave = !!activeLeave;

        return {
            ...officerData,
            stats: {
                tickets: { count: tickets.length, totalValue: ticketsValue },
                arrests: { count: arrests.length, totalValue: arrestsValue },
                warnings: { count: warnings.length },
                totalValue: ticketsValue + arrestsValue
            }
        };
    });
    res.json(officerStats);
});

app.get('/api/officers/records/:email', verifyToken, (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const officer = Object.values(users).find(u => u.email === email);
    if (!officer) {
        return res.status(404).json([]);
    }
    const allRecords = Object.values(records).flat();
    const officerRecords = allRecords
        .filter(r => r.author === officer.username)
        .sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
    res.json(officerRecords);
});

app.get('/api/officer/badge/:badge', verifyToken, (req, res) => {
    const badge = req.params.badge;
    const officer = Object.values(users).find(u => u.badge === badge);

    if (!officer) {
        return res.status(404).json({ message: 'Nie znaleziono funkcjonariusza o tej odznace.' });
    }

    const allRecords = Object.values(records).flat();
    const officerRecords = allRecords.filter(r => r.author === officer.username);
    
    const tickets = officerRecords.filter(r => r.reportType === 'mandat');
    const arrests = officerRecords.filter(r => r.reportType === 'areszt');
    const warnings = officerRecords.filter(r => r.reportType === 'pouczenie');
    
    const ticketsValue = tickets.reduce((sum, t) => sum + (Number(t.totalFine) || 0), 0);
    const arrestsValue = arrests.reduce((sum, arrest) => sum + (Number(arrest.finalTotalFine) || 0), 0);

    const { password, token, ...officerData } = officer;

    res.json({
        ...officerData,
        stats: {
            tickets: { count: tickets.length, totalValue: ticketsValue },
            arrests: { count: arrests.length, totalValue: arrestsValue },
            warnings: { count: warnings.length },
            totalValue: ticketsValue + arrestsValue
        },
        records: officerRecords.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate))
    });
});

app.get('/api/officers', verifyToken, (req, res) => {
    res.json(Object.values(users).map(({ password, token, ...officer }) => officer));
});

app.post('/api/officers', verifyToken, verifyAdmin, (req, res) => {
    const { email, username, password, badge, rank, isAdmin, robloxId, discordNick, robloxNick, joinedAt, department } = req.body;
    if (!email || !username || !password || !badge || !rank || !department) return res.status(400).json({ success: false, message: 'Wszystkie pola są wymagane.' });
    if (users[email]) return res.status(400).json({ success: false, message: 'Użytkownik o tym emailu już istnieje.' });
    
    users[email] = { 
        id: `user_${crypto.randomUUID()}`, email, username, password, badge, rank, department,
        isAdmin: isAdmin === 'true', token: null,
        robloxId, discordNick, robloxNick, joinedAt
    };
    saveData(USERS_FILE_PATH, users);
    res.json({ success: true, user: users[email] });
});

app.put('/api/officers/:email', verifyToken, (req, res) => {
    const targetEmail = decodeURIComponent(req.params.email);
    const { username, newEmail, password, badge, rank, robloxId, discordNick, robloxNick, joinedAt, department } = req.body;

    const canEditSensitive = req.user.isAdmin || (req.user.rank === 'Superintendent' && req.user.badge === '101');

    if (!users[targetEmail]) {
        return res.status(404).json({ success: false, message: 'Nie znaleziono funkcjonariusza.' });
    }
    
    if (req.user.email !== targetEmail && !canEditSensitive) {
        return res.status(403).json({ success: false, message: 'Brak uprawnień do edycji tego użytkownika.' });
    }

    const updatedUser = { ...users[targetEmail] };
    
    if (username && canEditSensitive) updatedUser.username = username;
    if (password && canEditSensitive) updatedUser.password = password;
    if (badge) updatedUser.badge = badge;
    if (rank) updatedUser.rank = rank;
    if (robloxId) updatedUser.robloxId = robloxId;
    if (discordNick) updatedUser.discordNick = discordNick;
    if (robloxNick) updatedUser.robloxNick = robloxNick;
    if (joinedAt) updatedUser.joinedAt = joinedAt;
    if (department) updatedUser.department = department;

    if (newEmail && newEmail !== targetEmail && canEditSensitive) {
        if (users[newEmail]) {
            return res.status(400).json({ success: false, message: 'Nowy adres email jest już zajęty.' });
        }
        delete users[targetEmail];
        updatedUser.email = newEmail;
        users[newEmail] = updatedUser;
    } else {
        users[targetEmail] = updatedUser;
    }

    saveData(USERS_FILE_PATH, users);
    res.json({ success: true, message: 'Dane zaktualizowane.' });
});


app.delete('/api/officers/:email', verifyToken, verifyAdmin, (req, res) => {
    const email = decodeURIComponent(req.params.email);
    if (email === 'admin@wsp.gov' || email === req.user.email) return res.status(400).json({ success: false, message: 'Nie można usunąć konta admina lub samego siebie.' });
    if (users[email]) {
        delete users[email];
        saveData(USERS_FILE_PATH, users);
        res.json({ success: true });
    } else { res.status(404).json({ success: false, message: 'Nie znaleziono funkcjonariusza.' }); }
});

app.get('/api/announcements', verifyToken, (req, res) => res.json(announcements));
app.post('/api/announcements', verifyToken, verifyAdmin, (req, res) => {
    const newAnnouncement = { ...req.body, id: crypto.randomUUID(), author: req.user.username };
    announcements.unshift(newAnnouncement);
    saveData(ANNOUNCEMENTS_FILE_PATH, announcements);
    res.json({ success: true });
});
app.delete('/api/announcements/:id', verifyToken, verifyAdmin, (req, res) => {
    announcements = announcements.filter(a => a.id !== req.params.id);
    saveData(ANNOUNCEMENTS_FILE_PATH, announcements);
    res.json({ success: true });
});

app.get('/api/reports/today-stats', verifyToken, (req, res) => {
    try {
        const officerUsername = req.user.username;
        const allRecords = Object.values(records).flat();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayRecords = allRecords.filter(r => {
            const recordDate = new Date(r.issueDate);
            recordDate.setHours(0, 0, 0, 0);
            return r.author === officerUsername && recordDate.getTime() === today.getTime();
        });

        const tickets = todayRecords.filter(r => r.reportType === 'mandat');
        const arrests = todayRecords.filter(r => r.reportType === 'areszt');
        const warnings = todayRecords.filter(r => r.reportType === 'pouczenie');

        const ticketValue = tickets.reduce((sum, t) => sum + (Number(t.totalFine) || 0), 0);
        const arrestValue = arrests.reduce((sum, a) => sum + (Number(a.finalTotalFine) || 0), 0);

        const stats = {
            stops: tickets.length + arrests.length + warnings.length,
            tickets: tickets.length,
            arrests: arrests.length,
            warnings: warnings.length,
            ticketValue: ticketValue,
            arrestValue: arrestValue
        };
        res.json(stats);
    } catch (error) {
        console.error("Błąd w /api/reports/today-stats:", error);
        res.status(500).json({ success: false, message: "Błąd serwera przy pobieraniu statystyk." });
    }
});

app.post('/api/reports', verifyToken, async (req, res) => {
    try {
        const reportData = req.body;
        const reportContent = `
**SZCZEGÓŁY SŁUŻBY**
**Ilość przeprowadzonych zatrzymań:** ${reportData.stops}
**Ilość nałożonych mandatów:** ${reportData.tickets}
**Ilość aresztów:** ${reportData.arrests}
**Ilość zastosowanych pouczeń:** ${reportData.warnings}

**DANE**
**Departament:** ${reportData.department}
**Imię i nazwisko:** ${reportData.name}
**Ping funkcjonariusza:** <@${req.user.robloxId || 'Brak ID'}>
**Stopień:** ${reportData.rank}
**Odznaka:** ${reportData.badge}
**Data:** ${reportData.date}
**Podpis:** ${reportData.signature}
        `;

        const response = await fetch(REPORT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: reportContent.trim() })
        });
        if (!response.ok) {
            throw new Error(`Błąd wysyłania na Discorda: ${response.statusText}`);
        }
        res.json({ success: true, message: 'Raport wysłany.' });
    } catch (error) {
        console.error("Błąd wysyłania raportu:", error);
        res.status(500).json({ success: false, message: 'Nie udało się wysłać raportu.' });
    }
});


app.get('/api/chat', verifyToken, (req, res) => res.json(chatMessages));
app.post('/api/chat', verifyToken, (req, res) => {
    if (!req.body.message || !req.body.message.trim()) return res.status(400).json({ success: false, message: 'Wiadomość nie może być pusta.' });
    const newMessage = { ...req.body, id: crypto.randomUUID(), timestamp: new Date(), author: req.user.username, authorBadge: req.user.badge };
    chatMessages.push(newMessage);
    if (chatMessages.length > 50) chatMessages.shift();
    saveData(CHAT_FILE_PATH, chatMessages);
    res.json({ success: true });
});

app.get('/api/notes', verifyToken, (req, res) => res.json({ note: notes[req.user.id] || '' }));
app.post('/api/notes', verifyToken, (req, res) => {
    notes[req.user.id] = req.body.note;
    saveData(NOTES_FILE_PATH, notes);
    res.json({ success: true });
});

// --- ENDPOINTY DLA GODZIN SŁUŻBY ---
app.get('/api/duty/status', verifyToken, (req, res) => {
    const userEmail = req.user.email;
    if (activeDutySessions[userEmail]) {
        res.json({ onDuty: true, startTime: activeDutySessions[userEmail].startTime });
    } else {
        res.json({ onDuty: false });
    }
});

app.post('/api/duty/start', verifyToken, (req, res) => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // NOWE GODZINY: 19:00 - 23:30
    const startHour = 19;
    const startMinute = 0;
    const endHour = 23;
    const endMinute = 30;

    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;

    const isAllowedTime = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    
    if (!isAllowedTime) {
        return res.status(403).json({ success: false, message: `Służbę można rozpocząć tylko między ${startHour}:${startMinute.toString().padStart(2, '0')} a ${endHour}:${endMinute.toString().padStart(2, '0')}.` });
    }

    const userEmail = req.user.email;
    if (activeDutySessions[userEmail]) {
        return res.status(400).json({ success: false, message: 'Jesteś już na służbie.' });
    }
    activeDutySessions[userEmail] = {
        startTime: new Date().toISOString(),
        username: req.user.username,
        badge: req.user.badge,
        department: req.user.department,
        rank: req.user.rank
    };
    saveData(ACTIVE_DUTY_SESSIONS_FILE_PATH, activeDutySessions);
    res.json({ success: true, startTime: activeDutySessions[userEmail].startTime });
});

app.post('/api/duty/end', verifyToken, (req, res) => {
    const userEmail = req.user.email;
    const session = activeDutySessions[userEmail];

    if (!session) {
        return res.status(400).json({ success: false, message: 'Nie jesteś na służbie.' });
    }

    const endTime = new Date();
    const startTime = new Date(session.startTime);
    const durationMinutes = (endTime - startTime) / (1000 * 60);
    const hoursCompleted = Math.floor(durationMinutes / 60);
    const earnings = hoursCompleted * 750;

    if (!dutyHours[userEmail]) {
        dutyHours[userEmail] = {
            username: session.username, badge: session.badge, department: session.department, rank: session.rank,
            totalHours: 0, totalEarnings: 0, temporaryHours: 0, temporaryEarnings: 0,
        };
    }
    
    dutyHours[userEmail].rank = req.user.rank;
    dutyHours[userEmail].department = req.user.department;
    dutyHours[userEmail].temporaryHours += (durationMinutes / 60);
    if(hoursCompleted > 0) {
        dutyHours[userEmail].temporaryEarnings += earnings;
    }

    delete activeDutySessions[userEmail];
    saveData(ACTIVE_DUTY_SESSIONS_FILE_PATH, activeDutySessions);
    saveData(DUTY_HOURS_FILE_PATH, dutyHours);

    res.json({ success: true, hoursCompleted, earnings });
});

app.get('/api/duty/leaderboard', verifyToken, (req, res) => {
    const leaderboardData = Object.values(users)
        .filter(u => u.username !== 'Administrator')
        .map(user => {
            const hoursData = dutyHours[user.email] || { temporaryHours: 0, temporaryEarnings: 0, totalHours: 0, totalEarnings: 0 };
            return {
                username: user.username,
                badge: user.badge,
                department: user.department,
                rank: user.rank,
                ...hoursData
            };
    });
    res.json(leaderboardData);
});

app.post('/api/duty/payout', verifyToken, verifyPayoutAccess, (req, res) => {
    for (const email in dutyHours) {
        const data = dutyHours[email];
        data.totalHours += data.temporaryHours || 0;
        data.totalEarnings += data.temporaryEarnings || 0;
        data.temporaryHours = 0;
        data.temporaryEarnings = 0;
    }
    saveData(DUTY_HOURS_FILE_PATH, dutyHours);
    res.json({ success: true, message: 'Wypłata przetworzona pomyślnie.' });
});

// --- ENDPOINTY DLA DYWIZJI ---
app.get('/api/divisions', verifyToken, (req, res) => res.json(divisions));
app.post('/api/divisions/members', verifyToken, verifyAdmin, (req, res) => {
    const { divisionName, memberType, officerName, department } = req.body;
    if (divisions[department]?.[divisionName]?.[memberType] && !divisions[department][divisionName][memberType].includes(officerName)) {
        divisions[department][divisionName][memberType].push(officerName);
        saveData(DIVISIONS_FILE_PATH, divisions);
        res.json({ success: true });
    } else { res.status(400).json({ success: false, message: 'Błąd dodawania członka.' }); }
});
app.delete('/api/divisions/members', verifyToken, verifyAdmin, (req, res) => {
    const { divisionName, memberType, officerName, department } = req.body;
    if (divisions[department]?.[divisionName]?.[memberType]) {
        divisions[department][divisionName][memberType] = divisions[department][divisionName][memberType].filter(name => name !== officerName);
        saveData(DIVISIONS_FILE_PATH, divisions);
        res.json({ success: true });
    } else { res.status(400).json({ success: false, message: 'Błąd usuwania członka.' }); }
});

// --- ENDPOINTY DLA DIAGNOSTÓW ---
app.get('/api/diagnosticians', verifyToken, (req, res) => {
    res.json(diagnosticians.map(({ password, token, ...diag }) => diag));
});

app.post('/api/diagnosticians', verifyToken, verifyAdmin, (req, res) => {
    const { email, password, discordNick, robloxNick, discordId, skpNumber } = req.body;
    if (!email || !password || !discordNick || !discordId || !skpNumber) {
        return res.status(400).json({ success: false, message: 'Wszystkie pola są wymagane.' });
    }
    if (diagnosticians.some(d => d.email === email)) {
        return res.status(400).json({ success: false, message: 'Diagnosta o tym emailu już istnieje.' });
    }
    const newDiagnostician = {
        id: `diag_${crypto.randomUUID()}`, email, password, discordNick, robloxNick, discordId, skpNumber,
        isDiagnostician: true, token: null
    };
    diagnosticians.push(newDiagnostician);
    saveData(DIAGNOSTICIANS_FILE_PATH, diagnosticians);
    res.status(201).json({ success: true, message: 'Dodano diagnostę.' });
});

app.delete('/api/diagnosticians/:id', verifyToken, verifyAdmin, (req, res) => {
    const { id } = req.params;
    const initialLength = diagnosticians.length;
    diagnosticians = diagnosticians.filter(d => d.id !== id);
    if (diagnosticians.length === initialLength) {
        return res.status(404).json({ success: false, message: 'Nie znaleziono diagnosty.' });
    }
    saveData(DIAGNOSTICIANS_FILE_PATH, diagnosticians);
    res.json({ success: true, message: 'Usunięto diagnostę.' });
});


// --- Pozostałe endpointy (BOLO, urlopy, parking itp.) ---
// --- Endpointy BOLO ---
app.get('/api/bolo', verifyToken, (req, res) => {
    try {
        res.json(bolo);
    } catch (error) {
        console.error('Błąd w GET /api/bolo:', error);
        res.status(500).json({ success: false, message: 'Błąd serwera przy pobieraniu BOLO.' });
    }
});

app.post('/api/bolo', verifyToken, async (req, res) => {
    try {
        const { type, details, photoUrl } = req.body;
        if (!type || !details || !details.powod) {
            return res.status(400).json({ success: false, message: 'Brakuje wymaganych pól (typ, szczegóły, powód).' });
        }
        const newBolo = {
            id: crypto.randomUUID(), type, details, photoUrl,
            author: req.user.username, authorBadge: req.user.badge,
            createdAt: new Date().toISOString()
        };
        bolo.unshift(newBolo);
        saveData(BOLO_FILE_PATH, bolo);

        if(BOLO_WEBHOOK_URL !== 'https://discord.com/api/webhooks/123456789/placeholder') {
            let description = `**Typ:** ${type}\n**Powód:** ${details.powod}\n\n`;
            for(const [key, value] of Object.entries(details)) {
                if(key !== 'powod' && value) {
                    description += `**${key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}:** ${value}\n`;
                }
            }
            const embed = {
                title: 'Nowe BOLO', description, color: 15158332,
                footer: { text: `Wystawione przez: ${req.user.username} #${req.user.badge}`},
                timestamp: new Date().toISOString()
            };
            if (photoUrl) {
                embed.image = { url: photoUrl };
            }
            await fetch(BOLO_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });
        }
        
        res.status(201).json({ success: true, message: 'Pomyślnie dodano BOLO.', data: newBolo });
    } catch (error) {
        console.error('Błąd w POST /api/bolo:', error);
        res.status(500).json({ success: false, message: 'Błąd serwera przy tworzeniu BOLO.' });
    }
});

app.delete('/api/bolo/:id', verifyToken, verifySenior, (req, res) => {
    try {
        const { id } = req.params;
        const initialLength = bolo.length;
        bolo = bolo.filter(b => b.id !== id);
        if (bolo.length === initialLength) {
            return res.status(404).json({ success: false, message: 'Nie znaleziono BOLO o podanym ID.' });
        }
        saveData(BOLO_FILE_PATH, bolo);
        res.json({ success: true, message: 'Pomyślnie usunięto BOLO.' });
    } catch (error) {
        console.error(`Błąd w DELETE /api/bolo/${req.params.id}:`, error);
        res.status(500).json({ success: false, message: 'Błąd serwera przy usuwaniu BOLO.' });
    }
});

// --- Endpointy urlopów ---
app.get('/api/leaves', verifyToken, (req, res) => res.json(leaves));
app.post('/api/leaves', verifyToken, async (req, res) => {
    try {
        const { reason, dateRange, canExtend, signature } = req.body;
        if (!reason || !dateRange || !signature) {
            return res.status(400).json({ success: false, message: 'Wszystkie pola są wymagane.' });
        }
        const newLeave = {
            id: crypto.randomUUID(),
            officerName: req.user.username,
            officerDiscordId: req.user.robloxId,
            officerRank: req.user.rank,
            officerBadge: req.user.badge,
            department: req.user.department,
            reason, dateRange, canExtend, signature,
            submittedAt: new Date().toISOString()
        };
        leaves.unshift(newLeave);
        saveData(LEAVES_FILE_PATH, leaves);
        res.status(201).json({ success: true, message: 'Wniosek urlopowy został złożony.' });
    } catch (error) {
        console.error('Błąd przy składaniu urlopu:', error);
        res.status(500).json({ success: false, message: 'Wewnętrzny błąd serwera.' });
    }
});

app.delete('/api/leaves/:id', verifyToken, (req, res) => {
    try {
        const { id } = req.params;
        const leaveToDelete = leaves.find(l => l.id === id);
        if (!leaveToDelete) {
            return res.status(404).json({ success: false, message: 'Nie znaleziono urlopu o podanym ID.' });
        }
        const isSenior = req.user.isAdmin || (req.user.rank === 'Superintendent' && req.user.badge === '101') || (req.user.rank === 'Sheriff');
        if (req.user.badge !== leaveToDelete.officerBadge && !isSenior) {
            return res.status(403).json({ success: false, message: 'Brak uprawnień do usunięcia tego urlopu.' });
        }
        leaves = leaves.filter(l => l.id !== id);
        saveData(LEAVES_FILE_PATH, leaves);
        res.json({ success: true, message: 'Urlop został pomyślnie zakończony.' });
    } catch (error) {
        console.error(`Błąd w DELETE /api/leaves/${req.params.id}:`, error);
        res.status(500).json({ success: false, message: 'Błąd serwera przy kończeniu urlopu.' });
    }
});

// --- ENDPOINTY PARKINGU POLICYJNEGO ---
app.get('/api/impound', verifyToken, (req, res) => res.json(impound));
app.post('/api/impound', verifyToken, async (req, res) => {
    const { officerPing, ownerPing, make, model, color, plate, reason, photo } = req.body;

    const plateNumber = (plate || '').split('/')[0].trim().toUpperCase();
    if (vehicles[plateNumber]) {
        vehicles[plateNumber].isImpounded = true;
        saveData(VEHICLES_FILE_PATH, vehicles);
    }
    
    const newImpoundEntry = { id: crypto.randomUUID(), date: new Date().toISOString(), ...req.body };
    impound.unshift(newImpoundEntry);
    saveData(IMPOUND_FILE_PATH, impound);
    
    if (IMPOUND_WEBHOOK_URL) {
        const embed = {
            title: 'Zatrzymany Pojazd', color: 15158332,
            fields: [
                { name: 'Ping Funkcjonariusza', value: officerPing, inline: true },
                { name: 'Ping Właściciela', value: ownerPing, inline: true },
                { name: 'Marka', value: make, inline: true },
                { name: 'Model', value: model, inline: true },
                { name: 'Kolor', value: color, inline: true },
                { name: 'Tablice / Stan', value: plate, inline: true },
                { name: 'Powód zatrzymania', value: reason },
                { name: 'Data zatrzymania', value: new Date(newImpoundEntry.date).toLocaleString('pl-PL') },
            ],
            timestamp: new Date().toISOString()
        };
        if (photo) embed.image = { url: photo };

       await fetch(IMPOUND_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        }).catch(err => console.error("Błąd wysyłania na webhook parkingu:", err));
    }

    res.status(201).json({ success: true, message: 'Pojazd dodany na parking.' });
});

app.delete('/api/impound/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const vehicleToRelease = impound.find(v => v.id === id);

    if (vehicleToRelease) {
        const plateNumber = (vehicleToRelease.plate || '').split('/')[0].trim().toUpperCase();
        if (vehicles[plateNumber]) {
            vehicles[plateNumber].isImpounded = false;
            saveData(VEHICLES_FILE_PATH, vehicles);
        }
    }

    impound = impound.filter(v => v.id !== id);
    saveData(IMPOUND_FILE_PATH, impound);
    res.json({ success: true, message: 'Pojazd zwolniony z parkingu.' });
});

app.get('/api/suspended-licenses', verifyToken, (req, res) => {
    const now = new Date().getTime();
    const activeSuspensions = suspendedLicenses.filter(s => new Date(s.expiresAt).getTime() > now);
    if (activeSuspensions.length < suspendedLicenses.length) {
        suspendedLicenses = activeSuspensions;
        saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
    }
    res.json(activeSuspensions);
});

app.post('/api/suspended-licenses', verifyToken, async (req, res) => {
    const { officerName, citizenPing } = req.body;
    
    const discordIdMatch = (citizenPing || '').match(/<@(\d+)>/);
    const citizenId = discordIdMatch ? discordIdMatch[1] : null;

    if (!citizenId || !citizens[citizenId]) {
        return res.status(404).json({ success: false, message: "Nie znaleziono obywatela o podanym ID." });
    }

    const suspensionEndDate = new Date();
    suspensionEndDate.setDate(suspensionEndDate.getDate() + 7);

    const newSuspension = {
        id: crypto.randomUUID(),
        officerName,
        citizenId,
        citizenName: citizens[citizenId].name,
        startsAt: new Date().toISOString(),
        expiresAt: suspensionEndDate.toISOString()
    };
    
    suspendedLicenses.push(newSuspension);
    saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);

    const content = `
**Kto wstrzymuje prawo jazdy:** ${officerName}
**Komu wstrzymuje:** <@${citizenId}>
**Od kiedy (data):** ${new Date(newSuspension.startsAt).toLocaleDateString('pl-PL')}
**Do kiedy (data):** ${new Date(newSuspension.expiresAt).toLocaleDateString('pl-PL')}

**Ping:** <@864948534289629214> <@602751766324445218>
    `;

    if (SUSPENDED_LICENSE_WEBHOOK_URL) {
        await fetch(SUSPENDED_LICENSE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content.trim() })
        }).catch(err => console.error("Błąd wysyłania na webhook wstrzymanych praw jazdy:", err));
    }

    // Nadaj rolę i zaplanuj jej usunięcie
    await manageRole(citizenId, 'add');
    scheduleRoleRemoval(newSuspension.id, citizenId, newSuspension.expiresAt);

    res.status(201).json({ success: true, message: 'Prawo jazdy zostało wstrzymane.' });
});

app.delete('/api/suspended-licenses/:id', verifyToken, verifySenior, async (req, res) => {
    const { id } = req.params;
    const suspensionToRemove = suspendedLicenses.find(s => s.id === id);

    if (!suspensionToRemove) {
        return res.status(404).json({ success: false, message: 'Nie znaleziono wstrzymanego prawa jazdy o podanym ID.' });
    }
    
    // Anuluj zaplanowane zadanie i natychmiast usuń rolę
    if (roleTimers[id]) {
        clearTimeout(roleTimers[id]);
        delete roleTimers[id];
    }
    await manageRole(suspensionToRemove.citizenId, 'remove');
    
    suspendedLicenses = suspendedLicenses.filter(s => s.id !== id);
    saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
    res.json({ success: true, message: 'Wstrzymanie prawa jazdy zostało anulowane.' });
});


// --- Serwowanie plików statycznych ---
app.use(express.static('public'));

// --- Catch-all i start serwera ---
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ success: false, message: 'Nie znaleziono takiego endpointu API.' });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
});

// --- Start serwera I BOTA ---
client.once('ready', async () => {
    console.log(`Bot ${client.user.tag} jest gotowy!`);
    client.user.setActivity('WSP & OCSO', { type: ActivityType.Watching });
    
    loadDatabase();
    
    // Po wczytaniu bazy danych, odtwarzamy timery
    restoreRoleTimers();
    
    // Uruchomienie serwera Express dopiero po zalogowaniu bota i załadowaniu danych
    app.listen(port, () => {
        console.log(`Serwer MDT działa. Adres: http://localhost:${port}`);
    });
});

client.login(BOT_TOKEN);
