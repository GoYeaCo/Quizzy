// Add Firebase Auth import in index.html
const firebaseConfig = {
    apiKey: "AIzaSyDDS0LDmhqVBHrs_IyVm1LJ42nvnuqk0Rw",
    authDomain: "quizzy-52d70.firebaseapp.com",
    databaseURL: "https://quizzy-52d70-default-rtdb.firebaseio.com",
    projectId: "quizzy-52d70",
    storageBucket: "quizzy-52d70.firebasestorage.app",
    messagingSenderId: "480883050060",
    appId: "1:480883050060:web:9c45cb252f0860f1de96e9",
    measurementId: "G-0S1X44S2TT"
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
        const snapshot = await db.collection('quizzes').orderBy('createdAt', 'desc').get();
        quizzes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        localStorage.setItem('quizzes', JSON.stringify(quizzes));
        showQuizList();
    } catch (error) {
        console.error("Error loading quizzes:", error);
        quizzes = JSON.parse(localStorage.getItem('quizzes')) || [];
        showQuizList();
    }
}

function showCreateQuiz() {
    if (!currentUser) {
        alert('Vous devez être connecté pour créer un quiz!');
        return;
    }
    
    if (!currentUser.canCreateQuiz) {
        alert('Vous n\'avez pas les droits pour créer des quiz. Veuillez mettre à jour votre compte.');
        return;
    }
    
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="quiz-form">
            <h2>Créer un nouveau Quizz</h2>
            <form onsubmit="saveQuiz(event)">
                <input type="text" id="quizTitle" placeholder="Quiz Title" required>
                <div id="questions">
                    <div class="question-container">
                        <input type="text" placeholder="Question 1" required>
                        <input type="text" placeholder="Réponse 1" required>
                        <input type="text" placeholder="Réponse 2" required>
                        <input type="text" placeholder="Réponse 3" required>
                        <input type="number" placeholder="Numéro de la bonne réponse (1-3)" min="1" max="3" required>
                    </div>
                </div>
                <button type="button" class="pixel-button" onclick="addQuestion()">+ Question</button>
                <button type="submit" class="pixel-button">Enregistrer</button>
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
        title: title,
        questions: questions,
        highScores: [],
        author: currentUser.username,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const docRef = await db.collection('quizzes').add(quiz);
        quiz.id = docRef.id;
        quizzes.push(quiz);
        localStorage.setItem('quizzes', JSON.stringify(quizzes));
        alert('Quiz créé avec succès!');
        showQuizList();
    } catch (error) {
        console.error("Error saving quiz:", error);
        alert('Erreur lors de la création du quiz. Réessayez.');
    }
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
                <p>Created by: ${quiz.author || 'Anonyme'}</p>
                <button class="pixel-button" onclick="startQuiz(${quiz.id})">Jouer</button>
                ${(currentUser && (currentUser.username === quiz.author || currentUser.username === adminUser.username)) ? `
                    <div class="admin-controls">
                        <button class="pixel-button" onclick="editQuiz(${quiz.id})">Modifier</button>
                        <button class="pixel-button" onclick="deleteQuiz(${quiz.id})">Effacer</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
}

function startQuiz(quizId) {
    currentQuiz = quizzes.find(q => q.id === quizId.toString());
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
        message = "PARFAIT! 🏆";
        color = "#FFD700";
    } else if (percentage >= 80) {
        message = "EXCELLENT! 🌟";
        color = "#0f0";
    } else if (percentage >= 60) {
        message = "BIEN! ⭐";
        color = "#00BFFF";
    } else if (percentage >= 40) {
        message = "MOYEN 📚";
        color = "#FFA500";
    } else {
        message = "A REVOIR 📖";
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
            <h2>Classement</h2>
            ${topPlayer ? `
                <div class="top-player">
                    <div class="crown">👑</div>
                    <div>Champion: ${topPlayer.username}</div>
                    <div>Score: ${topPlayer.score}</div>
                    <div>Quizz: ${topPlayer.quizTitle}</div>
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
            <button class="pixel-button" onclick="showQuizList()">Revenir aux Quizz</button>
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
                <button type="submit" class="pixel-button">Connection</button>
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
                <input type="text" id="regUsername" placeholder="Nom d'utilisateur" required>
                <input type="password" id="regPassword" placeholder="Choisissez votre mot de passe" required>
                <div class="checkbox-container">
                    <input type="checkbox" id="quizCreator" onchange="toggleCreatorCode()">
                    <label for="quizCreator">Je souhaite créer des quiz</label>
                </div>
                <div id="creatorCodeContainer" style="display: none;">
                    <input type="password" id="creatorCode" placeholder="Code créateur (Raffort123)">
                </div>
                <div class="captcha-container">
                    <div class="g-recaptcha" data-sitekey="6Ldk8aMqAAAAADR8Y_c3HGVLFb8f_Oz18eLNKywL"></div>
                </div>
                <button type="submit" class="pixel-button">S'inscrire</button>
            </form>
        </div>
    `;
}

function toggleCreatorCode() {
    const codeContainer = document.getElementById('creatorCodeContainer');
    const checkbox = document.getElementById('quizCreator');
    codeContainer.style.display = checkbox.checked ? 'block' : 'none';
}

async function register(event) {
    event.preventDefault();
    
    const captchaResponse = grecaptcha.getResponse();
    if (!captchaResponse) {
        alert('Veuillez vérifier que vous n\'êtes pas un robot');
        return;
    }
    
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const isQuizCreator = document.getElementById('quizCreator').checked;
    const creatorCode = document.getElementById('creatorCode')?.value;

    if (isQuizCreator && creatorCode !== "Raffort123") {
        alert('Code créateur invalide! Vous ne pourrez pas créer de quiz.');
        return;
    }

    currentUser = {
        username: username,
        password: password,
        canCreateQuiz: isQuizCreator && creatorCode === "Raffort123",
        followers: [],
        following: [],
        profilePic: null
    };

    saveUserData();
    document.getElementById('authButton').textContent = 'Déconnexion';
    document.getElementById('profileButton').style.display = 'block';
    alert('Inscription réussie!');
    showQuizList();
}
function login(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const userData = JSON.parse(localStorage.getItem('userData_' + username));
        if (userData && userData.password === password) {
            currentUser = userData;
            document.getElementById('authButton').textContent = 'Déconnexion';
            document.getElementById('profileButton').style.display = 'block';
            showQuizList();
        } else {
            alert('Identifiants incorrects!');
        }
    } catch (error) {
        console.error("Erreur de connexion:", error);
        alert('Erreur de connexion. Réessayez.');
    }
}
function register(event) {
    event.preventDefault();
    const username = document.getElementById('regUsername').value;
    
    // Check if username already exists
    if (localStorage.getItem('userData_' + username)) {
        // Generate suggestions
        const suggestions = generateUsernameSuggestions(username);
        showUsernameSuggestions(suggestions);
        return;
    }

    const password = document.getElementById('regPassword').value;
    const isQuizCreator = document.getElementById('quizCreator').checked;
    const creatorCode = document.getElementById('creatorCode')?.value;

    if (isQuizCreator && creatorCode !== "Raffort123") {
        alert('Code créateur invalide! Vous ne pourrez pas créer de quiz.');
        return;
    }

    currentUser = {
        username: username,
        password: password,
        canCreateQuiz: isQuizCreator && creatorCode === "Raffort123",
        followers: [],
        following: [],
        profilePic: null
    };

    localStorage.setItem('userData_' + username, JSON.stringify(currentUser));
    document.getElementById('authButton').textContent = 'Déconnexion';
    document.getElementById('profileButton').style.display = 'block';
    alert('Inscription réussie!');
    showQuizList();
}

function generateUsernameSuggestions(username) {
    const suggestions = [];
    for (let i = 1; i <= 5; i++) {
        suggestions.push(`${username}${i}`);
        suggestions.push(`${username}_${i}`);
        suggestions.push(`${username}${Math.floor(Math.random() * 100)}`);
    }
    return [...new Set(suggestions)].filter(suggestion => !localStorage.getItem('userData_' + suggestion)).slice(0, 5);
}

function showUsernameSuggestions(suggestions) {
    const suggestionsContainer = document.getElementById('suggestions') || document.createElement('div');
    suggestionsContainer.id = 'suggestions';
    suggestionsContainer.innerHTML = `
        <p style="color: #ff4444;">Ce nom d'utilisateur est déjà pris. Essayez plutôt:</p>
        <div class="suggestions-list">
            ${suggestions.map(suggestion => `
                <button class="pixel-button" onclick="selectSuggestion('${suggestion}')">${suggestion}</button>
            `).join('')}
        </div>
    `;
    
    const form = document.querySelector('.auth-form form');
    if (!document.getElementById('suggestions')) {
        form.appendChild(suggestionsContainer);
    }
}

function selectSuggestion(username) {
    document.getElementById('regUsername').value = username;
    document.getElementById('suggestions').remove();
}function toggleAuth() {
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
                        Changer de photo
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
                    <h3>Tous les quizz's</h3>
                    <p>${quizzes.filter(q => q.author === currentUser.username).length}</p>
                </div>
                <div class="stat-box">
                    <h3>Meilleur score</h3>
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
            <h2>Quizz's</h2>
            <input type="text" id="quizSearch" placeholder="Rechercher des quizz's..." onkeyup="filterQuizzes()">
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

function showCredits() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="quiz-form">
            <h2>Crédits</h2>
            <div style="text-align: center; margin: 20px 0;">
                <div>Développé par Alan Nazery</div>
                <p>Version 1.0</p>
                <p>Créé avec HTML, CSS, JavaScript, et Firebase</p>
                <p>Contact: alan.nazery@gmail.com</p>
                <p>Tous droits réservés © 2024 Quizzy</p>
                <hr>
                <div>Changements de Mise à Jour</div>
                <p>Problèmes de bug et du firebase corrigés</p>
                <p>Ajout de la fonctionnalité de profil avec abonnement aux autres utilisateurs enregistrés</p>
                <p>Plusieurs autres fonctionnalités sont à venir, version pré-alpha.</p>
            </div>
            <button class="pixel-button" onclick="showQuizList()">Retour aux Quizz</button>
        </div>
    `;
}

