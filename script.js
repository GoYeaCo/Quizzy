// Configuration Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variables
let quizzes = localStorage.getItem('quizzes') ? JSON.parse(localStorage.getItem('quizzes')) : [];
let currentQuiz = null;
let currentScore = 0;
let currentUser = null;
const adminUser = {
    username: "admin",
    password: "admin123",
    followers: [],
    profilePic: null,
    following: []
};

// Main functions
async function loadQuizzes() {
    try {
        const snapshot = await db.collection('quizzes').get();
        quizzes = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        showQuizList();
    } catch (error) {
        console.error("Error loading quizzes:", error);
        showQuizList();
    }
}

function showCreateQuiz() {
    if (!currentUser) {
        alert('You must be logged in to create a quiz!');
        return;
    }
    
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="quiz-form">
            <h2>Create New Quiz</h2>
            <form onsubmit="saveQuiz(event)">
                <input type="text" id="quizTitle" placeholder="Quiz Title" required>
                <div id="questions">
                    <div class="question-container">
                        <input type="text" placeholder="Question 1" required>
                        <input type="text" placeholder="Answer 1" required>
                        <input type="text" placeholder="Answer 2" required>
                        <input type="text" placeholder="Answer 3" required>
                        <input type="number" placeholder="Correct answer number (1-3)" min="1" max="3" required>
                    </div>
                </div>
                <button type="button" class="pixel-button" onclick="addQuestion()">+ Question</button>
                <button type="submit" class="pixel-button">Save Quiz</button>
            </form>
        </div>
    `;
}

function addQuestion() {
    const questions = document.getElementById('questions');
    const questionCount = questions.children.length + 1;
    const newQuestion = document.createElement('div');
    newQuestion.className = 'question-container';
    newQuestion.innerHTML = `
        <input type="text" placeholder="Question ${questionCount}" required>
        <input type="text" placeholder="Answer 1" required>
        <input type="text" placeholder="Answer 2" required>
        <input type="text" placeholder="Answer 3" required>
        <input type="number" placeholder="Correct answer number (1-3)" min="1" max="3" required>
    `;
    questions.appendChild(newQuestion);
}

async function saveQuiz(event) {
    event.preventDefault();
    const title = document.getElementById('quizTitle').value;
    const questionContainers = document.querySelectorAll('.question-container');
    const questions = [];

    questionContainers.forEach(container => {
        const inputs = container.getElementsByTagName('input');
        questions.push({
            question: inputs[0].value,
            answers: [inputs[1].value, inputs[2].value, inputs[3].value],
            correctAnswer: parseInt(inputs[4].value) - 1
        });
    });

    const quiz = {
        id: Date.now(),
        title: title,
        questions: questions,
        highScores: [],
        author: currentUser.username
    };

    try {
        await db.collection('quizzes').add(quiz);
        quizzes.push(quiz);
    } catch (error) {
        console.error("Firebase error, local save:", error);
        quizzes.push(quiz);
    }
    localStorage.setItem('quizzes', JSON.stringify(quizzes));
    showQuizList();
}

function filterQuizzes() {
    const searchTerm = document.getElementById('quizSearch').value.toLowerCase();
    const container = document.getElementById('quizListContainer');
    
    container.innerHTML = quizzes
        .filter(quiz => quiz.title.toLowerCase().includes(searchTerm))
        .map(quiz => `
            <div class="quiz-card">
                <h3>${quiz.title}</h3>
                <p>${quiz.questions.length} questions</p>
                <p>Created by: ${quiz.author || 'Anonymous'}</p>
                <button class="pixel-button" onclick="startQuiz(${quiz.id})">Play</button>
                ${(currentUser && (currentUser.username === quiz.author || currentUser.username === adminUser.username)) ? `
                    <div class="admin-controls">
                        <button class="pixel-button" onclick="editQuiz(${quiz.id})">Edit</button>
                        <button class="pixel-button" onclick="deleteQuiz(${quiz.id})">Delete</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
}

function startQuiz(quizId) {
    currentQuiz = quizzes.find(q => q.id === quizId);
    currentScore = 0;
    showQuestion(0);
}

function showQuestion(index) {
    if (index >= currentQuiz.questions.length) {
        endQuiz();
        return;
    }

    const question = currentQuiz.questions[index];
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="quiz-form">
            <h2>${question.question}</h2>
            ${question.answers.map((answer, i) => `
                <button class="pixel-button" onclick="checkAnswer(${index}, ${i})">${answer}</button>
            `).join('')}
        </div>
    `;
}

function checkAnswer(questionIndex, answerIndex) {
    const correct = currentQuiz.questions[questionIndex].correctAnswer === answerIndex;
    if (correct) currentScore++;

    if (questionIndex + 1 >= currentQuiz.questions.length) {
        const playerName = currentUser ? currentUser.username : 'Anonymous';
        
        const existingScoreIndex = currentQuiz.highScores.findIndex(
            score => score.username === playerName
        );

        if (existingScoreIndex === -1 || currentQuiz.highScores[existingScoreIndex].score < currentScore) {
            if (existingScoreIndex !== -1) {
                currentQuiz.highScores.splice(existingScoreIndex, 1);
            }

            currentQuiz.highScores.push({
                score: currentScore,
                username: playerName,
                date: new Date().toLocaleDateString(),
                timestamp: Date.now()
            });

            try {
                db.collection('quizzes').doc(currentQuiz.id).update({
                    highScores: currentQuiz.highScores
                });
            } catch (error) {
                console.error("Error updating high scores:", error);
            }
            localStorage.setItem('quizzes', JSON.stringify(quizzes));
        }
    }

    showQuestion(questionIndex + 1);
}

function endQuiz() {
    const content = document.getElementById('content');
    const percentage = (currentScore / currentQuiz.questions.length) * 100;
    let message = '';
    let color = '';

    if (percentage === 100) {
        message = "PERFECT! 🏆";
        color = "#FFD700";
    } else if (percentage >= 80) {
        message = "EXCELLENT! 🌟";
        color = "#0f0";
    } else if (percentage >= 60) {
        message = "GOOD! ⭐";
        color = "#00BFFF";
    } else if (percentage >= 40) {
        message = "KEEP PRACTICING 📚";
        color = "#FFA500";
    } else {
        message = "NEEDS REVIEW 📖";
        color = "#FF4500";
    }

    content.innerHTML = `
        <div class="quiz-form">
            <h2>${currentQuiz.title}</h2>
            <div class="score" style="color: ${color}">
                ${message}<br>
                ${currentScore}/${currentQuiz.questions.length}
            </div>
            <div style="text-align: center; margin: 20px 0;">
                <p style="font-size: 1.2rem; color: ${color}">${percentage.toFixed(1)}%</p>
                <div style="background: #333; height: 20px; border: 2px solid ${color}; margin: 10px 0;">
                    <div style="width: ${percentage}%; background: ${color}; height: 100%;"></div>
                </div>
            </div>
            <button class="pixel-button" onclick="showQuizList()">Back to Quizzes</button>
            <button class="pixel-button" onclick="startQuiz(${currentQuiz.id})">Try Again</button>
            <button class="pixel-button" onclick="showLeaderboard()">View Leaderboard</button>
        </div>
    `;
}

function showLeaderboard() {
    const content = document.getElementById('content');
    
    const allScores = quizzes.reduce((scores, quiz) => {
        quiz.highScores.forEach(score => {
            scores.push({
                quizTitle: quiz.title,
                ...score
            });
        });
        return scores;
    }, []);

    const sortedScores = allScores.sort((a, b) => b.score - a.score);
    const topPlayer = sortedScores[0];

    content.innerHTML = `
        <div class="quiz-form">
            <h2>Global Leaderboard</h2>
            ${topPlayer ? `
                <div class="top-player">
                    <div class="crown">👑</div>
                    <div>Champion: ${topPlayer.username}</div>
                    <div>Score: ${topPlayer.score}</div>
                    <div>Quiz: ${topPlayer.quizTitle}</div>
                </div>
            ` : ''}
            <div class="other-players">
                ${sortedScores.slice(1).map((score, index) => `
                    <div class="other-players">
                        <strong>#${index + 2}</strong> 
                        ${score.username} - 
                        Score: ${score.score} 
                        (${score.quizTitle})
                    </div>
                `).join('')}
            </div>
            <button class="pixel-button" onclick="showQuizList()">Back to Quizzes</button>
        </div>
    `;
}

function showLoginForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="auth-form">
            <h2>Login</h2>
            <form onsubmit="login(event)">
                <input type="text" id="username" placeholder="Username" required>
                <input type="password" id="password" placeholder="Password" required>
                <button type="submit" class="pixel-button">Login</button>
            </form>
        </div>
    `;
}

function showRegisterForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="auth-form">
            <h2>Register</h2>
            <form onsubmit="register(event)">
                <input type="text" id="regUsername" placeholder="Username" required>
                <input type="password" id="regPassword" placeholder="Registration Code" required>
                <small style="color: #9E9E9E; font-size: 0.7em;">Provided by admin</small>
                <button type="submit" class="pixel-button">Register</button>
            </form>
        </div>
    `;
}

