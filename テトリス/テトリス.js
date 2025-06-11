const canvas = document.getElementById("tetris");
const con = canvas.getContext("2d");

const BLOCK_SIZE = 30;
const TETRO_SIZE = 4;
const FIELD_COL = 10;
const FIELD_ROW = 20;
const INITIAL_GAME_SPEED = 750;
let GAME_SPEED = INITIAL_GAME_SPEED; // 初期スピード設定
const INITIAL_DELAY_SPEED = 30;
const INITIAL_ROTATE_SPEED = 60;
const INITIAL_JUMP_SPEED = 150;

const overlayCanvas = document.getElementById('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');

var BGM = document.getElementById('BGM');
BGM.loop = true;
const tetroMoveSound = document.getElementById('MoveAndRotateSound');
const lineDereteSound = document.getElementById('lineDereteSound');
const GameOverSound = document.getElementById('GameOverSound');

// テトリミノの色
const TETRO_COLORS = [
    "#FF5733", // オレンジ
    "#33FF57", // 緑
    "#3357FF", // 青
    "#FF33FF", // ピンク
    "#FFFF33", // 黄
    "#33FFFF", // シアン
    "#FF3333"  // 赤
];
const GHOST_COLOR = 'rgba(200, 200, 200, 0.5)';

let tetro_x = 3;
let tetro_y = 0;
let tetro_n = 0;
let tetro;
let nextTetro_n = 0;
let nextTetro;
let field = [];
let over = false;
let score = 0;
let lines = 0;
let tetroQueue = [];
let gameInterval;
let delayInterval;
let rotateInterval;
let jumpInterval;
let speedIncreaseCounter = 0;
let countDownFlame = 300;
let highScore = localStorage.getItem('highScore') || 0;
let MoveDelay = 1;
let softDownDelay = 1;
let rotateMoveDelay = 1;
let hardDownDelay = 1;

let animationFrameId;

let left_ankle = null;
let right_ankle = null;
let left_wrist = null;
let right_wrist = null;
let previousLeftAnkleY = null;
let previousRightAnkleY = null;
/*
ハイスコアリセット用
*/
//highScore = 0;

async function setupCamera() {
    const video = document.getElementById('video');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 'video': {} });
        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });
    } catch (error) {
        console.error('カメラのアクセスに失敗しました:', error);
    }
}

// MoveNetをロード
async function loadMoveNet() {
    await tf.setBackend('webgl');
    const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
        modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING //SINGLE MULTI
    });
    return detector;
}

async function estimatePoses(video, detector) {
    return await detector.estimatePoses(video);
}

async function setup() {
    const video = await setupCamera();
    if (!video) {
        return;
    }
    const detector = await loadMoveNet();
    video.play();
    // フレームごとに姿勢推定を行う
    async function detect() {
        try {
            const poses = await estimatePoses(video, detector);
            let middle = 0;
            let middleHuman = 0;
            let i = 0;
            poses.forEach((pose) => {
                let left_eye = poses[i].keypoints.find(keypoint => keypoint.name === "left_eye");
                let right_eye = poses[i].keypoints.find(keypoint => keypoint.name === "right_eye");
                if (left_eye && right_eye) {
                    if (middle < Math.sqrt((left_eye.x - right_eye.x) ** 2 + (left_eye.y - right_eye.y) ** 2)) {
                        middle = Math.sqrt((left_eye.x - right_eye.x) ** 2 + (left_eye.y - right_eye.y) ** 2);
                        middleHuman = i;
                    }
                    i++;
                }
            });
            if (poses.length > 0) {
                left_ankle = poses[middleHuman].keypoints.find(keypoint => keypoint.name === "left_ankle");
                right_ankle = poses[middleHuman].keypoints.find(keypoint => keypoint.name === "right_ankle");
                left_wrist = poses[middleHuman].keypoints.find(keypoint => keypoint.name === "left_wrist");
                right_wrist = poses[middleHuman].keypoints.find(keypoint => keypoint.name === "right_wrist");
                left_shoulder = poses[middleHuman].keypoints.find(keypoint => keypoint.name === "left_shoulder");
                right_shoulder = poses[middleHuman].keypoints.find(keypoint => keypoint.name === "right_shoulder");
                overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
                drawKeypoints(poses[middleHuman].keypoints, overlayCtx);
                if (left_ankle && right_ankle) {
                    if (left_wrist && right_wrist) {
                        if (left_shoulder && right_shoulder) {
                            controlTetris(left_ankle, right_ankle, left_wrist, right_wrist, left_shoulder, right_shoulder);
                        }
                    }
                }

            }
        } catch (error) {
            console.error('姿勢推定に失敗しました:', error);
            cancelAnimationFrame(animationFrameId);
        }
        animationFrameId = requestAnimationFrame(detect);
    }
    detect();
}

