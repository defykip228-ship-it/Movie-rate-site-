// ==========================================
// 1. НАЛАШТУВАННЯ SUPABASE
// ==========================================
const supabaseUrl = 'https://onzrbtrifqckxldpixxz.supabase.co';
const supabaseKey = 'sb_publishable_ypcv3GeJRzP-lO7_K_eQmA_t9_7JrqP'; // <--- ВСТАВ СВІЙ КЛЮЧ ТУТ!
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const API_KEY = '04c35731a5ee918f014970082a0088b1';
const IMGPATH = 'https://image.tmdb.org/t/p/w1280';

const main = document.getElementById('main');
const form = document.getElementById('form');
const search = document.getElementById('search');
const searchType = document.getElementById('searchType');

const sortSelect = document.getElementById('sort');
const genreSelect = document.getElementById('genre');
const ratingSelect = document.getElementById('rating');
const applyFiltersBtn = document.getElementById('applyFilters');
const homeBtn = document.getElementById('homeBtn');
const randomBtn = document.getElementById('randomBtn');
const favoritesBtn = document.getElementById('favoritesBtn'); 
const contentTypeSelect = document.getElementById('contentType');
const themeToggleBtn = document.getElementById('themeToggle');

const sentinel = document.getElementById('loading-sentinel');
let isFetching = false;
let isFavoritesMode = false; 

const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const modalCast = document.getElementById('modalCast');
const trailerContainer = document.getElementById('trailerContainer');
const similarMoviesSection = document.getElementById('similarMoviesSection');
const similarMoviesContainer = document.getElementById('similarMoviesContainer');

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authModal = document.getElementById('authModal');
const closeAuthModal = document.getElementById('closeAuthModal');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authTitle = document.getElementById('authTitle');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authToggleText = document.getElementById('authToggleText');
const authToggleLink = document.getElementById('authToggleLink');

let currentPage = 1;
let totalPages = 1;
let currentType = 'movie'; 
let currentUser = null; 
let userFavorites = []; 

const actualDate = '2024-01-01'; 
let currentUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&primary_release_date.gte=${actualDate}&vote_count.gte=300&without_genres=99,10402`;

function resetAllFiltersUI() {
    contentTypeSelect.value = 'movie';
    sortSelect.value = 'popularity.desc';
    genreSelect.value = '';
    ratingSelect.value = '';
    search.value = '';
    searchType.value = 'title';
    currentType = 'movie';
}
resetAllFiltersUI();

// ==========================================
// 3. АВТОРИЗАЦІЯ ТА ЛАЙКИ
// ==========================================
let isLoginMode = true;

loginBtn.addEventListener('click', () => { 
    authModal.style.display = 'block'; 
    authEmail.value = ''; 
    authPassword.value = ''; 
});

closeAuthModal.addEventListener('click', () => { authModal.style.display = 'none'; });

authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    authTitle.innerText = isLoginMode ? "Вхід" : "Реєстрація";
    authSubmitBtn.innerText = isLoginMode ? "Увійти" : "Створити акаунт";
    authToggleText.innerText = isLoginMode ? "Немає акаунту?" : "Вже є акаунт?";
    authToggleLink.innerText = isLoginMode ? "Зареєструватися" : "Увійти";
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmail.value; 
    const password = authPassword.value;
    
    if (isLoginMode) {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) alert("Помилка: " + error.message);
    } else {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) alert("Помилка: " + error.message);
        else alert("Акаунт створено!");
    }
});

logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    localStorage.clear();
    window.location.reload();
});

// ГЛАВНЫЙ СЛУШАТЕЛЬ СОСТОЯНИЯ
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        currentUser = session.user;
        loginBtn.style.display = 'none'; 
        logoutBtn.style.display = 'inline-block';
        favoritesBtn.style.display = 'inline-block';
        authModal.style.display = 'none'; // ЗАКРЫВАЕМ ОКНО ПРИ ВХОДЕ
        
        await loadFavorites();
        if(!isFavoritesMode) getMovies(currentUrl, false);
    } else {
        currentUser = null;
        userFavorites = [];
        loginBtn.style.display = 'inline-block'; 
        logoutBtn.style.display = 'none';
        favoritesBtn.style.display = 'none';
        isFavoritesMode = false;
        getMovies(currentUrl, false);
    }
});

async function loadFavorites() {
    if (!currentUser) return;
    // ВИПРАВЛЕНО: Тепер шукає в твоїй таблиці 'favorites'
    const { data, error } = await supabaseClient
        .from('favorites')
        .select('movie_id')
        .eq('user_id', currentUser.id);
    if (data) userFavorites = data.map(item => item.movie_id);
}

window.toggleFavorite = async function(movieId, event) {
    event.stopPropagation();
    if (!currentUser) { alert("Увійдіть, щоб зберігати!"); return; }
    
    const button = event.target;
    const isLiked = userFavorites.includes(movieId);

    if (isLiked) {
        userFavorites = userFavorites.filter(id => id !== movieId);
        button.classList.remove('liked');
        button.innerText = '🤍';
        // ВИПРАВЛЕНО
        await supabaseClient.from('favorites').delete().eq('user_id', currentUser.id).eq('movie_id', movieId);
        if (isFavoritesMode) button.closest('.movie').remove();
    } else {
        userFavorites.push(movieId);
        button.classList.add('liked');
        button.innerText = '❤️';
        // ВИПРАВЛЕНО
        const { error } = await supabaseClient.from('favorites').insert({ 
            user_id: currentUser.id, 
            movie_id: movieId
        });
        if (error) {
            alert("Помилка збереження: " + error.message);
            button.classList.remove('liked');
            button.innerText = '🤍';
        }
    }
};

favoritesBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    isFavoritesMode = true;
    main.innerHTML = '';
    sentinel.style.display = 'none';
    if (userFavorites.length === 0) {
        main.innerHTML = '<h2 style="text-align:center;width:100%">Порожньо 😔</h2>';
        return;
    }
    showSkeletons();
    const promises = userFavorites.map(id => 
        fetch(`https://api.themoviedb.org/3/${currentType}/${id}?api_key=${API_KEY}&language=uk-UA`).then(res => res.json())
    );
    const results = await Promise.all(promises);
    main.innerHTML = '';
    showMovies(results.filter(m => m.id));
});

