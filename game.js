// ============================================================
// SPACE SHOOTER — полная логика игры
// ============================================================

// --- Элементы DOM ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const screens = {
    menu: document.getElementById('menu-screen'),
    upgrades: document.getElementById('upgrades-screen'),
    howto: document.getElementById('howto-screen'),
    game: document.getElementById('game-screen'),
    gameover: document.getElementById('gameover-screen'),
};

const hud = {
    level: document.getElementById('level-display'),
    score: document.getElementById('score-display'),
    lives: document.getElementById('lives-display'),
    weapon: document.getElementById('weapon-display'),
    coins: document.getElementById('coins-count'),
};

const final = {
    score: document.getElementById('final-score'),
    level: document.getElementById('final-level'),
    coins: document.getElementById('final-coins'),
};

// --- Состояние игры ---
const game = {
    running: false,
    score: 0,
    coins: 0,
    level: 1,
    lives: 3,
    maxLives: 3,
    enemiesKilled: 0,
    enemiesPerLevel: 10,
    spawnTimer: 0,
    spawnInterval: 1.5,
    levelTransition: false,
    levelTransitionTimer: 0,
    screenShake: 0,
    combo: 0,
    comboTimer: 0,
    weaponType: 'basic',
    weaponNames: {
        basic: 'Обычный',
        double: 'Двойной',
        triple: 'Тройной',
        spread: 'Веер',
        laser: 'Лазер',
    },
};

// --- Игрок ---
const player = {
    x: 0,
    y: 0,
    width: 30,
    height: 30,
    speed: 4,
    baseSpeed: 4,
    fireRate: 0.3,
    baseFireRate: 0.3,
    fireTimer: 0,
    damage: 1,
    baseDamage: 1,
    shield: 0,
    maxShield: 0,
    multiShot: 1,
    invincible: 0,
    engineFlicker: 0,
};

// --- Массивы объектов ---
let bullets = [];
let enemies = [];
let particles = [];
let powerups = [];
let stars = [];
let floatingTexts = [];

// --- Ввод ---
const keys = {};
let isMobile = false;
// Для touch-управления: корабль следует за пальцем
let touchTargetX = null;
let touchTargetY = null;
let touchActive = false;


// --- Сохранение ---
function saveGame() {
    const data = {
        coins: game.coins,
        upgrades: {
            speed: player.speed - player.baseSpeed,
            damage: player.damage - player.baseDamage,
            fireRate: Math.round((player.baseFireRate - player.fireRate) * 100) / 100,
            shield: player.maxShield,
            multiShot: player.multiShot - 1,
        },
        upgradeLevels: upgradeLevels,
    };
    try {
        localStorage.setItem('spaceShooterSave', JSON.stringify(data));
    } catch (e) {}
}

function loadGame() {
    try {
        const raw = localStorage.getItem('spaceShooterSave');
        if (!raw) return;
        const data = JSON.parse(raw);
        game.coins = data.coins || 0;
        if (data.upgrades) {
            player.speed = player.baseSpeed + (data.upgrades.speed || 0);
            player.damage = player.baseDamage + (data.upgrades.damage || 0);
            player.fireRate = Math.max(0.08, player.baseFireRate - (data.upgrades.fireRate || 0));
            player.maxShield = data.upgrades.shield || 0;
            player.shield = player.maxShield;
            player.multiShot = 1 + (data.upgrades.multiShot || 0);
        }
        if (data.upgradeLevels) {
            Object.assign(upgradeLevels, data.upgradeLevels);
        }
    } catch (e) {}
}

// --- Уровни прокачки ---
const upgradeLevels = {
    speed: 1,
    damage: 1,
    fireRate: 1,
    shield: 0,
    multiShot: 1,
};

const upgradeCosts = {
    speed: 100,
    damage: 150,
    fireRate: 200,
    shield: 300,
    multiShot: 500,
};

const upgradeMaxLevels = {
    speed: 10,
    damage: 10,
    fireRate: 10,
    shield: 5,
    multiShot: 5,
};

// --- Функции экранов ---
function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[id].classList.add('active');
}

function showMenu() {
    game.running = false;
    updateCoinsDisplay();
    updateUpgradesUI();
    showScreen('menu');
}