function onClick(e) {
    e.preventDefault();
    grecaptcha.enterprise.ready(async () => {
      const token = await grecaptcha.enterprise.execute('6Ldk8aMqAAAAADR8Y_c3HGVLFb8f_Oz18eLNKywL', {action: 'LOGIN'});
    });
}

window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loading-screen');
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }, 1000);
});

// Add to currentUser object
currentUser = {
    ...currentUser,
    friends: [],
    customNames: {},
    currentGame: null,
    invites: []
};

// Add new friend system functions
function addFriend(friendUsername) {
    const friend = {
        username: friendUsername,
        customName: friendUsername,
        status: 'offline',
        currentGame: null
    };
    currentUser.friends.push(friend);
    saveUserData();
}

function showFriendsList() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="friends-container">
            <h2>Mes amis</h2>
            <div class="friends-list">
                ${currentUser.friends.map(friend => `
                    <div class="friend-card" onclick="showFriendOptions('${friend.username}')">
                        <img src="${getUserProfilePic(friend.username)}" alt="Profile">
                        <div class="friend-info">
                            <h3>${friend.customName || friend.username}</h3>
                            <span class="status ${friend.status}">${friend.status}</span>
                            ${friend.currentGame ? `<span class="game-status">Joue à: ${friend.currentGame}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="add-friend">
                <input type="text" id="friendUsername" placeholder="Nom d'utilisateur">
                <button class="pixel-button" onclick="sendFriendRequest()">Ajouter un ami</button>
            </div>
        </div>
    `;
}

// Ajout des nouvelles propriétés pour le système d'amis
function initializeFriendSystem() {
    if (currentUser) {
        currentUser.friends = currentUser.friends || [];
        currentUser.friendRequests = currentUser.friendRequests || [];
        currentUser.customNames = currentUser.customNames || {};
        currentUser.gameStatus = {
            isPlaying: false,
            currentQuiz: null,
            canJoin: false
        };
    }
}

// Gestion des amis
function showFriendManager() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="friend-manager">
            <div class="friend-search">
                <input type="text" id="friendSearch" placeholder="Rechercher un utilisateur" onkeyup="searchUsers()">
                <div id="searchResults" class="search-results"></div>
            </div>
            <div class="friends-list">
                ${renderFriendsList()}
            </div>
            <div class="friend-requests">
                <h3>Invitations (${currentUser.friendRequests.length})</h3>
                ${renderFriendRequests()}
            </div>
        </div>
    `;
}

function renderFriendsList() {
    return currentUser.friends.map(friend => `
        <div class="friend-item" onclick="toggleFriendOptions('${friend.username}')">
            <img src="${friend.profilePic || 'default-avatar.png'}" alt="${friend.customName || friend.username}">
            <div class="friend-details">
                <h4>${friend.customName || friend.username}</h4>
                <span class="status ${friend.gameStatus.isPlaying ? 'playing' : 'online'}">
                    ${friend.gameStatus.isPlaying ? 'En jeu' : 'En ligne'}
                </span>
            </div>
            <div id="friendOptions-${friend.username}" class="friend-options" style="display: none;">
                ${friend.gameStatus.canJoin ? 
                    `<button class="pixel-button" onclick="joinFriendGame('${friend.username}')">Rejoindre</button>` : ''}
                <button class="pixel-button" onclick="inviteToPlay('${friend.username}')">Inviter</button>
                <button class="pixel-button" onclick="setCustomName('${friend.username}')">Renommer</button>
                <button class="pixel-button remove" onclick="removeFriend('${friend.username}')">Supprimer</button>
            </div>
        </div>
    `).join('');
}

// Système de battle en groupe
function createGroupBattle(quizId) {
    const battle = {
        id: Date.now(),
        host: currentUser.username,
        quizId: quizId,
        participants: [currentUser.username],
        status: 'waiting',
        scores: {}
    };
    
    db.collection('battles').add(battle)
        .then(docRef => {
            inviteFriendsToBattle(docRef.id);
        });
}

// Mise à jour en temps réel
function initializeRealtimeUpdates() {
    db.collection('users').doc(currentUser.username)
        .onSnapshot(doc => {
            updateFriendStatuses(doc.data());
        });
}

// Système d'amis avancé
class FriendSystem {
    constructor(user) {
        this.user = user;
        this.friends = new Map();
        this.requests = new Set();
        this.customNames = new Map();
        this.initializeFirebaseListeners();
    }

    async initializeFirebaseListeners() {
        // Écoute en temps réel des statuts amis
        db.collection('users').where('friends', 'array-contains', this.user.username)
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    this.updateFriendStatus(change.doc.data());
                });
            });

        // Écoute des invitations
        db.collection('invitations').where('to', '==', this.user.username)
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        this.handleNewInvitation(change.doc.data());
                    }
                });
            });
    }

    async sendFriendRequest(username) {
        const invitation = {
            from: this.user.username,
            to: username,
            type: 'friend_request',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending'
        };
        
        await db.collection('invitations').add(invitation);
        this.showNotification(`Invitation envoyée à ${username}`);
    }

    async acceptFriendRequest(requestId) {
        const batch = db.batch();
        
        // Mise à jour des deux profils
        batch.update(db.collection('users').doc(this.user.username), {
            friends: firebase.firestore.FieldValue.arrayUnion(requestId)
        });
        
        batch.update(db.collection('users').doc(requestId), {
            friends: firebase.firestore.FieldValue.arrayUnion(this.user.username)
        });
        
        await batch.commit();
        this.showNotification('Nouvel ami ajouté !');
    }

    createGroupBattle(quizId, friendIds) {
        const battleRoom = {
            id: `battle_${Date.now()}`,
            host: this.user.username,
            quiz: quizId,
            participants: [this.user.username, ...friendIds],
            status: 'waiting',
            scores: {},
            chat: [],
            startTime: null,
            maxPlayers: 8,
            settings: {
                timeLimit: 30,
                powerUps: true,
                teamMode: false
            }
        };

        return db.collection('battles').add(battleRoom);
    }

    // Interface utilisateur améliorée
    renderFriendInterface() {
        return `
            <div class="friend-dashboard">
                <div class="friend-header">
                    <h2>Espace Social</h2>
                    <div class="friend-stats">
                        <span>${this.friends.size} amis</span>
                        <span>${this.requests.size} invitations</span>
                    </div>
                </div>
                
                <div class="friend-search-bar">
                    <input type="text" 
                           placeholder="Rechercher des amis..." 
                           onkeyup="friendSystem.searchUsers(this.value)">
                    <div class="search-filters">
                        <button class="pixel-button" onclick="friendSystem.filterOnline()">En ligne</button>
                        <button class="pixel-button" onclick="friendSystem.filterPlaying()">En jeu</button>
                    </div>
                </div>

                <div class="friends-grid">
                    ${this.renderFriendsList()}
                </div>

                <div class="battle-zone">
                    <h3>Batailles en cours</h3>
                    ${this.renderActiveBattles()}
                </div>

                <div class="friend-requests">
                    <h3>Invitations</h3>
                    ${this.renderRequests()}
                </div>
            </div>
        `;
    }
}

