const SUGGESTIONS_API_URL = 'https://raw.githubusercontent.com/christopher-roelofs/PortMaster-Suggestions/main/suggestions.json';

const SUGGESTION_CONTENT = {
    programming_language: [
        "ActionScript", "C#", "C/C++", "GDScript", "Haxe", "Java",
        "Javascript", "Lua", "Python", "Ruby", "Rust", "Other/Unknown",
    ],
    license: [
        "CC-BY-*", "CC0/Public Domain", "GPL/AGPL/LGPL", "MIT/BSD/zlib", "Other/Unknown",
    ],
    content: ["Commercial", "Free", "Open Source"],
    engine: [
        "Adobe Flash/AIR", "AdventureGameStudio", "FNA", "Flixel/OpenFL/Lime",
        "Game Maker", "GameMaker Studio", "GameMaker Studio 2",
        "Godot 3.x", "Godot 4.x", "LÖVE", "MonoGame", "PyGame",
        "RPGMaker", "Ren'Py", "Unity", "Unreal", "XNA", "Other/Unknown",
    ],
    category: ["Emulator", "Engine", "Game", "Other"],
    dependency: [
        "Allegro", "Box86/Box64", "JVM", "OpenGL", "Python", "Qt",
        "SDL 1.x", "SDL 2.x", "Steamworks", "Vorbis", "Vulkan",
        "X11", "libGDX", "Other/Unknown",
    ],
    unsupported_engine: ["Unity", "Godot 4.x", "Adobe Flash/AIR", "XNA"],
};

let existingSuggestions = [];

window.addEventListener('DOMContentLoaded', async function () {
    populateSelect('language', SUGGESTION_CONTENT.programming_language);
    populateSelect('license', SUGGESTION_CONTENT.license);
    populateSelect('content', SUGGESTION_CONTENT.content);
    populateSelect('engine', SUGGESTION_CONTENT.engine);
    populateSelect('category', SUGGESTION_CONTENT.category);
    populateSelect('dependencies', SUGGESTION_CONTENT.dependency);

    document.getElementById('engine').addEventListener('change', onEngineChange);
    document.getElementById('title').addEventListener('input', () => clearError('title-invalid'));
    document.getElementById('weburl').addEventListener('input', () => clearError('website-invalid'));
    document.getElementById('imageurl').addEventListener('input', () => clearError('image-invalid'));
    document.getElementById('form').addEventListener('submit', onSubmit);

    new bootstrap.Modal('#popup').show();

    const statusEl = document.getElementById('load-status');
    const submitBtn = document.getElementById('submit');
    try {
        const response = await fetch(SUGGESTIONS_API_URL);
        if (!response.ok) throw new Error('Network response was not ok.');
        existingSuggestions = await response.json();
        statusEl.textContent = `Loaded ${existingSuggestions.length} existing suggestions. Your entry will be appended.`;
        submitBtn.disabled = false;
    } catch (err) {
        console.error('Error fetching existing suggestions:', err);
        statusEl.textContent = 'Could not load existing suggestions. Your download will contain only the new entry.';
        statusEl.classList.remove('text-muted');
        statusEl.classList.add('text-warning');
        submitBtn.disabled = false;
    }
});

function populateSelect(id, options) {
    const select = document.getElementById(id);
    for (const value of options) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
    }
}

function onEngineChange() {
    const engine = document.getElementById('engine').value;
    clearError('engine-invalid');
    if (engine === 'Game Maker' || engine === 'GameMaker Studio' || engine === 'GameMaker Studio 2') {
        new bootstrap.Modal('#gmpopup').show();
    }
}

function clearError(id) {
    const el = document.getElementById(id);
    el.style.display = 'none';
    el.textContent = '';
}

function showError(id, message) {
    const el = document.getElementById(id);
    el.textContent = message;
    el.style.display = 'block';
}

function checkEngine() {
    const engine = document.getElementById('engine').value;
    if (SUGGESTION_CONTENT.unsupported_engine.includes(engine)) {
        showError('engine-invalid', `PortMaster does not support ${engine} at this time.`);
        return false;
    }
    return true;
}

function checkUrl(inputId, errorId) {
    const value = document.getElementById(inputId).value.trim();
    if (!value.toLowerCase().startsWith('http')) {
        showError(errorId, 'Please provide a valid url.');
        return false;
    }
    return true;
}

function checkTitle() {
    const title = document.getElementById('title').value.trim();
    if (!title) {
        showError('title-invalid', 'Title is required.');
        return false;
    }
    const duplicate = existingSuggestions.some(s =>
        (s.title || '').trim().toLowerCase() === title.toLowerCase()
    );
    if (duplicate) {
        showError('title-invalid', 'This suggestion title already exists.');
        return false;
    }
    return true;
}

function getSelectedDependencies() {
    const select = document.getElementById('dependencies');
    const selected = Array.from(select.selectedOptions).map(o => o.value);
    return selected.length ? selected.join(',') : 'Other/Unknown';
}

function generateId() {
    if (crypto && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/-/g, '');
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function todayIsoDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function buildSuggestion() {
    const form = document.getElementById('form');
    const data = new FormData(form);
    return {
        id: generateId(),
        userid: '',
        author: '',
        title: data.get('title').trim(),
        weburl: data.get('weburl').trim(),
        imageurl: data.get('imageurl').trim(),
        license: data.get('license'),
        content: data.get('content'),
        engine: data.get('engine'),
        language: data.get('language'),
        category: data.get('category'),
        dependencies: getSelectedDependencies(),
        comment: data.get('comment') || '',
        feasibility: 'low',
        status: 'Pending',
        tags: '',
        date: todayIsoDate(),
        voteCount: 0,
    };
}

function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function onSubmit(event) {
    event.preventDefault();
    const valid = [checkEngine(), checkTitle(), checkUrl('weburl', 'website-invalid'), checkUrl('imageurl', 'image-invalid')].every(Boolean);
    if (!valid) return;

    const newSuggestion = buildSuggestion();
    const updated = [...existingSuggestions, newSuggestion];
    downloadJson('suggestions.json', updated);
}
