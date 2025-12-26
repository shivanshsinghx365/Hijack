# ⚡ Hijack! Chess

An online multiplayer chess variant where captured pieces **change color** instead of being removed from the board!

[![Play Now](https://img.shields.io/badge/Play-Online-success?style=for-the-badge)](https://hijack.onrender.com)

## 🎮 Game Rules

**⚡Hijack!** follows standard chess rules with one exciting twist:
- When you capture a piece (**except with the King**), the captured piece changes to your color
- The attacking piece is removed from the board
- Kings capture normally (pieces are removed)

All other chess rules apply: castling, en passant, promotion, checkmate, etc.

## ✨ Features

- 🌐 **Online Multiplayer** - Play with friends or random opponents
- 🎲 **Matchmaking System** - Find random opponents with time control preferences
- ⏱️ **Multiple Time Controls** - Bullet, Blitz, Rapid, Classical, or No Clock
- 🎨 **Customizable Themes** - 4 board themes, Light/Dark mode
- 🔄 **Rematch System** - Challenge your opponent again
- 📊 **Live Statistics** - See online players and total visits
- 💾 **Offline Mode** - Play locally on the same device
- 📱 **Mobile Support** - Play directly from your mobile device

## 🚀 Quick Start

### Play Online (Deployed)
Just visit: **[Your Deployed URL]** and start playing!

### Run Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Open in browser:**
   ```
   http://localhost:3000
   ```

## 🎯 How to Play Online

### Option 1: Play Random
1. Select your time control
2. Click **🎲 Play Random**
3. Get matched with an opponent automatically

### Option 2: Play with Friends
**Player 1 (Host):**
1. Click **➕ Create Room**
2. Share the Room ID with your friend

**Player 2 (Guest):**
1. Enter the Room ID
2. Click **🚪 Join Room**

### Play Offline
Just click **🌼 New Game** - no server needed!

## ⚙️ Configuration

### Environment Variables
Create a `.env` file (see `.env.example`):
```env
MONGODB_URI=your_mongodb_connection_string
PORT=3000
```

### MongoDB Setup (Optional)
For visitor analytics, set up MongoDB Atlas:
1. Create free account at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Create M0 Sandbox cluster (free)
3. Get connection string
4. Add to `.env` or hosting platform environment variables

**Note:** App works without MongoDB, analytics just won't persist.

## 🌐 Deployment

### Deploy to Render (Free)
1. Push code to GitHub
2. Create new Web Service on [Render](https://render.com)
3. Connect your GitHub repo
4. Add environment variable: `MONGODB_URI`
5. Deploy!

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Node.js, Express.js
- **Real-time:** Socket.IO (WebSockets)
- **Database:** MongoDB Atlas (optional)
- **Deployment:** Render/Railway

## 📂 Project Structure

```
Hijack/
├── index.html          # Frontend game UI
├── server.js           # Backend Socket.IO server
├── logo.png            # Game logo
├── package.json        # Dependencies
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## 🎨 Customization

### Board Themes
- 🪵 Wood (default)
- 🌿 Green (Chess.com style)
- ♟️ Classic (Black & White)
- 🌊 Waves (Blue)

### Time Controls
- No Clock
- 1+0 Bullet
- 3+0, 3+2 Blitz
- 5+0, 5+3 Blitz
- 10+0 Rapid
- 15+10 Rapid
- 30+0 Classical

## 📜 License

Licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html).

## 👨‍💻 Author

**Shivansh Singh**
- 💼 [LinkedIn](https://linkedin.com/in/shivanshx365)
- 🐙 [GitHub](https://github.com/shivanshsinghx365)

## 🤝 Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 🎯 Roadmap

- To be decided...

---

**Enjoy playing ⚡Hijack! Chess!** ⚡♟️