// Système de chat en temps réel
class BattleChat {
    constructor(battleId) {
        this.battleId = battleId;
        this.messages = [];
        this.initializeChat();
    }

    async initializeChat() {
        db.collection('battles').doc(this.battleId)
            .collection('messages')
            .orderBy('timestamp')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        this.addMessage(change.doc.data());
                    }
                });
            });
    }

    async sendMessage(text) {
        const message = {
            user: currentUser.username,
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('battles').doc(this.battleId)
            .collection('messages').add(message);
    }
}

// Initialisation du système
const friendSystem = new FriendSystem(currentUser);

// Système de gestion des amis complet
class FriendSystem {
    constructor() {
        this.db = firebase.firestore();
        this.realTimeListeners = new Map();
        this.notificationSound = new Audio('notification.mp3');
        this.initializeSystem();
    }

    async initializeSystem() {
        await this.setupFirebaseListeners();
        this.initializeUI();
        this.startPresenceSystem();
    }

    // Interface principale
    showFriendInterface() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="social-hub">
                <div class="friend-panel">
                    <div class="search-section">
                        <input type="text" id="friendSearch" placeholder="Rechercher des amis...">
                        <div class="filter-buttons">
                            <button class="pixel-button" data-filter="all">Tous</button>
                            <button class="pixel-button" data-filter="online">En ligne</button>
                            <button class="pixel-button" data-filter="playing">En jeu</button>
                            <button class="pixel-button" data-filter="favorite">Favoris</button>
                        </div>
                    </div>

