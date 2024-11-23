const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("./models/User");
const Post = require("./models/Post");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

const app = express();

// Configuration Constants
const salt = bcrypt.genSaltSync(10);
const secret = "mingiyapapale";

// Cloudinary Configuration
cloudinary.config({
  cloud_name: "dnur3z7la",
  api_key: "317233934249263",
  api_secret: "RA4obr8RwK-mKD2n2UtBQvXfsrY",
});

// Cloudinary Storage Configuration
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "mern-blog",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const upload = multer({ storage });

app.use(
  cors({
    origin: "https://mern-blog-sandy-eight.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://mern-blog-sandy-eight.vercel.app'); // Replace with your frontend's origin
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE'); // Specify allowed methods
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Specify allowed headers
  next();
});
app.use(express.json());
app.use(cookieParser());

// Routes
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, salt);
    const userDoc = await User.create({ username, password: hashedPassword });
    res.json(userDoc);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Username already exists" });
    }
    res.status(500).json(error);
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }
  const userDoc = await User.findOne({ username });
  if (!userDoc) {
    return res.status(400).json({
      message: "User Does Not Exist",
    });
  }
  const passOk = await bcrypt.compare(password, userDoc.password);
  if (passOk) {
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie("token", token).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    res.status(401).json({ message: "Invalid username or password" });
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json({ message: "Token not provided" });
  }
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    res.json(info);
  });
});

app.post("/post", upload.single("file"), async (req, res) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json({ message: "Token not provided" });
  }
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    const { title, summary, content } = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: req.file.path, // Cloudinary URL
      author: info.id,
    });
    res.json(postDoc);
  });
});

app.get("/post", async (req, res) => {
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({
        createdAt: -1,
      })
      .limit(20)
  );
});

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.status(200).json(postDoc);
});

app.put("/post", upload.single("file"), async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json("You are not the author");
    }
    await postDoc.update({
      title,
      summary,
      content,
      cover: req.file ? req.file.path : postDoc.cover, // Use Cloudinary URL
    });

    res.json(postDoc);
  });
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Server is running");
  })
  .catch((error) => {
    console.log(error);
  });

module.exports = app;
