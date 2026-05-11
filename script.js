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

// Жорсткий фільтр для головної сторінки
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

const genresMap = {
    28: "Бойовик", 12: "Пригоди", 16: "Мультфільм", 35: "Комедія",
    80: "Кримінал", 99: "Документальний", 18: "Драма", 10751: "Сімейний",
    14: "Фентезі", 36: "Історія", 27: "Жахи", 10402: "Музика",
    9648: "Детектив", 10749: "Мелодрама", 878: "Фантастика",
    10770: "ТБ", 53: "Трилер", 10752: "Військовий", 37: "Вестерн",
    10759: "Бойовик/Пригоди", 10765: "Фантастика", 10768: "Війна/Політика"
};

// ==========================================
// 3. АВТОРИЗАЦІЯ ТА ЛАЙКИ (SUPABASE)
// ==========================================
let isLoginMode = true;

loginBtn.addEventListener('click', () => { authModal.style.display = 'block'; authEmail.value = ''; authPassword.value = ''; });
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
    const email = authEmail.value; const password = authPassword.value;
    if (isLoginMode) {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) alert("Помилка входу: " + error.message); else { authModal.style.display = 'none'; }
    } else {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) alert("Помилка реєстрації: " + error.message); else { alert("Акаунт створено!"); authModal.style.display = 'none'; }
    }
});

// Бронебійна кнопка ВИЙТИ
logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    for (let key in localStorage) {
        if (key.includes('-auth-token') || key.includes('supabase')) {
            localStorage.removeItem(key);
        }
    }
    window.location.reload();
});

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        currentUser = session.user;
        loginBtn.style.display = 'none'; 
        logoutBtn.style.display = 'inline-block';
        favoritesBtn.style.display = 'inline-block';
        await loadFavorites(); 
        if(!isFavoritesMode) getMovies(currentUrl, false); 
    } else {
        currentUser = null;
        userFavorites = [];
        loginBtn.style.display = 'inline-block'; 
        logoutBtn.style.display = 'none';
        favoritesBtn.style.display = 'none';
        isFavoritesMode = false;
    }
});

async function loadFavorites() {
    if (!currentUser) return;
    const { data, error } = await supabaseClient
        .from('user_actions')
        .select('movie_id')
        .eq('user_id', currentUser.id)
        .eq('is_favorite', true);
    if (data) userFavorites = data.map(item => item.movie_id);
}

window.toggleFavorite = async function(movieId, event) {
    event.stopPropagation(); 
    if (!currentUser) { alert("Будь ласка, увійдіть в акаунт, щоб зберігати фільми!"); return; }
    
    const button = event.target;
    const isLiked = userFavorites.includes(movieId);

    if (isLiked) {
        userFavorites = userFavorites.filter(id => id !== movieId);
        button.classList.remove('liked');
        button.innerText = '🤍';
        
        const { error } = await supabaseClient.from('user_actions').delete().eq('user_id', currentUser.id).eq('movie_id', movieId);
        if (error) { console.error("Помилка видалення:", error); alert("Не вдалося видалити: " + error.message); }
        if (isFavoritesMode) button.closest('.movie').remove();
    } else {
        userFavorites.push(movieId);
        button.classList.add('liked');
        button.innerText = '❤️';
        
        const { error } = await supabaseClient.from('user_actions').insert({ user_id: currentUser.id, movie_id: movieId, is_favorite: true });
        if (error) { 
            console.error("Помилка збереження:", error); 
            alert("Помилка БД: " + error.message); 
            userFavorites = userFavorites.filter(id => id !== movieId);
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
        main.innerHTML = '<h2 style="text-align: center; width: 100%;">У вас ще немає збережених фільмів 😔</h2>';
        return;
    }
    
    showSkeletons();
    
    try {
        const promises = userFavorites.map(id => 
            fetch(`https://api.themoviedb.org/3/${currentType}/${id}?api_key=${API_KEY}&language=uk-UA`).then(res => res.json())
        );
        const results = await Promise.all(promises);
        main.innerHTML = '';
        
        const validMovies = results.filter(m => m.id);
        if(validMovies.length > 0) showMovies(validMovies);
        else main.innerHTML = '<h2 style="text-align: center; width: 100%;">У цій категорії немає збережень.</h2>';
    } catch(e) { console.error(e); }
});

// ==========================================
// 4. ІНШИЙ КОД САЙТУ
// ==========================================
if (localStorage.getItem('theme') === 'light') { document.body.classList.add('light-theme'); themeToggleBtn.innerText = '🌙 Темна тема'; }
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeToggleBtn.innerText = isLight ? '🌙 Темна тема' : '☀️ Світла тема';
});

function updateFilters() {
    isFavoritesMode = false;
    sentinel.style.display = 'block';
    const sortBy = sortSelect.value; let genre = genreSelect.value; const rating = ratingSelect.value;
    if (currentType === 'tv' && genre) {
        if (genre === '28' || genre === '12') genre = '10759'; 
        if (genre === '878' || genre === '14') genre = '10765'; 
        if (genre === '53') genre = '9648'; 
    }
    let filterUrl = `https://api.themoviedb.org/3/discover/${currentType}?sort_by=${sortBy}&api_key=${API_KEY}&language=uk-UA`;
    if (genre) filterUrl += `&with_genres=${genre}`;
    if (rating) filterUrl += `&vote_average.gte=${rating}`;
    if (sortBy === 'vote_average.desc') { filterUrl += `&vote_count.gte=2000`; filterUrl += `&without_genres=99,10402`; }
    currentPage = 1; currentUrl = filterUrl; getMovies(currentUrl, false);
}

contentTypeSelect.addEventListener('change', () => { currentType =