                    <div class="friends-display">
                        <div class="online-friends">
                            ${this.renderOnlineFriends()}
                        </div>
                        <div class="friend-requests">
                            ${this.renderFriendRequests()}
                        </div>
                    </div>

                    <div class="battle-hub">
                        <h3>🎮 Batailles en cours</h3>
                        ${this.renderActiveBattles()}
                        <button class="pixel-button create-battle">Créer une bataille</button>
                    </div>
                </div>

                <div class="activity-feed">
                    ${this.renderActivityFeed()}
                </div>
            </div>
        `;
        this.attachEventListeners();
    }

    // Gestion des amis
    async addFriend(friendId) {
        const friendData = {
            id: friendId,
            addedAt: Date.now(),
            customName: null,
            favorite: false,
            lastInteraction: Date.now(),
            gamesPlayed: 0,
            wins: 0,
            status: {
                online: true,
                lastSeen: Date.now(),
                currentActivity: null
            }
        };

        await this.db.collection('friendships').add(friendData);
        this.showNotification(`${friendId} ajouté comme ami !`);
    }

    // Système de battle
    async createBattle(settings) {
        const battleRoom = {
            id: `battle_${Date.now()}`,
            host: currentUser.username,
            settings: {
                mode: settings.mode || 'classic',
                timeLimit: settings.timeLimit || 30,
                maxPlayers: settings.maxPlayers || 8,
                isPrivate: settings.isPrivate || false,
                teamMode: settings.teamMode || false,
                powerUps: settings.powerUps || [],
                difficulty: settings.difficulty || 'normal'
            },
            players: [{
                id: currentUser.username,
                ready: true,
                team: 'blue',
                score: 0,
                powerUps: []
            }],
            status: 'waiting',
            chat: [],
            startTime: null,
            endTime: null
        };

        const battleRef = await this.db.collection('battles').add(battleRoom);
        return battleRef.id;
    }

    // Chat en temps réel
    initializeChat(battleId) {
        return new BattleChat(battleId, {
            onMessage: this.handleNewMessage.bind(this),
            onError: this.handleChatError.bind(this)
        });
    }
}

// Classe pour gérer les battles
class BattleManager {
    constructor(battleId) {
        this.battleId = battleId;
        this.players = new Map();
        this.powerUps = new PowerUpSystem();
        this.scoreTracker = new ScoreTracker();
        this.initialize();
    }

    async initialize() {
        await this.loadBattleData();
        this.setupRealTimeUpdates();
        this.initializeGameLogic();
    }

    // Logique de jeu
    async startRound() {
        const question = await this.getNextQuestion();
        this.broadcastToPlayers('newQuestion', question);
        this.startTimer();
    }

    handleAnswer(playerId, answer) {
        const isCorrect = this.checkAnswer(answer);
        this.scoreTracker.updateScore(playerId, isCorrect);
        this.broadcastScores();
    }
}

// Système de powerups
class PowerUpSystem {
    constructor() {
        this.availablePowerUps = [
            {
                id: 'timeFreeze',
                name: '⏰ Arrêt du Temps',
                effect: 'Arrête le temps pour les autres joueurs pendant 5 secondes'
            },
            {
                id: 'doublePoints',
                name: '2️⃣ Points Doubles',
                effect: 'Double les points pendant 30 secondes'
            },
            {
                id: 'elimination',
                name: '❌ Élimination',
                effect: 'Élimine une mauvaise réponse'
            }
        ];
    }

    activatePowerUp(type, player) {
        // Logique d'activation des power-ups
    }
}

// Ajouter un système de chargement progressif
function initializeProgressiveLoading() {
    // Chargement prioritaire
    loadEssentialFeatures()
        .then(() => loadFriendSystem())
        .then(() => loadBattleSystem())
        .then(() => loadChatSystem());
}

// Mise en cache intelligente
function setupCaching() {
    const cache = new Map();
    // Cache des données fréquemment utilisées
}

// Gestion optimisée du chargement
window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loading-screen');
    
    // Chargement rapide des fonctionnalités essentielles
    loadQuizzes().then(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            
            // Chargement différé des fonctionnalités secondaires
            setTimeout(() => {
                initializeFriendSystem();
                initializeBattleSystem();
            }, 100);
        }, 500);
    });
});

// Vérification de la connexion Firebase
function checkFirebaseConnection() {
    const maxAttempts = 3;
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
        const check = setInterval(() => {
            if (firebase.apps.length) {
                clearInterval(check);
                resolve();
            }
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(check);
                // Fallback au mode hors ligne
                resolve();
            }
        }, 1000);
    });
}

// Chargement instantané
window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loading-screen');
    
    // Chargement immédiat
    loadingScreen.style.display = 'none';
    loadQuizzes();
    
    // Initialisation en arrière-plan
    requestIdleCallback(() => {
        initializeFriendSystem();
        initializeBattleSystem();
    });
});

// Système d'amis
function initializeFriendSystem() {
    if (currentUser) {
        currentUser.friends = currentUser.friends || [];
        currentUser.friendRequests = currentUser.friendRequests || [];
        currentUser.customNames = currentUser.customNames || {};
        currentUser.gameStatus = {
            isPlaying: false,
            currentQuiz: null,
            canJoin: false
        };
    }
}

// Gestion des amis
function showFriendManager() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="friend-manager">
            <div class="friend-search">
                <input type="text" id="friendSearch" placeholder="Rechercher un utilisateur" onkeyup="searchUsers()">
                <div id="searchResults" class="search-results"></div>
            </div>
            <div class="friends-list">
                ${renderFriendsList()}
            </div>
            <div class="friend-requests">
                <h3>Invitations (${currentUser.friendRequests.length})</h3>
                ${renderFriendRequests()}
            </div>
        </div>
    `;
}