function startGame() {
    // Сброс игрока
    player.x = canvas.width / 2;
    player.y = canvas.height - player.height / 2 - 15;

    player.invincible = 0;
    player.shield = player.maxShield;
    player.fireTimer = 0;

    // Сброс игры
    game.score = 0;
    game.level = 1;
    game.lives = 3;
    game.enemiesKilled = 0;
    game.spawnTimer = 0;
    game.spawnInterval = 1.5;
    game.running = true;
    game.levelTransition = false;
    game.screenShake = 0;
    game.combo = 0;
    game.comboTimer = 0;
    game.weaponType = 'basic';

    bullets = [];
    enemies = [];
    particles = [];
    powerups = [];
    floatingTexts = [];

    showScreen('game');
    resizeCanvas();
    // После ресайза гарантированно ставим игрока внизу
    player.x = canvas.width / 2;
    player.y = canvas.height - player.height / 2 - 15;
    updateHUD();
}

function restartGame() {
    startGame();
}

function gameOver() {
    game.running = false;
    const earnedCoins = Math.floor(game.score / 10) + game.level * 5;
    game.coins += earnedCoins;
    saveGame();

    final.score.textContent = game.score;
    final.level.textContent = game.level;
    final.coins.textContent = earnedCoins;

    showScreen('gameover');
}

// --- HUD ---
function updateHUD() {
    hud.level.textContent = game.level;
    hud.score.textContent = game.score;
    hud.lives.textContent = game.lives;
    hud.weapon.textContent = game.weaponNames[game.weaponType] || 'Обычный';
}

function updateCoinsDisplay() {
    hud.coins.textContent = game.coins;
    document.getElementById('coins-count').textContent = game.coins;
}

function updateUpgradesUI() {
    for (const key of Object.keys(upgradeLevels)) {
        const el = document.getElementById(`upgrade-${key}`);
        if (el) el.textContent = upgradeLevels[key];
        const costEl = document.getElementById(`cost-${key}`);
        if (costEl) costEl.textContent = getUpgradeCost(key);
    }
    updateCoinsDisplay();
}

function getUpgradeCost(key) {
    const level = upgradeLevels[key];
    return Math.floor(upgradeCosts[key] * (1 + level * 0.5));
}

function buyUpgrade(key) {
    const level = upgradeLevels[key];
    if (level >= upgradeMaxLevels[key]) {
        showFloatingText(canvas.width / 2, canvas.height / 2, 'МАКСИМУМ!', '#ff4444');
        return;
    }
    const cost = getUpgradeCost(key);
    if (game.coins < cost) {
        showFloatingText(canvas.width / 2, canvas.height / 2, 'НЕ ХВАТАЕТ МОНЕТ!', '#ff4444');
        return;
    }

    game.coins -= cost;
    upgradeLevels[key]++;

    switch (key) {
        case 'speed':
            player.speed = player.baseSpeed + (upgradeLevels.speed - 1) * 0.5;
            break;
        case 'damage':
            player.damage = player.baseDamage + (upgradeLevels.damage - 1) * 0.5;
            break;
        case 'fireRate':
            player.fireRate = Math.max(0.08, player.baseFireRate - (upgradeLevels.fireRate - 1) * 0.025);
            break;
        case 'shield':
            player.maxShield = upgradeLevels.shield;
            player.shield = player.maxShield;
            break;
        case 'multiShot':
            player.multiShot = 1 + (upgradeLevels.multiShot - 1);
            break;
    }

    saveGame();
    updateUpgradesUI();
    showFloatingText(canvas.width / 2, canvas.height / 2, 'УЛУЧШЕНО!', '#4caf50');
}

// --- Canvas ---
function resizeCanvas() {
    const container = screens.game;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    // Просто ограничиваем позицию игрока в пределах экрана, не меняя её
    player.x = Math.max(player.width / 2, Math.min(player.x, canvas.width - player.width / 2));
    player.y = Math.max(player.height / 2, Math.min(player.y, canvas.height - player.height / 2));
}

window.addEventListener('resize', resizeCanvas);

// --- Звёзды (оптимизировано: рисуем одним путём) ---
function initStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 2 + 0.5,
            brightness: Math.random() * 0.5 + 0.5,
        });
    }
}