function drawKeypoints(keypoints, context) {
    keypoints.forEach((keypoint) => {
        if (keypoint.name === "left_ankle" || keypoint.name === "right_ankle" || keypoint.name === "left_wrist" || keypoint.name === "right_wrist" || keypoint.name === "left_shoulder" || keypoint.name === "right_shoulder") {
            let color = null;
            switch (keypoint.name) {
                case "left_ankle":
                    color = `rgba(255, 0, 0, 0.5)`;
                    break;
                case "right_ankle":
                    color = `rgba(0, 255, 0, 0.5)`;
                    break;
                case "left_wrist":
                    color = `rgba(0, 0, 255, 0.5)`;
                    break;
                case "right_wrist":
                    color = `rgba(255, 0, 255, 0.5)`;
                    break;
                case "left_shoulder":
                    color = 'rgba(255, 255, 0, 0.5)'
                    break;
                case "right_shoulder":
                    color = 'rgba(0, 255, 255, 0.5)'
                    break;
            }
            context.beginPath();
            context.arc(overlayCanvas.width - keypoint.x, keypoint.y, 10, 0, 12 * Math.PI);
            context.fillStyle = color;
            context.fill();
            context.closePath();
        }
    });
}

function init() {
    setup();
    countDown();
}

function countDown() {
    con.fillStyle = "black";
    con.fillRect(0, 0, canvas.width, canvas.height);
    con.fillStyle = "white";
    con.font = "30px Arial";
    con.textAlign = "center";
    con.fillText(Math.ceil(countDownFlame / 60), canvas.width / 2, canvas.height / 2);
    countDownFlame--;
    if (countDownFlame > 0) {
        requestAnimationFrame(countDown);
    } else {
        BGM.play();
        gameInterval = setInterval(gameLoop, GAME_SPEED);
        delayInterval = setInterval(delay, INITIAL_DELAY_SPEED);
        rotateInterval = setInterval(rotateDelay, INITIAL_ROTATE_SPEED);
    }
}

// テトリミノ設定
const TETRO_TYPES = [
    [
        // L
        [0, 0, 0, 0],
        [0, 0, 1, 0],
        [1, 1, 1, 0],
        [0, 0, 0, 0]
    ],
    [   // I
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    [   // S
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [1, 1, 0, 0],
        [0, 0, 0, 0]
    ],
    [   // Z
        [0, 0, 0, 0],
        [1, 1, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0]
    ],
    [   // J
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [1, 1, 1, 0],
        [0, 0, 0, 0]
    ],
    [   // O
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0]
    ],
    [   // T
        [0, 0, 0, 0],
        [0, 1, 0, 0],
        [1, 1, 1, 0],
        [0, 0, 0, 0]
    ],
];

// フィールドの初期化
for (let y = 0; y < FIELD_ROW; y++) {
    field[y] = [];
    for (let x = 0; x < FIELD_COL; x++) {
        field[y][x] = 0;
    }
}

// テトリミノの順番をシャッフル
function shuffleTetroQueue() {
    tetroQueue = [];
    while (tetroQueue.length < TETRO_TYPES.length) {
        let index = Math.floor(Math.random() * TETRO_TYPES.length);
        if (!tetroQueue.includes(index)) {
            tetroQueue.push(index);
        }
    }
}

// 新しいテトリミノをセット
function setTetro() {
    if (tetroQueue.length === 0) {
        shuffleTetroQueue();
    }
    tetro_n = tetroQueue.shift();
    tetro = TETRO_TYPES[tetro_n];
    tetro_x = 3;
    tetro_y = 0;
    if (tetroQueue.length === 0) {
        shuffleTetroQueue();
    }
    nextTetro_n = tetroQueue[0];
    nextTetro = TETRO_TYPES[nextTetro_n];
}