function renderFriendsList() {
    return currentUser.friends.map(friend => `
        <div class="friend-item" onclick="toggleFriendOptions('${friend.username}')">
            <img src="${friend.profilePic || 'default-avatar.png'}" alt="${friend.customName || friend.username}">
            <div class="friend-details">
                <h4>${friend.customName || friend.username}</h4>
                <span class="status ${friend.gameStatus.isPlaying ? 'playing' : 'online'}">
                    ${friend.gameStatus.isPlaying ? 'En jeu' : 'En ligne'}
                </span>
            </div>
            <div id="friendOptions-${friend.username}" class="friend-options" style="display: none;">
                ${friend.gameStatus.canJoin ? 
                    `<button class="pixel-button" onclick="joinFriendGame('${friend.username}')">Rejoindre</button>` : ''}
                <button class="pixel-button" onclick="inviteToPlay('${friend.username}')">Inviter</button>
                <button class="pixel-button" onclick="setCustomName('${friend.username}')">Renommer</button>
                <button class="pixel-button remove" onclick="removeFriend('${friend.username}')">Supprimer</button>
            </div>
        </div>
    `).join('');
}

// Système de gestion des amis
class FriendManager {
    constructor() {
        this.friends = new Map();
        this.battles = new Map();
        this.init();
    }