function updateStars() {
    for (const star of stars) {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    }
}

function drawStars() {
    // Рисуем все звёзды за один проход — группируем по яркости
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    for (const star of stars) {
        ctx.moveTo(star.x, star.y);
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    }
    ctx.fill();
}

// --- Частицы (оптимизировано: ограничение количества, группировка по цвету) ---
const MAX_PARTICLES = 200;

function spawnParticles(x, y, color, count = 10, speed = 3) {
    // Не спавним, если уже много частиц
    if (particles.length > MAX_PARTICLES) return;
    const maxToSpawn = Math.min(count, MAX_PARTICLES - particles.length);
    for (let i = 0; i < maxToSpawn; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * speed + 1;
        particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 1,
            decay: Math.random() * 0.03 + 0.02,
            size: Math.random() * 4 + 2,
            color: color,
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        p.size *= 0.98;
        if (p.life <= 0 || p.size < 0.5) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    // Рисуем все частицы одного цвета за раз
    let currentColor = '';
    ctx.beginPath();
    for (const p of particles) {
        if (p.color !== currentColor) {
            ctx.fill();
            ctx.beginPath();
            currentColor = p.color;
            ctx.fillStyle = p.color;
        }
        ctx.globalAlpha = p.life;
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
}

// --- Парящий текст ---
function showFloatingText(x, y, text, color = '#fff') {
    floatingTexts.push({
        x, y,
        text,
        color,
        life: 1,
        vy: -2,
    });
}

function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy;
        ft.life -= 0.02;
        if (ft.life <= 0) {
            floatingTexts.splice(i, 1);
        }
    }
}

function drawFloatingTexts() {
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    for (const ft of floatingTexts) {
        ctx.globalAlpha = ft.life;
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
}

// --- Игрок (оптимизировано: без save/restore, без Date.now) ---
function drawPlayer() {
    const p = player;

    // Мерцание при неуязвимости
    if (p.invincible > 0 && Math.floor(p.invincible * 10) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    // Двигатель
    p.engineFlicker += 0.2;
    const engineLen = 8 + Math.sin(p.engineFlicker) * 4;
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y + p.height / 2);
    ctx.lineTo(p.x, p.y + p.height / 2 + engineLen);
    ctx.lineTo(p.x + 8, p.y + p.height / 2);
    ctx.fill();

    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(p.x - 4, p.y + p.height / 2);
    ctx.lineTo(p.x, p.y + p.height / 2 + engineLen * 0.6);
    ctx.lineTo(p.x + 4, p.y + p.height / 2);
    ctx.fill();

    // Корпус корабля
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - p.height / 2);
    ctx.lineTo(p.x - p.width / 2, p.y + p.height / 2);
    ctx.lineTo(p.x - p.width / 4, p.y + p.height / 4);
    ctx.lineTo(p.x, p.y + p.height / 3);
    ctx.lineTo(p.x + p.width / 4, p.y + p.height / 4);
    ctx.lineTo(p.x + p.width / 2, p.y + p.height / 2);
    ctx.closePath();
    ctx.fill();

    // Обводка
    ctx.strokeStyle = '#88bbff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Кабина
    ctx.fillStyle = '#66ccff';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 2, 6, 0, Math.PI * 2);
    ctx.fill();

    // Щит
    if (p.shield > 0) {
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.width * 0.8, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Возвращаем alpha, если меняли
    if (p.invincible > 0) {
        ctx.globalAlpha = 1;
    }
}

