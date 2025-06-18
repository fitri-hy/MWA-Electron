require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const session = require('express-session');
const flash = require('connect-flash');
const marked = require('marked');
const http = require('http');
const socketIO = require('socket.io');
const { ensureAutoRepliesFile, readAutoReplies, saveAutoReplies, ensureFirstMessageFile, readFirstMessage, saveFirstMessage, clearFirstTimeUsers } = require('./utils/autoReplyHelper');
const { lockscreenMiddleware, lockscreenGet, lockscreenPost, settingData } = require('./utils/lockscreen');
const { generateText } = require('./utils/gemini');
const { getNotes, addNote, editNote, deleteNote } = require('./utils/notes');
const { 
	invoice, createInvoice, deleteInvoice,
	vendor, addVendor, editVendor, deleteVendor,
	inventory, addInventory, editInventory, deleteInventory, addStockInventory, writeOffStockInventory,
	customer, addCustomer, editCustomer, deleteCustomer,
	report 
} = require('./utils/pos/pos');
const initBotSocket = require('./utils/bot/botSocket');
const { sendMessageBySessionId, getSessions  } = require('./utils/bot/sessionManager');

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

app.use(lockscreenMiddleware);

app.get('/lockscreen', (req, res) => {
  lockscreenGet(req, res, darkMode);
});

app.post('/lockscreen', (req, res) => {
  lockscreenPost(req, res, darkMode);
});

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
    ensureFirstMessageFile((err2) => {
      if (err2) {
        console.error('Failed to verify firstMessage.json file:', err2);
        return res.status(500).send('Error server');
      }
      next();
    });
  });
});

