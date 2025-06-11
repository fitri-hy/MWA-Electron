require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const session = require('express-session');
const flash = require('connect-flash');
const http = require('http');
const socketIO = require('socket.io');
const { ensureAutoRepliesFile, readAutoReplies, saveAutoReplies } = require('./utils/autoReplyHelper');
const initBotSocket = require('./utils/bot/botSocket');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'secret_key',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

let darkMode = false;

app.get('/', (req, res) => {
  res.render('index', { darkMode, title: 'M-WA' });
});

app.get('/bot', (req, res) => {
  res.render('bot', { darkMode, title: 'Bot | M-WA' });
});

app.use('/auto-reply', (req, res, next) => {
  ensureAutoRepliesFile((err) => {
    if (err) {
      console.error('Failed to verify autoReply.json file:', err);
      return res.status(500).send('Error server');
    }
    next();
  });
});

app.get('/auto-reply', (req, res) => {
  const keyword = (req.query.q || '').toLowerCase();

  readAutoReplies((err, autoReplies) => {
    if (err) {
      console.error('Failed to read autoReply.json file:', err);
      return res.status(500).send('Failed to read auto-reply data');
    }

    const filteredReplies = keyword
      ? autoReplies.filter(reply =>
          reply.value.toLowerCase().includes(keyword) ||
          reply.response.toLowerCase().includes(keyword)
        )
      : autoReplies;

    res.render('auto-reply', {
      darkMode: req.darkMode || false,
      title: 'Auto Reply | M-WA',
      autoReplies: filteredReplies
    });
  });
});

app.post('/auto-reply/create', (req, res) => {
  let { value, response } = req.body;

  if (!value || !response) {
    req.flash('error_msg', 'Value and response are required');
    return res.redirect('/auto-reply');
  }

  response = response.replace(/\r\n/g, '\n');

  readAutoReplies((err, autoReplies) => {
    if (err) {
      req.flash('error_msg', 'Failed to read data');
      return res.redirect('/auto-reply');
    }
    const newId = autoReplies.length ? Math.max(...autoReplies.map(r => r.id)) + 1 : 1;
    autoReplies.push({ id: newId, value, response });
    saveAutoReplies(autoReplies, (err) => {
      if (err) {
        req.flash('error_msg', 'Failed to save data');
        return res.redirect('/auto-reply');
      }
      req.flash('success_msg', 'Auto reply created successfully');
      res.redirect('/auto-reply');
    });
  });
});

app.post('/auto-reply/update', (req, res) => {
  const id = parseInt(req.body.id);
  let { value, response } = req.body;

  if (!id || !value || !response) {
    req.flash('error_msg', 'Value and response are required');
    return res.redirect('/auto-reply');
  }

  response = response.replace(/\r\n/g, '\n');

  readAutoReplies((err, autoReplies) => {
    if (err) {
      req.flash('error_msg', 'Failed to read data');
      return res.redirect('/auto-reply');
    }

    const index = autoReplies.findIndex(r => r.id === id);
    if (index === -1) {
      req.flash('error_msg', 'Data not found');
      return res.redirect('/auto-reply');
    }

    autoReplies[index] = { id, value, response };

    saveAutoReplies(autoReplies, (err) => {
      if (err) {
        req.flash('error_msg', 'Failed to save data');
        return res.redirect('/auto-reply');
      }
      req.flash('success_msg', 'Auto reply updated successfully');
      res.redirect('/auto-reply');
    });
  });
});


app.post('/auto-reply/delete/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) {
    req.flash('error_msg', 'Invalid ID');
    return res.redirect('/auto-reply');
  }

  readAutoReplies((err, autoReplies) => {
    if (err) {
      req.flash('error_msg', 'Failed to read data');
      return res.redirect('/auto-reply');
    }

    const filtered = autoReplies.filter(r => r.id !== id);

    if (filtered.length === autoReplies.length) {
      req.flash('error_msg', 'Data not found');
      return res.redirect('/auto-reply');
    }

    saveAutoReplies(filtered, (err) => {
      if (err) {
        req.flash('error_msg', 'Failed to save data');
        return res.redirect('/auto-reply');
      }
      req.flash('success_msg', 'Auto reply deleted successfully');
      res.redirect('/auto-reply');
    });
  });
});


initBotSocket(io);

function startExpressServer() {
  server.listen(PORT, () => {
    console.log(`Express server running at http://localhost:${PORT}`);
  });
}

module.exports = startExpressServer;