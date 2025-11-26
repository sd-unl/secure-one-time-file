const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse form data (for password submission)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (CSS, JS for the creator page)
app.use(express.static(path.join(__dirname, 'public')));

// Configure Storage
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 1024 * 1024 * 1 } // 1 MB Limit
});

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// In-memory Database
// Stores: id -> { path, originalName, password }
const fileStore = new Map();

// Helper: Generate a random 6-character password
function generatePassword() {
    return Math.random().toString(36).slice(-6).toUpperCase();
}

// 1. Upload Endpoint
app.post('/api/upload', upload.single('secretFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File required.' });

    const id = uuidv4();
    const password = generatePassword();

    fileStore.set(id, {
        path: req.file.path,
        originalName: req.file.originalname,
        password: password
    });

    const protocol = req.protocol;
    const host = req.get('host');
    
    // We return the Link AND the Password to the creator
    res.json({ 
        url: `${protocol}://${host}/file/${id}`,
        password: password
    });
});

// 2. The "Lock Screen" (GET Request)
// This just shows the password input field.
app.get('/file/:id', (req, res) => {
    const id = req.params.id;
    
    // If file doesn't exist, show 404
    if (!fileStore.has(id)) {
        return res.status(404).send('<h1>File not found or already downloaded.</h1>');
    }

    // Serve a simple HTML page with a password form
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Secure Download</title>
            <style>
                body { background: #2c3e50; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .box { background: #34495e; padding: 40px; border-radius: 8px; text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
                input { padding: 10px; border-radius: 4px; border: none; width: 200px; margin-bottom: 10px; }
                button { padding: 10px 20px; background: #2ecc71; border: none; color: white; border-radius: 4px; cursor: pointer; }
                button:hover { background: #27ae60; }
                .error { color: #e74c3c; margin-bottom: 15px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>File Locked</h2>
                <p>Enter password to download and destroy this file.</p>
                <form action="/file/${id}" method="POST">
                    <input type="text" name="password" placeholder="Enter Password" required autocomplete="off">
                    <br>
                    <button type="submit">Unlock & Download</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// 3. The Download Action (POST Request)
// Checks password -> Downloads -> Deletes
app.post('/file/:id', (req, res) => {
    const id = req.params.id;
    const userPassword = req.body.password;

    // 1. Check if file exists
    if (!fileStore.has(id)) {
        return res.status(404).send('File not found.');
    }

    const fileData = fileStore.get(id);

    // 2. Check Password
    if (userPassword.trim() !== fileData.password) {
        // Incorrect: Return the HTML page again with an error message
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Error</title></head>
            <body style="background:#2c3e50; display:flex; justify-content:center; align-items:center; height:100vh;">
                <div style="background:#34495e; padding:40px; border-radius:8px; text-align:center; color:white; font-family:sans-serif;">
                    <h2 style="color:#e74c3c">Incorrect Password</h2>
                    <a href="/file/${id}" style="color:white">Try Again</a>
                </div>
            </body>
            </html>
        `);
    }

    // 3. Correct Password: Start Download & Delete
    const filePath = fileData.path;
    const fileName = fileData.originalName;

    // Remove from database immediately so no one else can even try
    fileStore.delete(id);

    res.download(filePath, fileName, (err) => {
        if (err) console.error("Download error:", err);

        // DELETE FROM DISK
        fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting file:", unlinkErr);
            else console.log(`Deleted ${fileName} from storage.`);
        });
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