function login(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (username === adminUser.username && password === adminUser.password) {
        currentUser = adminUser;
        document.getElementById('authButton').textContent = 'Logout';
        document.getElementById('profileButton').style.display = 'block';
        showQuizList();
    } else if (password === "Raffort123") {
        currentUser = { 
            username: username,
            followers: [],
            following: [],
            profilePic: null
        };
        document.getElementById('authButton').textContent = 'Logout';
        document.getElementById('profileButton').style.display = 'block';
        showQuizList();
    } else {
        alert('Invalid credentials!');
    }
}

function register(event) {
    event.preventDefault();
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;

    if (password === "Raffort123") {
        currentUser = {
            username: username,
            followers: [],
            following: [],
            profilePic: null
        };
        document.getElementById('authButton').textContent = 'Logout';
        document.getElementById('profileButton').style.display = 'block';
        alert('Registration successful!');
        showQuizList();
    } else {
        alert('Invalid registration code!');
    }
}

function toggleAuth() {
    if (currentUser) {
        logout();
    } else {
        showLoginForm();
    }
}

function logout() {
    currentUser = null;
    document.getElementById('authButton').textContent = 'Login';
    document.getElementById('profileButton').style.display = 'none';
    showQuizList();
}

function showUserProfile() {
    if (!currentUser) return;
    
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="profile-container">
            <div class="profile-header">
                <div class="profile-pic-container">
                    <img src="${currentUser.profilePic || 'default-avatar.png'}" alt="Profile" id="profilePic">
                    <input type="file" id="profilePicInput" accept="image/*" style="display: none">
                    <button class="pixel-button" onclick="document.getElementById('profilePicInput').click()">
                        Change Photo
                    </button>
                </div>
                <div class="profile-info">
                    <h2>${currentUser.username}</h2>
                    <p>Followers: ${currentUser.followers ? currentUser.followers.length : 0}</p>
                    <p>Following: ${currentUser.following ? currentUser.following.length : 0}</p>
                </div>
            </div>
            <div class="profile-stats">
                <div class="stat-box">
                    <h3>Total Quizzes</h3>
                    <p>${quizzes.filter(q => q.author === currentUser.username).length}</p>
                </div>
                <div class="stat-box">
                    <h3>High Scores</h3>
                    <p>${countUserHighScores()}</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('profilePicInput').addEventListener('change', handleProfilePicUpload);
}

function handleProfilePicUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        currentUser.profilePic = e.target.result;
        document.getElementById('profilePic').src = e.target.result;
        saveUserData();
    };
    reader.readAsDataURL(file);
}

function countUserHighScores() {
    return quizzes.reduce((count, quiz) => {
        return count + quiz.highScores.filter(score => score.username === currentUser.username).length;
    }, 0);
}

function saveUserData() {
    try {
        db.collection('users').doc(currentUser.username).set(currentUser);
    } catch (error) {
        console.error("Error saving user data:", error);
        localStorage.setItem('userData_' + currentUser.username, JSON.stringify(currentUser));
    }
}

function showGames() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="quiz-form">
            <h2>Games</h2>
            <div class="games-grid">
                <div class="quiz-card">
                    <h3>2048</h3>
                    <p>Number puzzle game</p>
                    <button class="pixel-button" onclick="loadGame('2048')">Play</button>
                </div>
                <div class="quiz-card">
                    <h3>Tetris</h3>
                    <p>Classic block game</p>
                    <button class="pixel-button" onclick="loadGame('tetris')">Play</button>
                </div>
                <div class="quiz-card">
                    <h3>Snake</h3>
                    <p>Classic snake game</p>
                    <button class="pixel-button" onclick="loadGame('snake')">Play</button>
                </div>
            </div>
        </div>
    `;
}

function loadGame(game) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="game-container">
            <div class="game-controls">
                <button class="pixel-button" onclick="showGames()">Back</button>
                <button class="pixel-button" onclick="toggleFullscreen()">Fullscreen</button>
            </div>
            <iframe 
                id="gameFrame"
                src="${getGameUrl(game)}"
                style="width: 100%; height: 80vh; border: 4px solid #0f0;"
                allowfullscreen
            ></iframe>
        </div>
    `;
}