shuffleTetroQueue();
setTetro();

function calculateGhostPosition() {
    let ghostY = tetro_y;
    while (checkMove(0, ghostY - tetro_y + 1)) {
        ghostY++;
    }
    return ghostY;
}

function drawBlock(x, y, c) {
    let px = x * BLOCK_SIZE;
    let py = y * BLOCK_SIZE;
    con.fillStyle = TETRO_COLORS[c];
    con.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
    con.strokeStyle = "#505050";
    con.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
}

function drawGhostPiece(ghostY) {
    for (let y = 0; y < TETRO_SIZE; y++) {
        for (let x = 0; x < TETRO_SIZE; x++) {
            if (tetro[y][x]) {
                let px = (tetro_x + x) * BLOCK_SIZE;
                let py = (ghostY + y) * BLOCK_SIZE;
                con.fillStyle = GHOST_COLOR;
                con.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
                con.strokeStyle = "#505050";
                con.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
            }
        }
    }
}

function controlTetris(left_ankle, right_ankle, left_wrist, right_wrist, left_shoulder, right_shoulder) {
    if (over) return;
    const ankleDistance = right_ankle.y - left_ankle.y;
    const wristDistance = left_wrist.x - right_wrist.x;
    const threshold = Math.abs(left_shoulder.x - right_shoulder.x);
    const gutsDistance = Math.abs(left_shoulder.x - right_shoulder.x) / 2;
    const TPOSE_THRESHOLD = Math.abs(left_shoulder.x - right_shoulder.x) * 3;
    if (ankleDistance < -threshold / 4.5) {
        // 右に移動
        if (checkMove(1, 0) && MoveDelay <= 0) {
            MoveDelay = 10;
            tetro_x++;
            drawAll();
            drawInfo();
            tetroMoveSound.play();
        }
    } else if (ankleDistance > threshold / 4.5) {
        // 左に移動
        if (checkMove(-1, 0) && MoveDelay <= 0) {
            MoveDelay = 10;
            tetro_x--;
            drawAll();
            drawInfo();
            tetroMoveSound.play();
        }
    }
    // 右回転
    if (wristDistance >= TPOSE_THRESHOLD && rotateMoveDelay <= 0) {
        rotatedTetro = rotate();
        if (checkMove(0, 0, rotatedTetro)) {
            rotateMoveDelay = 10;
            tetro = rotatedTetro;
            drawAll();
            drawInfo();
            tetroMoveSound.play();
        }
    }
    //高速落下
    if (Math.sqrt((left_wrist.x - left_shoulder.x) ** 2 + (left_wrist.y - left_shoulder.y) ** 2) < gutsDistance) {
        if (Math.sqrt((right_wrist.x - right_shoulder.x) ** 2 + (right_wrist.y - right_shoulder.y) ** 2) < gutsDistance) {
            if (checkMove(0, 1) && softDownDelay <= 0) {
                tetro_y++;
                softDownDelay = 10;
                drawAll();
                drawInfo();
                tetroMoveSound.play();
            }
        }
    }
}

function moveTetroDownImmediately() {
    while (checkMove(0, 1)) {
        tetro_y++;
    }
    drawAll();
    drawInfo();
    tetroMoveSound.play();
}

// キーボードアクション
document.onkeydown = function (e) {
    let rotatedTetro;
    switch (e.keyCode) {
        case 37: // 左
            if (over) return;
            if (checkMove(-1, 0) && MoveDelay <= 0) {
                tetro_x--;
                tetroMoveSound.play();
            }
            break;
        case 38: // 上
            if (over) return;
            if (hardDownDelay <= 0) {
                moveTetroDownImmediately();
            }
            break;
        case 39: // 右
            if (over) return;
            if (checkMove(1, 0) && MoveDelay <= 0) {
                tetro_x++;
                tetroMoveSound.play();
            }
            break;
        case 40: // 下
            if (over) return;
            if (checkMove(0, 1) && softDownDelay <= 0) {
                tetro_y++;
                tetroMoveSound.play();
            }
            break;
        case 32: // スペース
            if (over) return;
            rotatedTetro = rotate();
            if (checkMove(0, 0, rotatedTetro) && rotateMoveDelay <= 0) {
                tetro = rotatedTetro;
                tetroMoveSound.play();
            }
            break;
        case 82: //Rキー
            if (over) {
                resetGame();
            }
            break;
    }
    drawAll();
    drawInfo();
};