function updatePlayer(dt) {
    const p = player;

    // Неуязвимость
    if (p.invincible > 0) p.invincible -= dt;

    // Движение с клавиатуры (ПК)
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) dx = -1;
    if (keys['ArrowRight'] || keys['KeyD']) dx = 1;
    if (keys['ArrowUp'] || keys['KeyW']) dy = -1;
    if (keys['ArrowDown'] || keys['KeyS']) dy = 1;

    // Touch-управление: корабль плавно следует за пальцем
    if (touchActive && touchTargetX !== null && touchTargetY !== null) {
        const targetDx = touchTargetX - p.x;
        const targetDy = touchTargetY - p.y;
        const dist = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
        if (dist > 2) {
            // Плавное движение к цели
            const speed = p.speed * 3; // чуть быстрее для отзывчивости
            p.x += (targetDx / dist) * Math.min(speed, dist);
            p.y += (targetDy / dist) * Math.min(speed, dist);
        }
    }

    // Нормализация диагонали (только для клавиатуры)
    if (dx !== 0 && dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len;
        dy /= len;
    }

    p.x += dx * p.speed;
    p.y += dy * p.speed;

    // Границы
    p.x = Math.max(p.width / 2, Math.min(canvas.width - p.width / 2, p.x));
    p.y = Math.max(p.height / 2, Math.min(canvas.height - p.height / 2, p.y));

    // Стрельба
    p.fireTimer -= dt;
    if (p.fireTimer <= 0) {
        fire();
        p.fireTimer = p.fireRate;
    }

    // Комбо таймер
    if (game.comboTimer > 0) {
        game.comboTimer -= dt;
        if (game.comboTimer <= 0) {
            game.combo = 0;
        }
    }
}

// --- Стрельба ---
function fire() {
    const p = player;
    const bulletSpeed = 8;
    const bulletColor = '#00ffff';

    const fireAngles = getFireAngles();

    for (const angle of fireAngles) {
        bullets.push({
            x: p.x,
            y: p.y - p.height / 2,
            vx: Math.sin(angle) * bulletSpeed,
            vy: -Math.cos(angle) * bulletSpeed,
            width: 4,
            height: 12,
            damage: p.damage,
            color: bulletColor,
            isPlayer: true,
            trail: [],
        });
    }
}

function getFireAngles() {
    const count = player.multiShot;
    if (count === 1) return [0];
    if (count === 2) return [-0.1, 0.1];
    if (count === 3) return [-0.15, 0, 0.15];
    if (count === 4) return [-0.2, -0.07, 0.07, 0.2];
    if (count >= 5) return [-0.25, -0.12, 0, 0.12, 0.25];
    return [0];
}

// --- Пули (оптимизировано: без трейлов, без shadowBlur на мобильных) ---
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // Удаление за экраном
        if (b.y < -20 || b.y > canvas.height + 20 || b.x < -20 || b.x > canvas.width + 20) {
            bullets.splice(i, 1);
        }
    }
}

function drawBullets() {
    for (const b of bullets) {
        if (b.isPlayer) {
            // Пуля игрока — просто прямоугольник
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
        } else {
            // Пуля врага — красный круг
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.width, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// --- Враги ---
const enemyTypes = {
    basic: {
        hp: 1,
        speed: 1.5,
        size: 20,
        color: '#ff4444',
        score: 10,
        coins: 2,
        shootChance: 0,
    },
    shooter: {
        hp: 2,
        speed: 1,
        size: 22,
        color: '#ff8800',
        score: 20,
        coins: 3,
        shootChance: 0.02,
    },
    tank: {
        hp: 4,
        speed: 0.8,
        size: 26,
        color: '#aa44ff',
        score: 30,
        coins: 5,
        shootChance: 0.01,
    },
    fast: {
        hp: 1,
        speed: 3,
        size: 16,
        color: '#ffaa00',
        score: 15,
        coins: 2,
        shootChance: 0,
    },
    boss: {
        hp: 20,
        speed: 0.5,
        size: 40,
        color: '#ff0055',
        score: 100,
        coins: 20,
        shootChance: 0.05,
    },
};

function spawnEnemy() {
    const level = game.level;
    let type = 'basic';

    // Выбор типа врага в зависимости от уровня
    const rand = Math.random();
    if (level >= 10 && rand < 0.05) {
        type = 'boss';
    } else if (level >= 5 && rand < 0.15) {
        type = 'tank';
    } else if (level >= 3 && rand < 0.3) {
        type = 'shooter';
    } else if (level >= 2 && rand < 0.2) {
        type = 'fast';
    }

    const template = enemyTypes[type];
    const size = template.size;
    const x = Math.random() * (canvas.width - size * 2) + size;
    const y = -size;

    // Масштабирование HP от уровня
    const hpMult = 1 + (level - 1) * 0.15;

    enemies.push({
        x, y,
        width: size,
        height: size,
        vx: (Math.random() - 0.5) * 0.5,
        vy: template.speed * (1 + (level - 1) * 0.05),
        hp: Math.ceil(template.hp * hpMult),
        maxHp: Math.ceil(template.hp * hpMult),
        type: type,
        color: template.color,
        score: template.score,
        coins: template.coins,
        shootChance: template.shootChance * (1 + (level - 1) * 0.1),
        shootTimer: Math.random() * 2,
        wobble: Math.random() * Math.PI * 2,
    });
}

function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.wobble += dt * 2;
        e.x += e.vx + Math.sin(e.wobble) * 0.3;
        e.y += e.vy;

        // Стрельба врагов
        if (e.shootChance > 0 && e.y > 0) {
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
                e.shootTimer = 1.5 / e.shootChance;
                // Враг стреляет
                const angle = Math.atan2(player.y - e.y, player.x - e.x);
                bullets.push({
                    x: e.x,
                    y: e.y + e.height / 2,
                    vx: Math.cos(angle) * 3,
                    vy: Math.sin(angle) * 3,
                    width: 4,
                    height: 4,
                    damage: 1,
                    color: '#ff4444',
                    isPlayer: false,
                    trail: [],
                });
            }
        }

        // Удаление за экраном
        if (e.y > canvas.height + 50) {
            enemies.splice(i, 1);
        }
    }
}

