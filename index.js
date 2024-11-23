const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Post = require("./models/Post");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/" });
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

// Load environment variables from .env file

// Cloudinary Configuration
cloudinary.config({
  cloud_name: "dnur3z7la",
  api_key: "317233934249263",
  api_secret: "RA4obr8RwK-mKD2n2UtBQvXfsrY",
});

const salt = bcrypt.genSaltSync(10);
const secret = "asdfe45we45w345wegw345werjktjwertkj";

const app = express();

app.use(cors({ credentials: true, origin: "https://mern-blog-sandy-eight.vercel.app" }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

// User Registration
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.log(e);
    res.status(400).json(e);
  }
});

// User Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    // logged in
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie("token", token).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json("wrong credentials");
  }
});

// User Profile
app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

// User Logout
app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

// Create Post with Image Upload (Cloudinary)
app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { file } = req;
  const { token } = req.cookies;

  if (file) {
    // Upload the file to Cloudinary
    cloudinary.uploader.upload(file.path, async (error, result) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ error: "Failed to upload image" });
      }

      // Extract the URL of the uploaded image
      const imageUrl = result.secure_url;

      // Remove the file after uploading to Cloudinary
      fs.unlinkSync(file.path);

      // Handle the post creation logic
      jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { title, summary, content } = req.body;
        const postDoc = await Post.create({
          title,
          summary,
          content,
          cover: imageUrl, // Store the Cloudinary image URL
          author: info.id,
        });
        res.json(postDoc);
      });
    });
  } else {
    res.status(400).json({ error: "No image uploaded" });
  }
});

// Update Post with Image Upload (Cloudinary)
app.put("/post", uploadMiddleware.single("file"), async (req, res) => {
  let newCoverUrl = null;

  if (req.file) {
    // Upload the file to Cloudinary
    cloudinary.uploader.upload(req.file.path, async (error, result) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ error: "Failed to upload image" });
      }
      newCoverUrl = result.secure_url; // Get the image URL from Cloudinary

      // Remove the file after uploading to Cloudinary
      fs.unlinkSync(req.file.path);
    });
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json("you are not the author");
    }

    await postDoc.update({
      title,
      summary,
      content,
      cover: newCoverUrl || postDoc.cover, // Use the new image URL or the old one if no file was uploaded
    });

    res.json(postDoc);
  });
});

// Get All Posts
app.get("/post", async (req, res) => {
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

// Get Post by ID
app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});

// MongoDB Connection
mongoose
  .connect(
    "mongodb+srv://saqib:saqib12@cluster0.kuoxsy9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  )
  .then(() => {
    console.log("Connected to MongoDB, server is running...");
  });

// Start Express Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