// ==========================================
// 4. ІНШИЙ ФУНКЦІОНАЛ
// ==========================================
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeToggleBtn.innerText = isLight ? '🌙 Темна тема' : '☀️ Світла тема';
});

function updateFilters() {
    isFavoritesMode = false;
    sentinel.style.display = 'block';
    const sortBy = sortSelect.value;
    let genre = genreSelect.value;
    const rating = ratingSelect.value;
    let filterUrl = `https://api.themoviedb.org/3/discover/${currentType}?sort_by=${sortBy}&api_key=${API_KEY}&language=uk-UA`;
    if (genre) filterUrl += `&with_genres=${genre}`;
    if (rating) filterUrl += `&vote_average.gte=${rating}`;
    currentPage = 1; 
    currentUrl = filterUrl; 
    getMovies(currentUrl, false);
}

contentTypeSelect.addEventListener('change', () => { currentType = contentTypeSelect.value; updateFilters(); });
applyFiltersBtn.addEventListener('click', () => { updateFilters(); });
homeBtn.addEventListener('click', () => { window.location.reload(); });

async function getMovies(url, append = false) {
    if (isFetching || isFavoritesMode) return;
    isFetching = true;
    if (!append) showSkeletons();
    try {
        const resp = await fetch(`${url}&page=${currentPage}`);
        const data = await resp.json();
        if (!append) main.innerHTML = '';
        if (data.results) {
            showMovies(data.results);
            totalPages = data.total_pages > 500 ? 500 : data.total_pages;
        }
    } catch (e) { console.error(e); }
    isFetching = false;
}

function showMovies(movies){
    movies.forEach(movie => {
        const title = movie.title || movie.name;
        const imageSrc = movie.poster_path ? IMGPATH + movie.poster_path : 'https://via.placeholder.com/500x750?text=No+Image';
        const isLiked = userFavorites.includes(movie.id);
        const movieEl = document.createElement('div');
        movieEl.classList.add('movie');
        movieEl.innerHTML = `
            <button class="favorite-btn ${isLiked ? 'liked' : ''}" onclick="toggleFavorite(${movie.id}, event)">${isLiked ? '❤️' : '🤍'}</button>
            <img src="${imageSrc}" alt="${title}"/>
            <div class="movie-info"><h3>${title}</h3><span class="green">${movie.vote_average}</span></div>
            <div class="overview"><h3>Опис:</h3>${movie.overview || 'Немає'} <br><br>
            <button class="details-btn" onclick="openDetails(${movie.id})">Деталі</button></div>`;
        main.appendChild(movieEl);
    });
}

function showSkeletons() {
    main.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const div = document.createElement('div');
        div.classList.add('skeleton', 'skeleton-movie');
        main.appendChild(div);
    }
}

async function openDetails(id) {
    modal.style.display = 'block';
    modalTitle.innerText = "Завантаження...";
    try {
        const resp = await fetch(`https://api.themoviedb.org/3/${currentType}/${id}?api_key=${API_KEY}&language=uk-UA&append_to_response=videos,credits`);
        const data = await resp.json();
        modalTitle.innerText = data.title || data.name;
        const trailer = data.videos.results.find(v => v.type === 'Trailer');
        trailerContainer.innerHTML = trailer ? `<iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen></iframe>` : 'Трейлер відсутній';
    } catch (e) { console.error(e); }
}

closeModal.onclick = () => { modal.style.display = 'none'; trailerContainer.innerHTML = ''; };

const observer = new IntersectionObserver((entries) => {
    if(entries[0].isIntersecting && !isFetching && !isFavoritesMode) {
        currentPage++; getMovies(currentUrl, true);
    }
}, { rootMargin: '200px' });
observer.observe(sentinel);

getMovies(currentUrl, false);
