const { ipcRenderer } = require('electron');

// Обработчик нажатия кнопки "Войти через Google"
document.getElementById('login').addEventListener('click', () => {
    ipcRenderer.send('login');
});

// Функция обновления баланса
async function updateBalance() {
    const balance = await ipcRenderer.invoke('get-balance');
    document.getElementById('balance').innerText = `${balance} NEX`;
}

// Инициализация интерфейса
document.addEventListener('DOMContentLoaded', () => {
    updateBalance();
    setInterval(updateBalance, 1800000); // Обновляем баланс каждые 30 минут
});

// Функция обновления статуса подключения
ipcRenderer.on('status', (event, status) => {
    document.getElementById('status').innerText = `Статус: ${status}`;
});