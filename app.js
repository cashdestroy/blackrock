const STORAGE_KEY = "tagtracker_v2";
const GUEST_USER_ID = "guest-user";
const newId = () =>
  globalThis.crypto?.randomUUID?.() || `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const defaultState = {
  users: [
    {
      id: GUEST_USER_ID,
      username: "Guest",
      password: "",
      joinedAt: Date.now(),
      isGuest: true
    }
  ],
  sessionUserId: null,
  tags: [
    {
      id: newId(),
      brand: "Anvil",
      style: "Heavyweight Cotton",
      year: "1994",
      notes: "Common in 90s concert tees.",
      image: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=60",
      authorId: null,
      favorites: []
    }
  ],
  posts: [
    {
      id: newId(),
      title: "Welcome to TagTracker",
      body: "Share your finds, ask questions, and help identify obscure labels.",
      authorId: null,
      createdAt: Date.now(),
      likes: [],
      comments: []
    }
  ],
  theme: {
    primary: "#2a3c7a",
    background: "#eef1f8"
  }
};

if (typeof document === "undefined") {
  console.log("TagTracker app.js is a browser script. Run `python -m http.server 4173` and open index.html in a browser.");
} else {
  const state = loadState();
  const els = mapElements();
  wireEvents();
  applyTheme();
  renderAll();

  function mapElements() {
    return {
      tabs: [...document.querySelectorAll(".tab")],
      panels: [...document.querySelectorAll(".tab-panel")],
      sessionView: document.getElementById("session-view"),
      authUsername: document.getElementById("auth-username"),
      authPassword: document.getElementById("auth-password"),
      guestLoginBtn: document.getElementById("guest-login"),
      tagForm: document.getElementById("tag-form"),
      tagSearch: document.getElementById("tag-search"),
      tagGrid: document.getElementById("tag-grid"),
      tagGuestLock: document.getElementById("tag-guest-lock"),
      favoritesSearch: document.getElementById("favorites-search"),
      favoritesList: document.getElementById("favorites-list"),
      postForm: document.getElementById("post-form"),
      postList: document.getElementById("post-list"),
      forumGuestLock: document.getElementById("forum-guest-lock"),
      contributorList: document.getElementById("top-contributors"),
      themeForm: document.getElementById("theme-form"),
      themePrimary: document.getElementById("theme-primary"),
      themeBackground: document.getElementById("theme-background"),
      themeReset: document.getElementById("theme-reset")
    };
  }

  function wireEvents() {
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    });

    document.querySelectorAll("[data-auth-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleAuth(btn.dataset.authAction));
    });

    els.guestLoginBtn.addEventListener("click", loginAsGuest);
    els.tagForm.addEventListener("submit", onTagSubmit);
    els.tagSearch.addEventListener("input", renderTags);
    els.favoritesSearch.addEventListener("input", renderFavorites);
    els.postForm.addEventListener("submit", onPostSubmit);

    els.themeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      state.theme.primary = els.themePrimary.value;
      state.theme.background = els.themeBackground.value;
      saveState();
      applyTheme();
    });

    els.themeReset.addEventListener("click", () => {
      state.theme = { ...defaultState.theme };
      saveState();
      applyTheme();
    });
  }

  function activateTab(tabName) {
    els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
    els.panels.forEach((panel) => panel.classList.toggle("active", panel.id === tabName));
  }

  function handleAuth(action) {
    const username = els.authUsername.value.trim();
    const password = els.authPassword.value;

    if (username.length < 3 || password.length < 6) {
      return notify("Username must be 3+ chars and password 6+ chars.");
    }

    const existing = state.users.find((user) => user.username.toLowerCase() === username.toLowerCase());

    if (action === "register") {
      if (existing) return notify("Username already exists.");
      const user = {
        id: newId(),
        username,
        password,
        joinedAt: Date.now(),
        isGuest: false
      };
      state.users.push(user);
      state.sessionUserId = user.id;
      notify("Account created.");
    }

    if (action === "login") {
      if (!existing || existing.password !== password || existing.isGuest) return notify("Invalid login.");
      state.sessionUserId = existing.id;
      notify(`Welcome back ${existing.username}.`);
    }

    saveState();
    renderSession();
    renderAll();
  }

  function loginAsGuest() {
    state.sessionUserId = GUEST_USER_ID;
    saveState();
    notify("Guest mode enabled. Browsing only; interactions are locked.");
    renderSession();
    renderAll();
  }

  function logout() {
    state.sessionUserId = null;
    saveState();
    renderSession();
    renderAll();
  }

  function onTagSubmit(event) {
    event.preventDefault();
    const user = currentUser();
    if (!canInteract(user)) return notify("Log in with an account to upload tags.");

    const get = (id) => document.getElementById(id).value.trim();
    const tag = {
      id: newId(),
      brand: get("tag-brand"),
      style: get("tag-style"),
      year: get("tag-year"),
      notes: get("tag-notes"),
      image: get("tag-image") || "",
      authorId: user.id,
      favorites: []
    };

    if (!tag.brand || !tag.style) return notify("Brand and style are required.");
    state.tags.unshift(tag);
    saveState();
    els.tagForm.reset();
    renderTags();
    renderContributors();
  }

  function onPostSubmit(event) {
    event.preventDefault();
    const user = currentUser();
    if (!canInteract(user)) return notify("Log in with an account to create posts.");

    const title = document.getElementById("post-title").value.trim();
    const body = document.getElementById("post-body").value.trim();
    if (!title || !body) return;

    state.posts.unshift({
      id: newId(),
      title,
      body,
      authorId: user.id,
      createdAt: Date.now(),
      likes: [],
      comments: []
    });

    saveState();
    els.postForm.reset();
    renderPosts();
  }

  function renderAll() {
    renderSession();
    renderTags();
    renderFavorites();
    renderPosts();
    renderContributors();
    els.themePrimary.value = state.theme.primary;
    els.themeBackground.value = state.theme.background;
  }

  function renderSession() {
    const user = currentUser();
    if (!user) {
      els.sessionView.classList.add("hidden");
      renderAccessLocks();
      return;
    }

    els.sessionView.classList.remove("hidden");
    els.sessionView.innerHTML = `
      <p><strong>${escapeHtml(user.username)}</strong> is logged in.${user.isGuest ? " (Read-only guest mode)" : ""}</p>
      <button id="logout-btn" class="secondary">Log out</button>
    `;
    document.getElementById("logout-btn").addEventListener("click", logout);
    renderAccessLocks();
  }

  function renderTags() {
    const search = els.tagSearch.value.trim().toLowerCase();
    const template = document.getElementById("tag-card-template");
    els.tagGrid.innerHTML = "";

    const filtered = state.tags.filter((tag) => {
      const haystack = `${tag.brand} ${tag.style} ${tag.year} ${tag.notes}`.toLowerCase();
      return haystack.includes(search);
    });

    filtered.forEach((tag) => {
      const node = template.content.firstElementChild.cloneNode(true);
      node.querySelector("img").src = tag.image || placeholderImage(tag.brand);
      node.querySelector("h3").textContent = tag.brand;
      node.querySelector(".meta").textContent = `${tag.style}${tag.year ? ` • ${tag.year}` : ""}`;
      node.querySelector(".notes").textContent = tag.notes || "No notes added.";
      node.querySelector(".author").textContent = `By ${usernameById(tag.authorId)}`;

      const favBtn = node.querySelector(".favorite-btn");
      const isFav = isFavoritedByCurrentUser(tag);
      favBtn.textContent = isFav ? "★ Favorited" : "☆ Favorite";
      favBtn.disabled = !canInteract(currentUser());

      favBtn.addEventListener("click", () => {
        const user = currentUser();
        if (!canInteract(user)) return notify("Create/login to an account to favorite tags.");
        if (isFav) {
          tag.favorites = tag.favorites.filter((id) => id !== user.id);
        } else {
          tag.favorites.push(user.id);
        }
        saveState();
        renderTags();
        renderFavorites();
      });

      els.tagGrid.appendChild(node);
    });
  }

  function renderFavorites() {
    const user = currentUser();
    const q = els.favoritesSearch.value.trim().toLowerCase();
    els.favoritesList.innerHTML = "";

    if (!user) {
      els.favoritesList.innerHTML = "<p>Log in to see favorites.</p>";
      return;
    }

    if (user.isGuest) {
      els.favoritesList.innerHTML = "<p>Guest mode cannot save favorites yet. Log in to your account.</p>";
      return;
    }

    const favorites = state.tags.filter(
      (tag) => tag.favorites.includes(user.id) && `${tag.brand} ${tag.style}`.toLowerCase().includes(q)
    );

    if (!favorites.length) {
      els.favoritesList.innerHTML = "<p>No favorites yet. Save some tags from TagTracker.</p>";
      return;
    }

    favorites.forEach((tag) => {
      const item = document.createElement("article");
      item.className = "tag-card";
      item.innerHTML = `
        <img src="${escapeAttr(tag.image || placeholderImage(tag.brand))}" alt="${escapeAttr(tag.brand)}" />
        <h3>${escapeHtml(tag.brand)}</h3>
        <p class="meta">${escapeHtml(tag.style)} ${tag.year ? `• ${escapeHtml(tag.year)}` : ""}</p>
      `;
      els.favoritesList.appendChild(item);
    });
  }

  function renderPosts() {
    const template = document.getElementById("post-template");
    els.postList.innerHTML = "";

    state.posts.forEach((post) => {
      const node = template.content.firstElementChild.cloneNode(true);
      node.querySelector("h3").textContent = post.title;
      node.querySelector(".meta").textContent = `By ${usernameById(post.authorId)} • ${new Date(post.createdAt).toLocaleString()}`;
      node.querySelector(".body").textContent = post.body;

      const likeBtn = node.querySelector(".like-btn");
      const likeCount = node.querySelector(".like-count");
      likeCount.textContent = `${post.likes.length} likes`;
      likeBtn.disabled = !canInteract(currentUser());
      likeBtn.addEventListener("click", () => {
        const user = currentUser();
        if (!canInteract(user)) return notify("Create/login to an account to like posts.");
        post.likes = post.likes.includes(user.id)
          ? post.likes.filter((id) => id !== user.id)
          : [...post.likes, user.id];
        saveState();
        renderPosts();
      });

      const commentForm = node.querySelector(".comment-form");
      commentForm.querySelector("button").disabled = !canInteract(currentUser());
      commentForm.querySelector("input").disabled = !canInteract(currentUser());
      commentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const user = currentUser();
        if (!canInteract(user)) return notify("Create/login to an account to comment.");
        const input = commentForm.elements.comment;
        const content = input.value.trim();
        if (!content) return;
        post.comments.push({ id: newId(), authorId: user.id, content });
        saveState();
        renderPosts();
      });

      const commentList = node.querySelector(".comments");
      post.comments.forEach((comment) => {
        const li = document.createElement("li");
        li.textContent = `${usernameById(comment.authorId)}: ${comment.content}`;
        commentList.appendChild(li);
      });

      els.postList.appendChild(node);
    });
  }

  function renderContributors() {
    const counts = new Map();
    state.tags.forEach((tag) => {
      const key = usernameById(tag.authorId);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!ranking.length) {
      els.contributorList.innerHTML = "<p>No contributions yet. Upload the first tag.</p>";
      return;
    }

    els.contributorList.innerHTML = `
      <h3>Top Contributors</h3>
      <ol>
        ${ranking.map(([name, count]) => `<li>${escapeHtml(name)} — ${count} tags</li>`).join("")}
      </ol>
    `;
  }

  function renderAccessLocks() {
    const disabled = !canInteract(currentUser());
    els.tagGuestLock.classList.toggle("hidden", !disabled);
    els.forumGuestLock.classList.toggle("hidden", !disabled);
    els.tagForm.querySelector("button[type='submit']").disabled = disabled;
    els.postForm.querySelector("button[type='submit']").disabled = disabled;
  }

  function applyTheme() {
    document.documentElement.style.setProperty("--primary", state.theme.primary);
    document.documentElement.style.setProperty("--background", state.theme.background);
    els.themePrimary.value = state.theme.primary;
    els.themeBackground.value = state.theme.background;
  }

  function isFavoritedByCurrentUser(tag) {
    const user = currentUser();
    return user ? tag.favorites.includes(user.id) : false;
  }

  function canInteract(user) {
    return Boolean(user && !user.isGuest);
  }

  function currentUser() {
    return state.users.find((user) => user.id === state.sessionUserId) || null;
  }

  function usernameById(id) {
    if (!id) return "TagTracker Team";
    return state.users.find((u) => u.id === id)?.username || "Unknown User";
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    try {
      const merged = { ...structuredClone(defaultState), ...JSON.parse(raw) };
      if (!Array.isArray(merged.users) || !merged.users.some((u) => u.id === GUEST_USER_ID)) {
        merged.users = [defaultState.users[0], ...(Array.isArray(merged.users) ? merged.users : [])];
      }
      return merged;
    } catch {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function notify(message) {
    window.alert(message);
  }

  function placeholderImage(seed) {
    return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(seed || "tag")}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
}
