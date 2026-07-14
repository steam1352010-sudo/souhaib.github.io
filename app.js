// ============ إدارة البيانات (localStorage) ============
function getUsers() {
  return JSON.parse(localStorage.getItem("fb_users") || "[]");
}

function saveUsers(u) {
  localStorage.setItem("fb_users", JSON.stringify(u));
}

function getPosts() {
  return JSON.parse(localStorage.getItem("fb_posts") || "[]");
}

function savePosts(p) {
  localStorage.setItem("fb_posts", JSON.stringify(p));
}

let currentUser = null;
let currentProfileUserId = null;

// ============ أدوات مساعدة ============
function defaultAvatarForName(name) {
  const first = String(name || "U").trim().charAt(0).toUpperCase() || "U";
  return `https://via.placeholder.com/150/3b5998/ffffff?text=${encodeURIComponent(first)}`;
}

function normalizeUser(user) {
  const name = String(user?.name || "").trim();
  return {
    id: String(user?.id || Date.now().toString()),
    name,
    email: String(user?.email || "").trim(),
    password: user?.password || "",
    avatar: user?.avatar || defaultAvatarForName(name),
    friends: Array.isArray(user?.friends) ? user.friends : [],
    createdAt: typeof user?.createdAt === "number" ? user.createdAt : Date.now()
  };
}

function upsertUser(user) {
  const normalized = normalizeUser(user);
  const users = getUsers();
  const idx = users.findIndex(u => u.id === normalized.id);

  if (idx >= 0) {
    users[idx] = {
      ...users[idx],
      ...normalized,
      friends: Array.isArray(users[idx].friends) ? users[idx].friends : normalized.friends
    };
  } else {
    users.push(normalized);
  }

  saveUsers(users);
  return normalized;
}

function isScreenVisible(id) {
  const el = document.getElementById(id);
  return !!el && el.style.display !== "none";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============ التنقل بين الشاشات ============
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => (s.style.display = "none"));
  const target = document.getElementById(id);
  if (target) target.style.display = "block";
}

// ============ تسجيل حساب ============
async function handleRegister() {
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const errorEl = document.getElementById("registerError");

  errorEl.textContent = "";

  if (!name || !email || !password) {
    errorEl.textContent = "الرجاء تعبئة جميع الحقول";
    return;
  }

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        email,
        password
      })
    });

    const result = await response.json();

    if (!result.success) {
      errorEl.textContent = result.message;
      return;
    }

    const user = upsertUser(result.user);
    loginAs(user);
  } catch (error) {
    errorEl.textContent = "حدث خطأ في الاتصال بالسيرفر";
    console.error(error);
  }
}

// ============ تسجيل الدخول ============
async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorEl = document.getElementById("loginError");

  errorEl.textContent = "";

  if (!email || !password) {
    errorEl.textContent = "الرجاء تعبئة جميع الحقول";
    return;
  }

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const result = await response.json();

    if (!result.success) {
      errorEl.textContent = result.message;
      return;
    }

    const user = upsertUser(result.user);
    loginAs(user);
  } catch (error) {
    errorEl.textContent = "حدث خطأ في الاتصال بالسيرفر";
    console.error(error);
  }
}

function loginAs(user) {
  currentUser = upsertUser(user);
  localStorage.setItem("fb_currentUserId", currentUser.id);
  renderTopbar();
  renderSidebar();
  showScreen("homeScreen");
  renderFeed();
}

function logout() {
  currentUser = null;
  currentProfileUserId = null;
  localStorage.removeItem("fb_currentUserId");
  showScreen("loginScreen");
  renderTopbar();
  renderSidebar();
}

// ============ الشريط العلوي ============
function renderTopbar() {
  const el = document.getElementById("topbarUser");
  if (!el) return;

  if (currentUser) {
    el.innerHTML = `
      <a onclick="goToProfile('${currentUser.id}')">${escapeHtml(currentUser.name)}</a>
      <a onclick="logout()">تسجيل خروج</a>`;
  } else {
    el.innerHTML = "";
  }
}

