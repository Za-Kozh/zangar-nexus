require('dotenv').config();
const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const { google } = require('googleapis');
const { ethers } = require("ethers");
const { exec } = require('child_process');
const WebSocket = require('ws');
const { error } = require('console');

const WS_URL = 'wss://rpc.nexus.xyz/ws';
const CLIENT_ID = '60646434375-hjuv1f61dsqqqeetaoqq6oc2klnh4eoq.apps.googleusercontent.com'; // CLIENT_ID from Google Console Cloud Oauth
const CLIENT_SECRET = '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'; // CLIENT_SECRET from Google Console Cloud Oauth
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const provider = new ethers.JsonRpcProvider("https://rpc.nexus.xyz/http");
const walletAddress = "0xD39ad8a68D85cfD2E1Cd3fbA01B392D8b335eAe9"; // Nexus Wallet Address

let socket;
let mainWindow;
let authWindow;
let rewardsWindow;

// Main Interface
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        resizable: false,
        title: 'Nexus Farmer',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('index.html');
}

// Reward Window
function createRewardsWindow() {
    // Если окно уже создано, просто показываем его
    if (rewardsWindow) {
      rewardsWindow.show();
      return;
    }
    rewardsWindow = new BrowserWindow({
      width: 400,
      height: 600,
      resizable: false,
      title: 'Rewards Monitor',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    });
    rewardsWindow.loadFile('rewards.html');
    rewardsWindow.on('closed', () => {
      rewardsWindow = null;
    });
  }

ipcMain.on('openRewards', () => {
    createRewardsWindow();
});


// Opening the Google OAuth window
ipcMain.on('login', async () => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
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

    // Authorization code interception
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
        mainWindow.webContents.send('status', '✅');
    });

    socket.on('message', (data) => {
        console.log('Received:', data.toString());
    });

    socket.on('close', (code, reason) => {
        console.log(`Disconnected: ${code} - ${reason}`);
        mainWindow.webContents.send('status', '❌');
        reconnect(authToken);
    });

    socket.on('error', (err) => {
        console.error('WebSocket error:', err);
        socket.close();
    });
}

function reconnect(authToken) {
    console.log('Reconnecting in 5 seconds...');
    setTimeout(() => connect(authToken), 5000);
}

// Обработчик запроса обновления наград
ipcMain.on('request-reward-update', (event) => {
    exec('nexus-cli status', (error, stdout, stderr) => {
      if (error) {
        console.error('Ошибка CLI:', error);
        return;
      }
      event.reply('reward-update', stdout);
    });
});

// Balance check function
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

// Handler for balance request from Renderer process
ipcMain.handle("get-balance", async () => {
    return await checkBalance();
});

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    setInterval(() => {
        exec('npx nexus-cli status', (error, stdout, stderr) => {
          if (error) {
            console.error('Ошибка CLI:', error);
            return;
          }
          // Если окно наград открыто, отправляем обновление
          if (rewardsWindow) {
            rewardsWindow.webContents.send('reward-update', stdout);
          }
        });
      }, 10000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
