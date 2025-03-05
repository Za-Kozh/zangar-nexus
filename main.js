require('dotenv').config();
const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const { google } = require('googleapis');
const { ethers } = require("ethers");
const WebSocket = require('ws');

const WS_URL = 'wss://rpc.nexus.xyz/ws';
const CLIENT_ID = ''; // CLIENT_ID from Google Console Cloud Oauth
const CLIENT_SECRET = ''; // CLIENT_SECRET from Google Console Cloud Oauth
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const provider = new ethers.JsonRpcProvider("https://rpc.nexus.xyz/http");
const walletAddress = ""; // Nexus Wallet Address

let socket;
let mainWindow;
let authWindow;
// let tokenCount = 0;
// let networkQuality = 75;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        resizable: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('index.html');
}

// Открытие окна Google OAuth
ipcMain.on('login', async () => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/userinfo.email']
    });
    
    authWindow = new BrowserWindow({
        width: 400,
        height: 600,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false
        }
    });
    authWindow.loadURL(authUrl);

    // Перехват кода авторизации
    const filter = { urls: ['*://localhost/*'] };
    session.defaultSession.webRequest.onBeforeRequest(filter, async (details, callback) => {
        const url = new URL(details.url);
        const code = url.searchParams.get('code');
        if (code) {
            authWindow.close();
            try {
                const { tokens } = await oauth2Client.getToken(code);
                oauth2Client.setCredentials(tokens);
                mainWindow.webContents.send('status', 'Authenticated');
                connect(tokens.access_token);
            } catch (error) {
                console.error('Authentication error:', error);
            }
        }
        callback({ cancel: false });
    });
});

function connect(authToken) {
    socket = new WebSocket(WS_URL, { headers: { Authorization: `Bearer ${authToken}` } });

    socket.on('open', () => {
        console.log('Connected to Nexus WebSocket');
        mainWindow.webContents.send('status', 'Connected');
        keepAlive();
    });

    socket.on('message', (data) => {
        console.log('Received:', data.toString());
    });

    socket.on('close', (code, reason) => {
        console.log(`Disconnected: ${code} - ${reason}`);
        mainWindow.webContents.send('status', 'Disconnected');
        reconnect(authToken);
    });

    socket.on('error', (err) => {
        console.error('WebSocket error:', err);
        socket.close();
    });
}

function keepAlive() {
    setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ "method": "ping" }));
            console.log('Sent: ping');
        }
    }, 30000);
}

function reconnect(authToken) {
    console.log('Reconnecting in 5 seconds...');
    setTimeout(() => connect(authToken), 5000);
}

// Функция проверки баланса
async function checkBalance() {
    try {
        const balanceWei = await provider.getBalance(walletAddress);
        const balanceNEX = ethers.formatEther(balanceWei);
        return balanceNEX;
    } catch (error) {
        console.error("Error getting balance:", error);
        return "Error";
    }
}

// Обработчик запроса баланса из Renderer процесса
ipcMain.handle("get-balance", async () => {
    return await checkBalance();
});

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
