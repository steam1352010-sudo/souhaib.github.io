const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

const USERS_FILE = path.join(__dirname, "users.json");
const POSTS_FILE = path.join(__dirname, "posts.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf8");
  }
}

function readJsonArray(filePath) {
  ensureFile(filePath);
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveJsonArray(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readUsers() {
  return readJsonArray(USERS_FILE);
}

function saveUsers(users) {
  saveJsonArray(USERS_FILE, users);
}

function readPosts() {
  return readJsonArray(POSTS_FILE);
}

function savePosts(posts) {
  saveJsonArray(POSTS_FILE, posts);
}

function normalizeUser(user) {
  const name = String(user?.name || "").trim();

  return {
    id: String(user?.id || Date.now().toString()),
    name,
    email: String(user?.email || "").trim(),
    password: user?.password || "",
    avatar:
      user?.avatar ||
      `https://via.placeholder.com/150/3b5998/ffffff?text=${encodeURIComponent(
        (name[0] || "U").toUpperCase()
      )}`,
    friends: Array.isArray(user?.friends) ? user.friends : [],
    createdAt: typeof user?.createdAt === "number" ? user.createdAt : Date.now()
  };
}

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// تسجيل حساب جديد
app.post("/api/register", (req, res) => {
  const users = readUsers();
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.json({
      success: false,
      message: "جميع الحقول مطلوبة"
    });
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.json({
      success: false,
      message: "البريد الإلكتروني مستخدم"
    });
  }

  const newUser = normalizeUser({
    id: Date.now().toString(),
    name,
    email,
    password
  });

  users.push(newUser);
  saveUsers(users);

  res.json({
    success: true,
    message: "تم إنشاء الحساب",
    user: newUser
  });
});

// تسجيل الدخول
app.post("/api/login", (req, res) => {
  const users = readUsers();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.json({
      success: false,
      message: "جميع الحقول مطلوبة"
    });
  }

  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.json({
      success: false,
      message: "البريد الإلكتروني أو كلمة المرور غير صحيحة"
    });
  }

  res.json({
    success: true,
    message: "تم تسجيل الدخول",
    user: normalizeUser(user)
  });
});

// جلب المنشورات
app.get("/api/posts", (req, res) => {
  const posts = readPosts();
  res.json(posts);
});

// إنشاء منشور
app.post("/api/posts", (req, res) => {
  const posts = readPosts();
  const { userId, text, image } = req.body;

  if (!userId) {
    return res.json({
      success: false,
      message: "مطلوب userId"
    });
  }

  const newPost = {
    id: Date.now().toString(),
    userId,
    text: String(text || ""),
    image: image || null,
    likes: [],
    comments: [],
    createdAt: Date.now()
  };

  posts.push(newPost);
  savePosts(posts);

  res.json({
    success: true,
    post: newPost
  });
});

// الإعجاب بمنشور
app.put("/api/posts/:id/like", (req, res) => {
  const posts = readPosts();
  const post = posts.find(p => p.id === req.params.id);

  if (!post) {
    return res.json({
      success: false,
      message: "المنشور غير موجود"
    });
  }

  const userId = String(req.body?.userId || "").trim();
  if (!userId) {
    return res.json({
      success: false,
      message: "مطلوب userId"
    });
  }

  if (!Array.isArray(post.likes)) {
    post.likes = [];
  }

  const index = post.likes.indexOf(userId);
  if (index >= 0) {
    post.likes.splice(index, 1);
  } else {
    post.likes.push(userId);
  }

  savePosts(posts);

  res.json({
    success: true,
    post
  });
});

// إضافة تعليق لمنشور
app.post("/api/posts/:id/comments", (req, res) => {
  const posts = readPosts();
  const post = posts.find(p => p.id === req.params.id);

  if (!post) {
    return res.json({
      success: false,
      message: "المنشور غير موجود"
    });
  }

  const userId = String(req.body?.userId || "").trim();
  const text = String(req.body?.text || "").trim();

  if (!userId || !text) {
    return res.json({
      success: false,
      message: "مطلوب userId والنص"
    });
  }

  if (!Array.isArray(post.comments)) {
    post.comments = [];
  }

  post.comments.push({
    userId,
    text,
    createdAt: Date.now()
  });

  savePosts(posts);

  res.json({
    success: true,
    post
  });
});

app.listen(3000, () => {
  console.log("السيرفر يعمل على http://localhost:3000");
});