// ============ الشريط الجانبي (الرئيسية) ============
function renderSidebar() {
  const avatarEl = document.getElementById("sideAvatar");
  const nameEl = document.getElementById("sideName");
  const friendsEl = document.getElementById("sideFriends");

  if (!avatarEl || !nameEl || !friendsEl) return;

  if (!currentUser) {
    avatarEl.src = "";
    nameEl.textContent = "";
    friendsEl.textContent = "";
    return;
  }

  avatarEl.src = currentUser.avatar;
  nameEl.textContent = currentUser.name;
  friendsEl.textContent = "الأصدقاء: " + currentUser.friends.length;
}

// ============ نشر منشور ============
async function loadPostsFromServer() {
  try {
    const response = await fetch("/api/posts");
    if (!response.ok) throw new Error("فشل تحميل المنشورات");

    const posts = await response.json();
    const normalized = Array.isArray(posts) ? posts : [];
    savePosts(normalized);
    return normalized;
  } catch (error) {
    console.error(error);
    return getPosts();
  }
}

async function createPost() {
  if (!currentUser) return;

  const textEl = document.getElementById("postText");
  const fileInput = document.getElementById("postImage");
  if (!textEl || !fileInput) return;

  const text = textEl.value.trim();
  const file = fileInput.files[0];

  async function savePost(imageData) {
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: currentUser.id,
          text,
          image: imageData || null
        })
      });

      const result = await response.json();
      if (!result.success) {
        console.error(result.message || "تعذر نشر المنشور");
        return;
      }

      textEl.value = "";
      fileInput.value = "";

      await loadPostsFromServer();

      if (isScreenVisible("profileScreen") && currentProfileUserId === currentUser.id) {
        renderProfileFeed(currentProfileUserId);
      } else {
        renderFeed();
      }
    } catch (error) {
      console.error(error);
    }
  }

  if (!text && !file) return;

  if (file) {
    const reader = new FileReader();
    reader.onload = e => savePost(e.target.result);
    reader.readAsDataURL(file);
  } else {
    savePost(null);
  }
}

// ============ عرض المنشورات ============
async function renderFeed() {
  const feedEl = document.getElementById("feed");
  if (!feedEl) return;

  const posts = (await loadPostsFromServer()).sort((a, b) => b.createdAt - a.createdAt);
  const users = getUsers();
  feedEl.innerHTML = posts.map(p => postHTML(p, users)).join("") || `<div class="box">لا توجد منشورات بعد.</div>`;
}

function postHTML(post, users) {
  const author = users.find(u => u.id === post.userId);
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const liked = currentUser ? likes.includes(currentUser.id) : false;

  return `
  <div class="box post" data-post-id="${post.id}">
    <div>
      <img class="userpic" src="${author ? author.avatar : ""}">
      <a class="author" onclick="goToProfile('${post.userId}')">${author ? escapeHtml(author.name) : "مستخدم محذوف"}</a>
    </div>
    <div class="content">${escapeHtml(post.text)}</div>
    ${post.image ? `<img class="postimg" src="${post.image}">` : ""}
    <div class="meta">${new Date(post.createdAt).toLocaleString("ar-EG")}</div>
    <div class="actions">
      <a onclick="toggleLike('${post.id}')">${liked ? "إلغاء الإعجاب" : "أعجبني"} (${likes.length})</a>
      <span>تعليقات (${comments.length})</span>
    </div>
    <div class="comments">
      ${comments.map(c => {
        const cu = users.find(u => u.id === c.userId);
        return `<div class="comment"><b>${cu ? escapeHtml(cu.name) : "مستخدم"}:</b> ${escapeHtml(c.text)}</div>`;
      }).join("")}
    </div>
    <input type="text" class="comment-input" placeholder="اكتب تعليقاً..." onkeypress="handleCommentKey(event, '${post.id}', this)">
  </div>`;
}