function getGameUrl(game) {
    const games = {
        '2048': 'https://play2048.co/',
        'tetris': 'https://tetris.com/play-tetris',
        'snake': 'https://playsnake.org/'
    };
    return games[game];
}

function toggleFullscreen() {
    const gameFrame = document.getElementById('gameFrame');
    if (gameFrame.requestFullscreen) {
        gameFrame.requestFullscreen();
    } else if (gameFrame.webkitRequestFullscreen) {
        gameFrame.webkitRequestFullscreen();
    } else if (gameFrame.msRequestFullscreen) {
        gameFrame.msRequestFullscreen();
    }
}

// Initialize on page load
window.onload = function() {
    loadQuizzes();
    if (shouldResetScores()) {
        resetDailyScores();
    }
};

function shouldResetScores() {
    const lastReset = localStorage.getItem('lastScoreReset');
    const today = new Date().toDateString();
    
    if (!lastReset || lastReset !== today) {
        localStorage.setItem('lastScoreReset', today);
        return true;
    }
    return false;
}

function resetDailyScores() {
    quizzes.forEach(quiz => {
        quiz.highScores = [];
    });
    localStorage.setItem('quizzes', JSON.stringify(quizzes));
}

function showQuizList() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="quiz-form">
            <h2>Available Quizzes</h2>
            <input type="text" id="quizSearch" placeholder="Search quizzes..." onkeyup="filterQuizzes()">
            <div id="quizListContainer" class="quiz-list">
                ${quizzes.map(quiz => `
                    <div class="quiz-card">
                        <h3>${quiz.title}</h3>
                        <p>${quiz.questions.length} questions</p>
                        <p>Created by: ${quiz.author || 'Anonymous'}</p>
                        <button class="pixel-button" onclick="startQuiz(${quiz.id})">Play</button>
                        ${(currentUser && (currentUser.username === quiz.author || currentUser.username === adminUser.username)) ? `
                            <div class="admin-controls">
                                <button class="pixel-button" onclick="editQuiz(${quiz.id})">Edit</button>
                                <button class="pixel-button" onclick="deleteQuiz(${quiz.id})">Delete</button>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