function drawAll() {
    con.clearRect(0, 0, canvas.width, canvas.height);
    con.fillStyle = "rgba(0,0,0)";
    con.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < FIELD_ROW; y++) {
        for (let x = 0; x < FIELD_COL; x++) {
            if (field[y][x]) {
                drawBlock(x, y, field[y][x] - 1);
            }
        }
    }
    let ghostY = calculateGhostPosition();
    drawGhostPiece(ghostY);
    for (let y = 0; y < TETRO_SIZE; y++) {
        for (let x = 0; x < TETRO_SIZE; x++) {
            if (tetro[y][x]) {
                drawBlock(tetro_x + x, tetro_y + y, tetro_n);
            }
        }
    }
    // 縦の線
    con.strokeStyle = "#FFF";
    con.lineWidth = 2;
    con.beginPath();
    con.moveTo(BLOCK_SIZE * FIELD_COL, 0);
    con.lineTo(BLOCK_SIZE * FIELD_COL, canvas.height);
    con.stroke();
    con.moveTo(0, 90);
    con.lineTo(BLOCK_SIZE * FIELD_COL, 90);
    con.stroke();

}
// ゲーム情報を描画
function drawInfo() {
    con.fillStyle = "white";
    con.font = "20px Arial";
    con.textAlign = "left";
    con.textBaseline = "top";
    if (score < 1000) {
        con.fillText("Score: " + score, 320, 50);
    } else if (score % 1000 == 0) {
        con.fillText("Score: " + Math.trunc(score / 1000) + ",000", 320, 50);
    } else {
        con.fillText("Score: " + Math.trunc(score / 1000) + "," + score % 1000, 320, 50);
    }
    con.fillText("Lines: " + lines, 320, 100);
    if (highScore < 1000) {
        con.fillText("High Score: " + highScore, 320, 150);
    } else if (highScore % 1000 == 0) {
        con.fillText("High Score: " + Math.trunc(highScore / 1000) + ",000", 320, 150);
    } else {
        con.fillText("High Score: " + Math.trunc(highScore / 1000) + "," + highScore % 1000, 320, 150);
    }
    con.fillText("Next", 425, 200);
    for (let y = 0; y < TETRO_SIZE; y++) {
        for (let x = 0; x < TETRO_SIZE; x++) {
            if (nextTetro[y][x]) {
                drawBlock(x + 13, y + 8, nextTetro_n);
            }
        }
    }
}
// テトリミノの回転
function rotate() {
    let rotatedTetro = [];
    for (let x = 0; x < TETRO_SIZE; x++) {
        rotatedTetro[x] = [];
        for (let y = 0; y < TETRO_SIZE; y++) {
            rotatedTetro[x][y] = tetro[TETRO_SIZE - y - 1][x];
        }
    }
    // 回転後のテトリミノが移動可能かチェック
    if (checkMove(0, 0, rotatedTetro)) {
        return rotatedTetro;
    }
    const wallKickOffsets = [
        { x: 0, y: 0 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: -1, y: -1 },
        { x: 1, y: 1 }
    ];
    for (let i = 0; i < wallKickOffsets.length; i++) {
        const offsetX = wallKickOffsets[i].x;
        const offsetY = wallKickOffsets[i].y;
        if (checkMove(offsetX, offsetY, rotatedTetro)) {
            tetro_x += offsetX;
            tetro_y += offsetY;
            return rotatedTetro;
        }
    }
    return tetro;
}
// テトリミノが移動できるか確認
function checkMove(dx, dy, testTetro = tetro) {
    for (let y = 0; y < TETRO_SIZE; y++) {
        for (let x = 0; x < TETRO_SIZE; x++) {
            if (testTetro[y][x]) {
                let newX = tetro_x + x + dx;
                let newY = tetro_y + y + dy;
                if (newX < 0 || newX >= FIELD_COL || newY >= FIELD_ROW || field[newY][newX]) {
                    return false;
                }
            }
        }
    }
    return true;
}