// ============ الإعجاب ============
async function toggleLike(postId) {
  if (!currentUser) return;

  try {
    const response = await fetch(`/api/posts/${postId}/like`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: currentUser.id
      })
    });

    const result = await response.json();
    if (!result.success) {
      console.error(result.message || "تعذر تحديث الإعجاب");
      return;
    }

    await loadPostsFromServer();

    if (isScreenVisible("homeScreen")) renderFeed();
    else renderProfileFeed(currentProfileUserId);
  } catch (error) {
    console.error(error);
  }
}

// ============ التعليقات ============
async function handleCommentKey(event, postId, input) {
  if (!currentUser) return;

  if (event.key === "Enter" && input.value.trim()) {
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: currentUser.id,
          text: input.value.trim()
        })
      });

      const result = await response.json();
      if (!result.success) {
        console.error(result.message || "تعذر إضافة التعليق");
        return;
      }

      input.value = "";
      await loadPostsFromServer();

      if (isScreenVisible("homeScreen")) renderFeed();
      else renderProfileFeed(currentProfileUserId);
    } catch (error) {
      console.error(error);
    }
  }
}

// ============ صفحة البروفايل ============
function goToProfile(userId) {
  currentProfileUserId = userId;

  const users = getUsers();
  const profileUser = users.find(u => u.id === userId);
  if (!profileUser) return;

  const profAvatar = document.getElementById("profAvatar");
  const profName = document.getElementById("profName");
  const profFriends = document.getElementById("profFriends");
  const friendActionBox = document.getElementById("friendActionBox");
  const profilePostBox = document.getElementById("profilePostBox");

  if (profAvatar) profAvatar.src = profileUser.avatar;
  if (profName) profName.textContent = profileUser.name;
  if (profFriends) profFriends.textContent = "الأصدقاء: " + profileUser.friends.length;

  const isMe = currentUser && profileUser.id === currentUser.id;
  const isFriend = currentUser && Array.isArray(currentUser.friends) && currentUser.friends.includes(profileUser.id);

  if (friendActionBox) {
    friendActionBox.innerHTML = isMe
      ? ""
      : isFriend
        ? `<p class="muted" style="color:green;">صديق بالفعل ✔</p>`
        : `<button onclick="addFriend('${profileUser.id}')">إضافة صديق</button>`;
  }

  if (profilePostBox) {
    profilePostBox.innerHTML = isMe
      ? `<div class="box">
          <h3>بماذا تفكر؟</h3>
          <textarea id="postText" rows="2" placeholder="اكتب منشوراً..."></textarea>
          <input type="file" id="postImage" accept="image/*">
          <button onclick="createPost()">نشر</button>
        </div>`
      : "";
  }

  renderProfileFeed(userId);
  showScreen("profileScreen");
}

async function renderProfileFeed(userId) {
  const profileFeedEl = document.getElementById("profileFeed");
  if (!profileFeedEl) return;

  const users = getUsers();
  const posts = (await loadPostsFromServer())
    .filter(p => p.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);

  profileFeedEl.innerHTML = posts.map(p => postHTML(p, users)).join("") || `<div class="box">لا توجد منشورات بعد.</div>`;
}

function addFriend(targetId) {
  if (!currentUser) return;

  const users = getUsers();
  const me = users.find(u => u.id === currentUser.id);
  const target = users.find(u => u.id === targetId);
  if (!me || !target) return;

  if (!Array.isArray(me.friends)) me.friends = [];
  if (!Array.isArray(target.friends)) target.friends = [];

  if (!me.friends.includes(targetId)) {
    me.friends.push(targetId);
    target.friends.push(me.id);
    saveUsers(users);
    currentUser = upsertUser(me);
    goToProfile(targetId);
    renderSidebar();
  }
}

// ============ عند تحميل الصفحة ============
window.onload = function () {
  const savedId = localStorage.getItem("fb_currentUserId");
  if (savedId) {
    const user = getUsers().find(u => u.id === savedId);
    if (user) {
      loginAs(user);
      return;
    }
  }

  showScreen("loginScreen");
  renderTopbar();
  renderSidebar();
};