function drawEnemies() {
    for (const e of enemies) {
        // Корпус
        ctx.fillStyle = e.color;

        // Рисуем врага в зависимости от типа
        const hw = e.width / 2;
        const hh = e.height / 2;

        if (e.type === 'boss') {
            // Босс — большой ромб
            ctx.beginPath();
            ctx.moveTo(e.x, e.y - hh);
            ctx.lineTo(e.x + hw, e.y);
            ctx.lineTo(e.x, e.y + hh);
            ctx.lineTo(e.x - hw, e.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ff88aa';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Глаза босса
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(e.x - 8, e.y - 3, 4, 0, Math.PI * 2);
            ctx.arc(e.x + 8, e.y - 3, 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (e.type === 'tank') {
            // Танк — шестиугольник
            ctx.beginPath();
            for (let j = 0; j < 6; j++) {
                const angle = (j / 6) * Math.PI * 2 - Math.PI / 2;
                const px = e.x + Math.cos(angle) * hw;
                const py = e.y + Math.sin(angle) * hh;
                j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#cc88ff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else if (e.type === 'shooter') {
            // Стрелок — треугольник вниз
            ctx.beginPath();
            ctx.moveTo(e.x, e.y + hh);
            ctx.lineTo(e.x - hw, e.y - hh);
            ctx.lineTo(e.x + hw, e.y - hh);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffcc66';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else if (e.type === 'fast') {
            // Быстрый — маленький ромб
            ctx.beginPath();
            ctx.moveTo(e.x, e.y - hh);
            ctx.lineTo(e.x + hw * 0.7, e.y);
            ctx.lineTo(e.x, e.y + hh);
            ctx.lineTo(e.x - hw * 0.7, e.y);
            ctx.closePath();
            ctx.fill();
        } else {
            // Обычный — квадрат
            ctx.fillRect(e.x - hw, e.y - hh, e.width, e.height);
        }

        // Полоска HP
        if (e.hp < e.maxHp) {
            const barWidth = e.width;
            const barHeight = 3;
            const barX = e.x - barWidth / 2;
            const barY = e.y - e.height / 2 - 8;
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#4caf50' : e.hp / e.maxHp > 0.25 ? '#ff9800' : '#f44336';
            ctx.fillRect(barX, barY, barWidth * (e.hp / e.maxHp), barHeight);
        }
    }
}

// --- Столкновения ---
function checkCollisions() {
    // Пули игрока по врагам
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (!b.isPlayer) continue;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (rectCollide(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height,
                           e.x - e.width / 2, e.y - e.height / 2, e.width, e.height)) {
                // Попадание!
                e.hp -= b.damage;
                spawnParticles(b.x, b.y, e.color, 5, 2);
                bullets.splice(i, 1);

                if (e.hp <= 0) {
                    // Враг уничтожен
                    spawnParticles(e.x, e.y, e.color, 20, 4);
                    game.score += e.score * (1 + game.combo * 0.1);
                    game.coins += e.coins;
                    game.enemiesKilled++;
                    game.combo++;
                    game.comboTimer = 2;

                    if (game.combo > 1) {
                        showFloatingText(e.x, e.y - 20, `x${game.combo} COMBO!`, '#ffd700');
                    }

                    // Шанс выпадения усиления
                    if (Math.random() < 0.08) {
                        powerups.push({
                            x: e.x,
                            y: e.y,
                            type: Math.random() < 0.5 ? 'health' : 'weapon',
                            vy: 1,
                            life: 5,
                        });
                    }

                    enemies.splice(j, 1);
                    game.screenShake = 5;
                    updateHUD();
                }
                break;
            }
        }
    }

    // Пули врагов по игроку
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (b.isPlayer) continue;

        if (rectCollide(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height,
                       player.x - player.width / 2, player.y - player.height / 2,
                       player.width, player.height)) {
            bullets.splice(i, 1);
            hitPlayer();
        }
    }

    // Враги касаются игрока
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (rectCollide(e.x - e.width / 2, e.y - e.height / 2, e.width, e.height,
                       player.x - player.width / 2, player.y - player.height / 2,
                       player.width, player.height)) {
            spawnParticles(e.x, e.y, e.color, 15, 3);
            enemies.splice(i, 1);
            hitPlayer();
        }
    }

    // Усиления
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.y += p.vy;
        p.life -= 0.016;

        if (p.life <= 0) {
            powerups.splice(i, 1);
            continue;
        }

        if (rectCollide(p.x - 10, p.y - 10, 20, 20,
                       player.x - player.width / 2, player.y - player.height / 2,
                       player.width, player.height)) {
            if (p.type === 'health') {
                if (player.shield < player.maxShield) {
                    player.shield = Math.min(player.maxShield, player.shield + 1);
                    showFloatingText(p.x, p.y, '+ЩИТ', '#00ff88');
                } else if (game.lives < game.maxLives) {
                    game.lives++;
                    showFloatingText(p.x, p.y, '+ЖИЗНЬ', '#ff4488');
                } else {
                    game.coins += 5;
                    showFloatingText(p.x, p.y, '+5⭐', '#ffd700');
                }
            } else if (p.type === 'weapon') {
                const weapons = ['basic', 'double', 'triple', 'spread', 'laser'];
                const idx = weapons.indexOf(game.weaponType);
                if (idx < weapons.length - 1) {
                    game.weaponType = weapons[idx + 1];
                    showFloatingText(p.x, p.y, game.weaponNames[game.weaponType] + '!', '#00ccff');
                } else {
                    game.coins += 10;
                    showFloatingText(p.x, p.y, '+10⭐', '#ffd700');
                }
                updateHUD();
            }
            spawnParticles(p.x, p.y, '#ffd700', 10, 3);
            powerups.splice(i, 1);
        }
    }
}