    init() {
        this.loadFriends();
        this.setupListeners();
        this.updateUI();
    }

    loadFriends() {
        const storedFriends = localStorage.getItem('friends');
        if (storedFriends) {
            this.friends = new Map(JSON.parse(storedFriends));
        }
    }

    addFriend(username) {
        const friend = {
            username: username,
            status: 'online',
            customName: username,
            lastSeen: Date.now(),
            games: [],
            score: 0
        };
        this.friends.set(username, friend);
        this.saveFriends();
        this.updateUI();
    }

    removeFriend(username) {
        this.friends.delete(username);
        this.saveFriends();
        this.updateUI();
    }

    updateFriendStatus(username, status) {
        const friend = this.friends.get(username);
        if (friend) {
            friend.status = status;
            friend.lastSeen = Date.now();
            this.saveFriends();
            this.updateUI();
        }
    }

    saveFriends() {
        localStorage.setItem('friends', JSON.stringify([...this.friends]));
    }

    createBattle(quizId) {
        const battle = {
            id: Date.now(),
            quizId: quizId,
            players: [currentUser.username],
            status: 'waiting',
            scores: {},
            chat: []
        };
        this.battles.set(battle.id, battle);
        return battle.id;
    }

    inviteToBattle(battleId, friendUsername) {
        const battle = this.battles.get(battleId);
        if (battle && this.friends.has(friendUsername)) {
            // Envoyer invitation
            this.sendNotification(friendUsername, {
                type: 'battle_invite',
                battleId: battleId,
                from: currentUser.username
            });
        }
    }

