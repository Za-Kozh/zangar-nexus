const { ipcRenderer } = require('electron');

// Handler for clicking the “Sign in via Google” button
document.getElementById('login').addEventListener('click', () => {
  ipcRenderer.send('login');
});

document.getElementById('openRewards').addEventListener('click', () => {
  ipcRenderer.send('openRewards');
});

// Balance update function
async function updateBalance() {
  try {
    const balance = await ipcRenderer.invoke('get-balance');
    document.getElementById('balance').innerText = `${balance} NEX`;
  } catch (error) {
    console.error("Ошибка обновления баланса:", error);
    document.getElementById('balance').innerText = "Ошибка";
  }
}

// Interface initialization
document.addEventListener('DOMContentLoaded', () => {
  updateBalance();
  setInterval(updateBalance, 1800000); // Обновляем баланс каждые 30 минут
});

// Connection status update function
ipcRenderer.on('status', (event, status) => {
  document.getElementById('status').innerText = `Status: ${status}`;
});

ipcRenderer.on('reward-update', (event, data) => {
  console.log('Обновление наград:', data);
  // Если требуется, здесь можно обновлять UI или выполнять другие действия
});