function rectCollide(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

function hitPlayer() {
    if (player.invincible > 0) return;

    if (player.shield > 0) {
        player.shield--;
        player.invincible = 1;
        spawnParticles(player.x, player.y, '#00ff88', 10, 3);
        showFloatingText(player.x, player.y - 30, 'ЩИТ!', '#00ff88');
        return;
    }

    game.lives--;
    player.invincible = 2;
    game.screenShake = 10;
    spawnParticles(player.x, player.y, '#ff4444', 15, 4);
    updateHUD();

    if (game.lives <= 0) {
        gameOver();
    }
}

// --- Уровни ---
function checkLevelProgress() {
    if (game.enemiesKilled >= game.enemiesPerLevel * game.level && !game.levelTransition) {
        game.levelTransition = true;
        game.levelTransitionTimer = 2;
        game.level++;
        game.enemiesKilled = 0;
        game.spawnInterval = Math.max(0.3, 1.5 - game.level * 0.05);

        // Бонус за уровень
        game.coins += game.level * 10;
        showFloatingText(canvas.width / 2, canvas.height / 2, `УРОВЕНЬ ${game.level}!`, '#4fc3f7');

        // Восстановление щита
        player.shield = player.maxShield;

        updateHUD();
        saveGame();
    }
}

function updateLevelTransition(dt) {
    if (game.levelTransition) {
        game.levelTransitionTimer -= dt;
        if (game.levelTransitionTimer <= 0) {
            game.levelTransition = false;
        }
    }
}

// --- Powerups drawing (оптимизировано: без shadowBlur, без Date.now) ---
function drawPowerups() {
    for (const p of powerups) {
        if (p.type === 'health') {
            ctx.fillStyle = '#00ff88';
            // Крест
            ctx.fillRect(p.x - 3, p.y - 8, 6, 16);
            ctx.fillRect(p.x - 8, p.y - 3, 16, 6);
        } else if (p.type === 'weapon') {
            ctx.fillStyle = '#ffaa00';
            // Звезда
            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
                const angle = (j / 5) * Math.PI * 2 - Math.PI / 2;
                const r = j % 2 === 0 ? 10 : 5;
                const px = p.x + Math.cos(angle) * r;
                const py = p.y + Math.sin(angle) * r;
                j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }
    }
}

// --- Инициализация ---
function init() {
    loadGame();
    resizeCanvas();
    initStars();
    updateCoinsDisplay();
    updateUpgradesUI();

    // Кнопки меню
    document.getElementById('btn-play').addEventListener('click', startGame);
    document.getElementById('btn-upgrades').addEventListener('click', () => {
        updateUpgradesUI();
        showScreen('upgrades');
    });
    document.getElementById('btn-howto').addEventListener('click', () => showScreen('howto'));

    // Клавиатура
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'Space') e.preventDefault();
    });
    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    // Touch-управление: корабль следует за пальцем по всему экрану
    function getCanvasCoords(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height),
        };
    }

    function handleTouchStart(e) {
        e.preventDefault();
        isMobile = true;
        const touch = e.touches[0];
        const coords = getCanvasCoords(touch.clientX, touch.clientY);
        touchTargetX = coords.x;
        touchTargetY = coords.y;
        touchActive = true;
    }

    function handleTouchMove(e) {
        e.preventDefault();
        if (!touchActive) return;
        const touch = e.touches[0];
        const coords = getCanvasCoords(touch.clientX, touch.clientY);
        touchTargetX = coords.x;
        touchTargetY = coords.y;
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        touchActive = false;
        touchTargetX = null;
        touchTargetY = null;
    }

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Определение мобильного устройства
    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Запуск игрового цикла
    requestAnimationFrame(gameLoop);
}