    updateUI() {
        const friendsList = document.querySelector('.friends-list');
        if (friendsList) {
            friendsList.innerHTML = this.renderFriendsList();
        }
    }

    renderFriendsList() {
        return Array.from(this.friends.values()).map(friend => `
            <div class="friend-card ${friend.status}">
                <img src="${friend.profilePic || 'default-avatar.png'}" alt="${friend.customName}">
                <div class="friend-info">
                    <h3>${friend.customName}</h3>
                    <span class="status">${friend.status}</span>
                </div>
                <div class="friend-actions">
                    ${friend.status === 'playing' ? 
                        `<button onclick="friendManager.joinGame('${friend.username}')">Rejoindre</button>` : 
                        `<button onclick="friendManager.inviteToPlay('${friend.username}')">Inviter</button>`
                    }
                    <button onclick="friendManager.showOptions('${friend.username}')">⚙️</button>
                </div>
            </div>
        `).join('');
    }

    showOptions(username) {
        const friend = this.friends.get(username);
        if (friend) {
            const options = document.createElement('div');
            options.className = 'friend-options';
            options.innerHTML = `
                <input type="text" value="${friend.customName}" onchange="friendManager.setCustomName('${username}', this.value)">
                <button onclick="friendManager.removeFriend('${username}')">Supprimer</button>
                <button onclick="friendManager.toggleFavorite('${username}')">
                    ${friend.favorite ? '★' : '☆'}
                </button>
            `;
            // Afficher les options
            document.body.appendChild(options);
        }
    }
}

// Initialisation
const friendManager = new FriendManager();