app.get('/auto-reply', (req, res) => {
  const keyword = (req.query.q || '').toLowerCase();

  readAutoReplies((err, autoReplies) => {
    if (err) {
      console.error('Failed to read autoReply.json file:', err);
      return res.status(500).send('Failed to read auto-reply data');
    }

    readFirstMessage((err2, firstMessage) => {
      if (err2) {
        console.error('Failed to read firstMessage.json file:', err2);
        return res.status(500).send('Failed to read first-time message');
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
        autoReplies: filteredReplies,
        firstMessage: firstMessage
      });
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

app.post('/auto-reply/first-message', (req, res) => {
  const { message, enabled } = req.body;

  if (!message || message.trim() === '') {
    req.flash('error_msg', 'Message cannot be empty.');
    return res.redirect('/auto-reply');
  }

  const newFirstMessage = {
    message: message.trim(),
    enabled: enabled === 'true'
  };

  saveFirstMessage(newFirstMessage, (err) => {
    if (err) {
      req.flash('error_msg', 'Failed to save first message.');
      return res.redirect('/auto-reply');
    }
    req.flash('success_msg', 'First message updated successfully.');
    res.redirect('/auto-reply');
  });
});

app.post('/auto-reply/clear-first-users', (req, res) => {
  clearFirstTimeUsers((err) => {
    if (err) {
      req.flash('error_msg', 'Failed to delete first user data.');
    } else {
      req.flash('success_msg', 'The first user data was successfully cleared.');
    }
    res.redirect('/auto-reply');
  });
});

app.get('/setting', (req, res) => {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.config', 'M-WA', 'setting');
  const settingPath = path.join(configDir, 'setting.json');
  const geminiPath = path.join(configDir, 'gemini.json');

  let settings = { password: '', enabled: false };
  let gemini = { apikey: '' };
 
  try {
    if (fs.existsSync(settingPath)) {
      settings = JSON.parse(fs.readFileSync(settingPath, 'utf8'));
    }

    if (fs.existsSync(geminiPath)) {
      gemini = JSON.parse(fs.readFileSync(geminiPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading config files:', err);
  }

  res.render('setting', {
    darkMode: req.darkMode || false,
    title: 'Setting | M-WA',
    enabled: settings.enabled,
	apikey: gemini.apikey,
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg'),
  });
});

app.post('/setting/password', (req, res) => {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.config', 'M-WA', 'setting');
  const settingPath = path.join(configDir, 'setting.json');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let currentSetting = { enabled: false, password: '' };
  if (fs.existsSync(settingPath)) {
    try {
      const raw = fs.readFileSync(settingPath, 'utf-8');
      currentSetting = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to read existing settings:', err);
    }
  }

  currentSetting.password = req.body.password;

  fs.writeFile(settingPath, JSON.stringify(currentSetting, null, 2), (err) => {
    if (err) {
      console.error('Failed to write settings:', err);
      req.flash('error_msg', 'Failed to save settings');
      return res.redirect('/setting');
    }
    req.flash('success_msg', 'Settings updated successfully');
    res.redirect('/setting');
  });
});

app.post('/setting/toggle', (req, res) => {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.config', 'M-WA', 'setting');
  const settingPath = path.join(configDir, 'setting.json');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let settings = { enabled: false };

  try {
    if (fs.existsSync(settingPath)) {
      const fileData = fs.readFileSync(settingPath, 'utf8');
      settings = JSON.parse(fileData);
    }
  } catch (err) {
    console.error('Failed to read settings:', err);
  }

  const enabled = req.body.enabled === 'on' ? true : false;
  settings.enabled = enabled;

  fs.writeFile(settingPath, JSON.stringify(settings, null, 2), (err) => {
    if (err) {
      console.error('Failed to write settings:', err);
      req.flash('error_msg', 'Failed to update button');
      return res.redirect('/setting');
    }
    req.flash('success_msg', 'Toggle successfully updated');
    res.redirect('/setting');
  });
});

app.get('/ai', (req, res) => {
  res.render('ai', {
    darkMode,
    title: 'AI | M-WA',
    chats: []
  });
});

app.post('/ai/text', async (req, res) => {
  const { prompt, model = 'gemini-2.0-flash' } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  try {
    const text = await generateText(model, prompt);
    res.json({ success: true, text });
  } catch (err) {
    //console.error('Error generateText:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

app.post('/setting/gemini', (req, res) => {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.config', 'M-WA', 'setting');
  const settingPath = path.join(configDir, 'gemini.json');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let currentSetting = { apikey: '' };
  if (fs.existsSync(settingPath)) {
    try {
      const raw = fs.readFileSync(settingPath, 'utf-8');
      currentSetting = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to read existing settings:', err);
    }
  }

  currentSetting.apikey = req.body.apikey;

  fs.writeFile(settingPath, JSON.stringify(currentSetting, null, 2), (err) => {
    if (err) {
      console.error('Failed to write settings:', err);
      req.flash('error_msg', 'Failed to save settings');
      return res.redirect('/setting');
    }
    req.flash('success_msg', 'Settings updated successfully');
    res.redirect('/setting');
  });
});

app.get('/notes', (req, res) => {
  const q = req.query.q?.toLowerCase() || '';
  let allNotes = getNotes();

  if (q) {
    allNotes = allNotes.filter(note => 
      note.title.toLowerCase().includes(q) || 
      note.note.toLowerCase().includes(q)
    );
  }

  res.render('notes', {
    darkMode,
    title: 'Notes | M-WA',
    notes: allNotes,
    query: q,
  });
});


app.post('/notes/add', (req, res) => {
  const { title, note } = req.body;
  if (!title || !note) {
    req.flash('error_msg', 'Title and note are required');
    return res.redirect('/notes');
  }
  addNote(title, note);
  req.flash('success_msg', 'Note added successfully');
  res.redirect('/notes');
});

app.post('/notes/edit', (req, res) => {
  const { id, title, note } = req.body;
  if (!id || !title || !note) {
    req.flash('error_msg', 'ID, title, and note are required');
    return res.redirect('/notes');
  }
  const updated = editNote(id, title, note);
  if (!updated) {
    req.flash('error_msg', 'Note not found');
    return res.redirect('/notes');
  }
  req.flash('success_msg', 'Note updated successfully');
  res.redirect('/notes');
});

app.post('/notes/delete/:id', (req, res) => {
  const { id } = req.params;
  const success = deleteNote(id);

  if (success) {
    req.flash('success_msg', 'Note deleted successfully.');
  } else {
    req.flash('error_msg', 'Note not found.');
  }

  res.redirect('/notes');
});

app.get('/pos/invoice', (req, res) => {
  invoice(res, darkMode);
});

app.post('/pos/invoice/create', (req, res) => {
  const { date, invoice, id_customer, total, inventory } = req.body;

  if (!date || !invoice || !id_customer || !total || !inventory) {
    req.flash('error_msg', 'All fields are required!');
    return res.redirect('/pos/invoice');
  }

  try {
    const newInvoice = createInvoice({ date, invoice, id_customer, total, inventory });
    req.flash('success_msg', 'Invoice created successfully!');
    return res.redirect('/pos/invoice');
  } catch (error) {
    req.flash('error_msg', error.message || 'Internal server error');
    return res.redirect('/pos/invoice');
  }
});

app.post('/pos/invoice/new-customer', (req, res) => {
  const { name, phone, city, state, code_pos, address } = req.body;

  if (!name || !phone || !city || !state || !code_pos || !address) {
    req.flash('error_msg', 'All fields are required!');
    return res.redirect('/pos/invoice');
  }

  const customerData = { name, phone, city, state, code_pos, address };
  addCustomer(customerData);

  req.flash('success_msg', 'Customer added successfully!');
  res.redirect('/pos/invoice');
});

app.get('/pos/vendor', (req, res) => {
  vendor(req, res, darkMode);
});

app.post('/pos/vendor/add', (req, res) => {
  const { vendor } = req.body;
  if (!vendor) {
    req.flash('error_msg', 'Vendor name is required');
    return res.redirect('/pos/vendor');
  }

  addVendor(vendor);
  req.flash('success_msg', 'Vendor added successfully');
  res.redirect('/pos/vendor');
});

app.post('/pos/vendor/edit', (req, res) => {
  const { id, vendor } = req.body;
  const vendorId = parseInt(id);
  if (!vendor || isNaN(vendorId)) {
    req.flash('error_msg', 'Valid ID and vendor name required');
    return res.redirect('/pos/vendor');
  }

  const updated = editVendor(vendorId, vendor);
  if (updated) {
    req.flash('success_msg', 'Vendor updated successfully');
  } else {
    req.flash('error_msg', 'Vendor not found');
  }
  res.redirect('/pos/vendor');
});

app.post('/pos/vendor/delete', (req, res) => {
  const { id } = req.body;
  const vendorId = parseInt(id);
  if (isNaN(vendorId)) {
    req.flash('error_msg', 'Valid ID required');
    return res.redirect('/pos/vendor');
  }

  const deleted = deleteVendor(vendorId);
  if (deleted) {
    req.flash('success_msg', 'Vendor deleted successfully');
  } else {
    req.flash('error_msg', 'Vendor not found');
  }
  res.redirect('/pos/vendor');
});

app.get('/pos/inventory', (req, res) => {
  inventory(req, res, darkMode);
});

app.post('/pos/inventory/add', (req, res) => {
  const { vendor_id, item, cogs, price } = req.body;

  if (!vendor_id || !item || !cogs || !price) {
    req.flash('error_msg', 'All fields are required!');
    return res.redirect('/pos/inventory');
  }

  addInventory(parseInt(vendor_id), item, 0, cogs, price);

  req.flash('success_msg', 'Inventory added successfully!');
  res.redirect('/pos/inventory');
});

app.post('/pos/inventory/edit', (req, res) => {
  const { id, vendor_id, item, cogs, price } = req.body;

  if (!id || !vendor_id || !item || !cogs || !price) {
    req.flash('error_msg', 'All fields are required!');
    return res.redirect('/pos/inventory');
  }

  const updatedData = {
    vendor_id: parseInt(vendor_id),
    item: item.trim(),
    cogs: parseFloat(cogs),
    price: parseFloat(price)
  };

  const success = editInventory(parseInt(id), updatedData);

  if (success) {
    req.flash('success_msg', 'Inventory updated successfully!');
  } else {
    req.flash('error_msg', 'Failed to update inventory.');
  }

  res.redirect('/pos/inventory');
});

app.post('/pos/inventory/delete', (req, res) => {
  const id = parseInt(req.body.id);
  if (!id) {
    req.flash('error_msg', 'Invalid inventory ID');
    return res.redirect('/pos/inventory');
  }

  const success = deleteInventory(id);
  if (success) {
    req.flash('success_msg', 'Inventory deleted successfully');
  } else {
    req.flash('error_msg', 'Inventory not found or failed to delete');
  }
  res.redirect('/pos/inventory');
});

app.post('/pos/inventory/add-stock', (req, res) => {
  const { id, stock, desc, date } = req.body;

  if (!id || !stock || !desc || !date) {
    req.flash('error_msg', 'All fields are required!');
    return res.redirect('/pos/inventory');
  }

  const updated = addStockInventory(id, stock, desc, date);

  if (updated) {
    req.flash('success_msg', 'Stock added successfully!');
  } else {
    req.flash('error_msg', 'Failed to add stock.');
  }

  res.redirect('/pos/inventory');
});

app.post('/pos/inventory/write-off-stock', (req, res) => {
  const { id, stock, desc, date } = req.body;

  if (!id || !stock || !desc || !date) {
    req.flash('error_msg', 'All fields are required!');
    return res.redirect('/pos/inventory');
  }

  const updated = writeOffStockInventory(id, stock, desc, date);

  if (updated) {
    req.flash('success_msg', 'Write off stock successfully!');
  } else {
    req.flash('error_msg', 'Failed to write off stock.');
  }

  res.redirect('/pos/inventory');
});

app.get('/pos/customer', (req, res) => {
  customer(req, res, darkMode);
});

app.post('/pos/customer/add', (req, res) => {
  const { name, phone, city, state, code_pos, address } = req.body;

  if (!name || !phone || !city || !state || !code_pos || !address) {
    req.flash('error_msg', 'All fields are required!');
    return res.redirect('/pos/customer');
  }

  const customerData = { name, phone, city, state, code_pos, address };
  addCustomer(customerData);

  req.flash('success_msg', 'Customer added successfully!');
  res.redirect('/pos/customer');
});

app.post('/pos/customer/delete', (req, res) => {
  const id = parseInt(req.body.id);
  if (!id) {
    req.flash('error_msg', 'Invalid customer ID');
    return res.redirect('/pos/customer');
  }

  const success = deleteCustomer(id);
  if (success) {
    req.flash('success_msg', 'Customer deleted successfully');
  } else {
    req.flash('error_msg', 'Customer not found or failed to delete');
  }
  res.redirect('/pos/customer');
});

app.post('/pos/customer/edit', (req, res) => {
  const id = parseInt(req.body.id);
  const { name, phone, city, state, code_pos, address } = req.body;

  if (!id || !name || !phone || !city || !state || !code_pos || !address) {
    req.flash('error_msg', 'All fields are required!');
    return res.redirect('/pos/customer');
  }

  const success = editCustomer(id, { name, phone, city, state, code_pos, address });

  if (success) {
    req.flash('success_msg', 'Customer updated successfully!');
  } else {
    req.flash('error_msg', 'Customer not found or failed to update');
  }

  res.redirect('/pos/customer');
});

app.get('/pos/report', (req, res) => {
  report(res, darkMode);
});

app.post('/pos/report/delete-invoice', (req, res) => {
  const id = parseInt(req.body.id);
  if (!id) {
    req.flash('error_msg', 'Invalid invoice ID');
    return res.redirect('/pos/report');
  }

  try {
    const success = deleteInvoice(id);
    if (success) {
      req.flash('success_msg', 'Invoice deleted successfully');
    } else {
      req.flash('error_msg', 'Invoice not found');
    }
  } catch (err) {
    req.flash('error_msg', 'Failed to delete invoice');
  }

  res.redirect('/pos/report');
});

app.post('/webhook/send-message', async (req, res) => {
  const { sessionId, number, message } = req.body;

  if (!sessionId || !number || !message) {
    return res.status(400).json({ success: false, error: 'sessionId, number, and message are required' });
  }

  try {
    await sendMessageBySessionId(sessionId, number, message);

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Failed to send message:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

app.get('/webhook/sessions', (req, res) => {
  try {
    const sessions = getSessions();
    res.json({ success: true, sessions });
  } catch (err) {
    console.error('Failed to take registration session:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch session list' });
  }
});

app.get('/docs', (req, res) => {
  const docsDir = path.join(__dirname, 'public', 'docs');
  const filesToRead = [
	'getStarter.md', 
	'addingTabs.md', 
	'connectAccount.md',
	'integratingAI.md',
	'createBot.md',
	'autoReply.md',
	'invoice.md',
	'vendor.md',
	'inventory.md',
	'customer.md',
	'report.md',
	'notes.md',
	'lockscreen.md',
	'fullscreen.md',
	'lightDark.md',
	'reload.md',
	'clearTab.md',
	'backupRestore.md'
  ];

  Promise.all(
    filesToRead.map(file => {
      const fullPath = path.join(docsDir, file);
      return fs.promises.readFile(fullPath, 'utf8')
        .then(content => ({ [file.replace('.md', '')]: marked.parse(content) }))
        .catch(err => ({ [file.replace('.md', '')]: `Error loading ${file}` }));
    })
  ).then(parsedFilesArray => {
    const parsedFiles = Object.assign({}, ...parsedFilesArray);

    res.render('docs', {
      title: 'Documentation | M-WA',
      darkMode,
      ...parsedFiles
    });
  }).catch(err => {
    console.error('Error reading markdown files:', err);
    res.status(500).send('Failed to load documentation.');
  });
});

initBotSocket(io);

function startExpressServer() {
  server.listen(PORT, () => {
    console.log(`Express server running at http://localhost:${PORT}`);
  });
}

module.exports = startExpressServer;