// --- Игровой цикл ---
let lastTime = 0;

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (game.running) {
        update(dt);
        render();
    }

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // Обновление звёзд
    updateStars();

    // Спавн врагов
    if (!game.levelTransition) {
        game.spawnTimer -= dt;
        if (game.spawnTimer <= 0) {
            spawnEnemy();
            game.spawnTimer = game.spawnInterval;
        }
    }

    // Обновление игрока
    updatePlayer(dt);

    // Обновление пуль
    updateBullets();

    // Обновление врагов
    updateEnemies(dt);

    // Столкновения
    checkCollisions();

    // Частицы
    updateParticles();

    // Текст
    updateFloatingTexts();

    // Уровни
    checkLevelProgress();
    updateLevelTransition(dt);

    // Тряска экрана
    if (game.screenShake > 0) {
        game.screenShake -= dt * 10;
        if (game.screenShake < 0) game.screenShake = 0;
    }
}

function render() {
    ctx.save();

    // Тряска экрана
    if (game.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * game.screenShake;
        const shakeY = (Math.random() - 0.5) * game.screenShake;
        ctx.translate(shakeX, shakeY);
    }

    // Очистка
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);

    // Звёзды
    drawStars();

    // Усиления
    drawPowerups();

    // Враги
    drawEnemies();

    // Пули
    drawBullets();

    // Игрок
    drawPlayer();

    // Частицы
    drawParticles();

    // Текст
    drawFloatingTexts();

    // Переход между уровнями
    if (game.levelTransition) {
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.5, game.levelTransitionTimer * 0.25)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#4fc3f7';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#4fc3f7';
        ctx.shadowBlur = 30;
        ctx.fillText(`УРОВЕНЬ ${game.level}`, canvas.width / 2, canvas.height / 2);
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

// --- Запуск ---
window.addEventListener('load', init);
window.addEventListener('resize', () => {
    resizeCanvas();
    initStars();
});