function delay() {
    MoveDelay--;
    softDownDelay--;
    if (left_ankle) previousLeftAnkleY = left_ankle.y;
    if (right_ankle) previousRightAnkleY = right_ankle.y;
}
function rotateDelay() {
    rotateMoveDelay--;
}
function addTetroToField() {
    for (let y = 0; y < TETRO_SIZE; y++) {
        for (let x = 0; x < TETRO_SIZE; x++) {
            if (tetro[y][x]) {
                field[tetro_y + y][tetro_x + x] = tetro_n + 1;
            }
        }
    }
    removeFullLines();
}

function removeFullLines() {
    let lineDeleteCount = 0;
    for (let y = FIELD_ROW - 1; y >= 0; y--) {
        let isFull = true;
        for (let x = 0; x < FIELD_COL; x++) {
            if (field[y][x] === 0) {
                isFull = false;
                break;
            }
        }
        if (isFull) {
            for (let row = y; row > 0; row--) {
                for (let x = 0; x < FIELD_COL; x++) {
                    field[row][x] = field[row - 1][x];
                }
            }
            for (let x = 0; x < FIELD_COL; x++) {
                field[0][x] = 0;
            }
            lines++;
            lineDeleteCount++;
            y++;
        }
    }
    if (lineDeleteCount != 0) {
        calculateScore(lineDeleteCount);//スコア計算
        adjustGameSpeed();//ゲームスピード変更
        lineDereteSound.play();
    }
}

function calculateScore(lineDeleteCount) {
    switch (lineDeleteCount) {
        case 1:
            score += 100; // シングル
            break;
        case 2:
            score += 300; // ダブル
            break;
        case 3:
            score += 500; // トリプル
            break;
        case 4:
            score += 800; // テトリス
            break;
    }
}

// スコアが200を超えるたびにゲームスピードを速くする
function adjustGameSpeed() {
    while (score >= speedIncreaseCounter * 200 + 200) {
        speedIncreaseCounter++;
        if (GAME_SPEED > 100) GAME_SPEED -= 50;
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, GAME_SPEED);
    }
}

function gameOver() {
    BGM.pause();
    clearInterval(gameInterval);
    clearInterval(delayInterval);
    clearInterval(rotateInterval);
    clearInterval(jumpInterval);
    let s = "GAME OVER";
    con.font = "40px 'MS ゴシック'";
    let w = con.measureText(s).width;
    let x = canvas.width / 2 - w / 2 - 2;
    let y = canvas.height / 2 - 20;
    con.lineWidth = 4;
    con.strokeStyle = "#9100FF";
    con.strokeText(s, x, y);
    con.fillStyle = "white";
    con.fillText(s, x, y);
    con.lineWidth = 3;
    con.fillText("Press R to Play Again", canvas.width / 5 - 20, canvas.height / 2 + 85);
    GameOverSound.play();
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
        con.fillText("New High Score!", x - 67, y + 50);
    }
}

function resetGame() {
    // フィールドの初期化
    for (let y = 0; y < FIELD_ROW; y++) {
        for (let x = 0; x < FIELD_COL; x++) {
            field[y][x] = 0;
        }
    }
    score = 0;
    lines = 0;
    speedIncreaseCounter = 0;
    over = false;
    tetro_x = 3;
    tetro_y = 0;
    shuffleTetroQueue();
    setTetro();
    GAME_SPEED = INITIAL_GAME_SPEED;
    countDownFlame = 300;
    MoveDelay = 1;
    softDownDelay = 1;
    rotateMoveDelay = 1;
    hardDownDelay = 1;
    BGM.pause();
    BGM.currentTime = 0;
    con.fillRect(0, 0, canvas.width, canvas.height);
    countDown();
}

function gameLoop() {
    if (over) return;
    if (checkMove(0, 1)) {
        tetro_y++;
    } else {
        addTetroToField();
        setTetro();
        if (!checkMove(0, 0)) {
            over = true;
            gameOver();
            return;
        }
    }
    drawAll();
    drawInfo();
}

window.onload = () => {
    init();
};